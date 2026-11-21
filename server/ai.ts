import { GoogleGenAI, Content, ThinkingLevel } from '@google/genai';
import {
  buildResearchContextSummary,
  buildSystemInstruction,
  ChatTurn,
} from '../src/utils/aiContext';
import { DatasetCounts, DatasetScope, ProjectSettings, SurveyResponse } from '../src/types/survey';

const MODEL_ID = 'gemini-4-hydrogen';

export class AiServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AiServiceError';
    this.statusCode = statusCode;
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiServiceError(
      'Gemini API key is not configured on the server. Please add a valid GEMINI_API_KEY in Settings > Secrets.',
      503
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 20000,
    },
  });
}

function extractStatusAndMessage(err: unknown): { status: number; message: string } {
  if (err instanceof AiServiceError) {
    return { status: err.statusCode, message: err.message };
  }

  const record = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const rawStatus =
    typeof record.status === 'number'
      ? record.status
      : typeof record.statusCode === 'number'
      ? record.statusCode
      : 500;
  let rawMsg =
    typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : 'Unexpected error communicating with the Gemini AI service.';

  if (rawMsg.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(rawMsg) as { error?: { message?: string; code?: number } };
      if (parsedJson?.error?.message) {
        rawMsg = parsedJson.error.message;
      }
    } catch {
      // Keep rawMsg as-is if not valid JSON
    }
  }

  if (rawStatus === 400 || rawMsg.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'The Gemini API rejected the request or API key. Please check GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawStatus === 403 || rawMsg.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Permission denied by the Gemini API. Please verify your API key in Settings > Secrets.',
    };
  }
  if (rawStatus === 404 || rawMsg.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'The configured Gemini model was not found or is unavailable.',
    };
  }
  if (rawStatus === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota reached. Please try again shortly.',
    };
  }
  if (rawStatus === 503 || rawMsg.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: rawMsg,
    };
  }
  if (rawMsg.toLowerCase().includes('timeout') || rawMsg.toLowerCase().includes('aborted')) {
    return {
      status: 504,
      message: 'The Gemini AI service timed out while generating a response. Please try again.',
    };
  }

  return {
    status: rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500,
    message: rawMsg,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateResearchBotReply(params: {
  message: string;
  history: ChatTurn[];
  scope: DatasetScope;
  responses: SurveyResponse[];
  counts: DatasetCounts;
  settings: ProjectSettings;
}): Promise<{ reply: string; model: string }> {
  const ai = getAiClient();
  const contextSummary = buildResearchContextSummary(
    params.responses,
    params.counts,
    params.settings,
    params.scope
  );
  const systemInstruction = buildSystemInstruction(contextSummary);

  const contents: Content[] = [
    ...params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user',
      parts: [{ text: params.message }],
    },
  ];

  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        throw new AiServiceError('The AI model returned an empty response.', 502);
      }

      return { reply: replyText, model: MODEL_ID };
    } catch (err) {
      lastError = err;
      const { status } = extractStatusAndMessage(err);
      const isTransient = status === 429 || status === 503 || status === 500;
      if (isTransient && attempt < maxAttempts - 1) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  const parsed = extractStatusAndMessage(lastError);
  throw new AiServiceError(parsed.message, parsed.status);
}
