import http from 'node:http';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { getCounts, getProjectSettings, getResponses } from './db';
import { verifySecurityToken } from './security';
import { DatasetScope } from '../src/types/survey';
import { buildResearchContextSummary, buildSystemInstruction } from '../src/utils/aiContext';

const LIVE_MODEL_ID = 'gemini-3.8-live';

function parseScopeFromUrl(rawUrl: string | undefined): DatasetScope {
  if (!rawUrl) return 'all';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const s = parsed.searchParams.get('scope');
    if (s === 'real' || s === 'sample' || s === 'all') return s;
  } catch {
    // Fallback to all
  }
  return 'all';
}

function parseTokenFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function formatLiveError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : 'Unexpected error in Gemini Live voice session.';
  if (msg.startsWith('{')) {
    try {
      const parsed = JSON.parse(msg) as { error?: { message?: string } };
      if (parsed?.error?.message) return parsed.error.message;
    } catch {
      // Keep original message
    }
  }
  return msg;
}

export function attachLiveVoiceWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const urlPath = (request.url || '').split('?')[0];
    if (urlPath !== '/api/live') {
      return;
    }

    const token = parseTokenFromUrl(request.url);
    if (!verifySecurityToken(token)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, request);
    });
  });

  wss.on('connection', async (clientWs, request) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      sendJson(clientWs, {
        type: 'error',
        error:
          'Gemini API key is not configured on the server. Please add a valid GEMINI_API_KEY in Settings > Secrets.',
      });
      clientWs.close();
      return;
    }

    const scope = parseScopeFromUrl(request.url);
    const responses = getResponses(scope);
    const counts = getCounts();
    const settings = getProjectSettings();
    const summary = buildResearchContextSummary(responses, counts, settings, scope);
    const systemInstruction = `${buildSystemInstruction(summary)}\n\nKeep spoken voice replies concise, conversational, and clear (2–4 sentences unless asked for more detail).`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let closed = false;

    const closeAll = () => {
      if (closed) return;
      closed = true;
      try {
        liveSession?.close();
      } catch {
        // Ignore close errors
      }
      liveSession = null;
    };

    try {
      liveSession = await ai.live.connect({
        model: LIVE_MODEL_ID,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            sendJson(clientWs, { type: 'ready', model: LIVE_MODEL_ID, scope });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (!content) return;

            if (content.inputTranscription?.text) {
              sendJson(clientWs, {
                type: 'inputTranscript',
                text: content.inputTranscription.text,
              });
            }

            if (content.outputTranscription?.text) {
              sendJson(clientWs, {
                type: 'outputTranscript',
                text: content.outputTranscription.text,
              });
            }

            for (const part of content.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendJson(clientWs, {
                  type: 'audio',
                  data: part.inlineData.data,
                });
              }
            }

            if (content.interrupted) {
              sendJson(clientWs, { type: 'interrupted' });
            }

            if (content.turnComplete) {
              sendJson(clientWs, { type: 'turnComplete' });
            }
          },
          onerror: (errEvent) => {
            sendJson(clientWs, {
              type: 'error',
              error: formatLiveError(errEvent),
            });
          },
          onclose: () => {
            if (!closed) {
              sendJson(clientWs, { type: 'closed' });
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close();
              }
            }
          },
        },
      });
    } catch (err) {
      sendJson(clientWs, {
        type: 'error',
        error: formatLiveError(err),
      });
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession || closed) return;
      try {
        const msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        if (typeof msg.audio === 'string' && msg.audio.length > 0) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          liveSession.sendRealtimeInput({
            text: msg.text.trim(),
          });
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    clientWs.on('close', closeAll);
    clientWs.on('error', closeAll);
  });

  return wss;
}
