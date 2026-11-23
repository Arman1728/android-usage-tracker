import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Send,
  User,
  Volume2,
} from 'lucide-react';
import { DatasetCounts, DatasetScope } from '../types/survey';
import { apiFetch } from '../utils/apiClient';
import {
  base64ToBytes,
  buildLiveWsUrl,
  bytesToBase64,
  float32ToPcm16Bytes,
  pcm16BytesToFloat32,
  resampleFloat32,
} from '../utils/liveAudio';

interface AiBotViewProps {
  counts: DatasetCounts;
  scope: DatasetScope;
  onScopeChange: (scope: DatasetScope) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

type BotMode = 'text' | 'voice';
type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

const STARTER_PROMPTS = [
  'Which occupation and age group use Android phones the most?',
  'Compare educational/work hours vs entertainment hours in the survey.',
  'Summarize the most popular apps and privacy awareness levels.',
  'Suggest practical digital wellbeing recommendations for students and seniors.',
];

export const AiBotView: React.FC<AiBotViewProps> = ({
  counts,
  scope,
  onScopeChange,
}) => {
  const [mode, setMode] = useState<BotMode>('text');

  // Text Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Voice Conversation (Live API) state
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [voicePromptInput, setVoicePromptInput] = useState('');
  const [voiceTranscripts, setVoiceTranscripts] = useState<ChatMessage[]>([]);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const mutedRef = useRef<boolean>(false);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const activeCount =
    scope === 'real' ? counts.realCount : scope === 'sample' ? counts.sampleCount : counts.total;

  const stopPlaybackQueue = useCallback(() => {
    for (const node of activeSourcesRef.current) {
      try {
        node.stop();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setVoiceSpeaking(false);
  }, []);

  const stopVoiceSession = useCallback(
    (nextStatus: VoiceStatus = 'idle') => {
      stopPlaybackQueue();

      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        try {
          processorRef.current.disconnect();
        } catch {
          // Ignore disconnect error
        }
        processorRef.current = null;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore disconnect error
        }
        sourceNodeRef.current = null;
      }

      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close().catch(() => {});
        inputAudioCtxRef.current = null;
      }

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => {});
        outputAudioCtxRef.current = null;
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
      }

      setVoiceStatus(nextStatus);
      setIsMuted(false);
      setMicActive(false);
      mutedRef.current = false;
    },
    [stopPlaybackQueue]
  );

  useEffect(() => {
    return () => {
      stopVoiceSession('idle');
    };
  }, [stopVoiceSession]);

  const playPcm24kChunk = useCallback((base64Data: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const bytes = base64ToBytes(base64Data);
    const float32 = pcm16BytesToFloat32(bytes);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    setVoiceSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setVoiceSpeaking(false);
      }
    };

    source.start(startTime);
  }, []);

  const appendVoiceTranscript = useCallback((role: 'user' | 'model', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setVoiceTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const joined = `${last.text} ${clean}`.replace(/\s+/g, ' ').trim();
        return [...prev.slice(0, -1), { ...last, text: joined }];
      }
      return [...prev, { id: `vt-${Date.now()}-${Math.random()}`, role, text: clean }];
    });
  }, []);

  const startVoiceSession = async () => {
    if (voiceStatus === 'connecting' || voiceStatus === 'connected') return;

    setVoiceError(null);
    setVoiceNotice(null);
    setVoiceStatus('connecting');

    // Create & resume AudioContexts synchronously on user gesture before awaiting getUserMedia
    let inputCtx: AudioContext | null = null;
    let outputCtx: AudioContext;
    try {
      try {
        outputCtx = new AudioContext({ sampleRate: 24000 });
      } catch {
        outputCtx = new AudioContext();
      }
      try {
        inputCtx = new AudioContext({ sampleRate: 16000 });
      } catch {
        inputCtx = new AudioContext();
      }
      outputAudioCtxRef.current = outputCtx;
      inputAudioCtxRef.current = inputCtx;
      void outputCtx.resume().catch(() => {});
      void inputCtx.resume().catch(() => {});
    } catch {
      setVoiceStatus('error');
      setVoiceError('Web Audio API is unavailable in this browser environment.');
      return;
    }

    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch (micErr) {
        const micMsg =
          micErr instanceof Error ? micErr.message : 'Microphone permission unavailable';
        setVoiceNotice(
          `Microphone unavailable (${micMsg}). Connected in Listen & Type-to-Voice mode — tap any prompt or type below to hear spoken AI answers.`
        );
      }
    } else {
      setVoiceNotice(
        'Microphone API is restricted in this browser frame. Connected in Listen & Type-to-Voice mode — tap any prompt or type below to hear spoken AI answers.'
      );
    }

    try {
      const wsUrl = buildLiveWsUrl(window.location, scope);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            data?: string;
            text?: string;
            error?: string;
            reason?: string;
          };

          if (msg.type === 'ready') {
            setVoiceStatus('connected');
            setVoiceError(null);
            void outputCtx.resume().catch(() => {});

            if (stream && inputCtx) {
              setMicActive(true);
              void inputCtx.resume().catch(() => {});
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              sourceNodeRef.current = source;
              processorRef.current = processor;

              const actualRate = inputCtx.sampleRate || 16000;
              processor.onaudioprocess = (audioEvent) => {
                if (mutedRef.current) return;
                const socket = wsRef.current;
                if (!socket || socket.readyState !== WebSocket.OPEN) return;

                const channelData = audioEvent.inputBuffer.getChannelData(0);
                const normalized =
                  actualRate === 16000
                    ? channelData
                    : resampleFloat32(channelData, actualRate, 16000);
                const pcmBytes = float32ToPcm16Bytes(normalized);
                const base64 = bytesToBase64(pcmBytes);
                socket.send(JSON.stringify({ audio: base64 }));
              };

              source.connect(processor);
              processor.connect(inputCtx.destination);
            } else {
              setMicActive(false);
            }
          } else if (msg.type === 'audio' && msg.data) {
            playPcm24kChunk(msg.data);
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendVoiceTranscript('user', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendVoiceTranscript('model', msg.text);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'error') {
            setVoiceError(msg.error || 'Voice conversation error occurred.');
            stopVoiceSession('error');
          } else if (msg.type === 'closed') {
            if (msg.reason) {
              setVoiceNotice(`Voice session closed: ${msg.reason}`);
            }
            stopVoiceSession('idle');
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      ws.onerror = () => {
        setVoiceError('WebSocket connection error while connecting to Gemini Live.');
        stopVoiceSession('error');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          stopVoiceSession('idle');
        }
      };
    } catch (err) {
      stopVoiceSession('error');
      setVoiceError(
        err instanceof Error
          ? err.message
          : 'Unable to open Gemini Live voice session.'
      );
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ audioEnd: true }));
    }
  };

  const sendVoiceTopicPrompt = (promptText: string) => {
    const clean = promptText.trim();
    const socket = wsRef.current;
    if (!clean || !socket || socket.readyState !== WebSocket.OPEN) return;
    appendVoiceTranscript('user', clean);
    socket.send(JSON.stringify({ text: clean }));
  };

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    // Build clean alternating history excluding un-answered failed user turns
    const priorHistory: Array<{ role: 'user' | 'model'; text: string }> = [];
    for (const msg of messages) {
      const last = priorHistory[priorHistory.length - 1];
      if (!last && msg.role === 'model') continue;
      if (last && last.role === msg.role) {
        priorHistory[priorHistory.length - 1] = { role: msg.role, text: msg.text };
      } else {
        priorHistory.push({ role: msg.role, text: msg.text });
      }
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const lastExisting = messages[messages.length - 1];
    const nextMessages =
      lastExisting && lastExisting.role === 'user' && lastExisting.text === trimmed
        ? messages
        : [...messages, userMsg];

    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLastFailedPrompt(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 50000);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          scope,
          history: priorHistory.slice(-8),
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string; code?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (HTTP ${res.status})`);
      }

      const replyText = data.reply?.trim();
      if (!replyText) {
        throw new Error('The AI assistant returned an empty reply.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: replyText,
        },
      ]);
    } catch (err) {
      setLastFailedPrompt(trimmed);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out after 50 seconds. Please click Retry.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach the AI Research Bot endpoint.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setLastFailedPrompt(null);
  };

  return (
    <div className="space-y-6">
      <section className="theme-surface rounded-lg border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="theme-accent-text h-5 w-5" />
              <p className="theme-accent-text text-xs font-semibold tracking-wide">
                Gemini AI · Text &amp; Live Voice Conversations
              </p>
            </div>
            <h1 className="theme-heading mt-1 text-2xl font-bold">AI Research Bot</h1>
            <p className="theme-muted mt-1 max-w-2xl text-sm">
              Ask questions by text or start a real-time voice conversation grounded in your live Android usage survey metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="theme-surface-muted inline-flex rounded-md border p-1 text-xs font-medium"
              role="group"
              aria-label="Interaction mode"
            >
              <button
                type="button"
                onClick={() => setMode('text')}
                aria-pressed={mode === 'text'}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors whitespace-nowrap ${
                  mode === 'text' ? 'theme-accent-bg font-semibold' : 'theme-muted hover:opacity-80'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Text Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('voice')}
                aria-pressed={mode === 'voice'}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors whitespace-nowrap ${
                  mode === 'voice' ? 'theme-accent-bg font-semibold' : 'theme-muted hover:opacity-80'
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Voice Conversation</span>
              </button>
            </div>

            <div
              className="theme-surface-muted inline-flex rounded-md border p-1 text-xs font-medium"
              role="group"
              aria-label="AI dataset scope"
            >
              {(
                [
                  { id: 'all', label: `All (${counts.total})` },
                  { id: 'real', label: `Real (${counts.realCount})` },
                  { id: 'sample', label: `Sample (${counts.sampleCount})` },
                ] as const
              ).map((opt) => {
                const active = scope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onScopeChange(opt.id)}
                    aria-pressed={active}
                    className={`rounded px-3 py-1.5 transition-colors whitespace-nowrap ${
                      active ? 'theme-accent-bg font-semibold' : 'theme-muted hover:opacity-80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {mode === 'text' && messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:opacity-85 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear Chat</span>
              </button>
            )}
          </div>
        </div>

        <div className="theme-surface-muted mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-2.5 text-xs">
          <span className="theme-muted">
            Active research context:{' '}
            <strong className="theme-heading font-mono tabular-nums">{activeCount}</strong>{' '}
            survey response(s) from SQLite ({scope === 'real' ? 'real submissions only' : scope === 'sample' ? 'sample demo records only' : 'combined dataset'}).
          </span>
          <span className="theme-accent-text font-medium">
            {mode === 'voice'
              ? 'Live API · gemini-3.8-live (16kHz in / 24kHz out)'
              : 'Text API · gemini-4-hydrogen'}
          </span>
        </div>
      </section>


      {mode === 'voice' ? (
        <section className="theme-surface rounded-lg border p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="theme-heading text-base font-semibold">
                Real-Time Voice Conversation
              </h2>
              <p className="theme-muted mt-0.5 text-xs">
                Speak directly through your microphone and receive instant spoken responses grounded in your survey dataset.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {voiceStatus === 'connected' ? (
                <>
                  {micActive && (
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-pressed={isMuted}
                      className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
                    >
                      {isMuted ? (
                        <MicOff className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Mic className="theme-accent-text h-4 w-4" />
                      )}
                      <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => stopVoiceSession('idle')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Voice Session</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={voiceStatus === 'connecting'}
                  onClick={() => void startVoiceSession()}
                  className="theme-btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
                >
                  <Mic className="h-4 w-4" />
                  <span>
                    {voiceStatus === 'connecting'
                      ? 'Connecting Live Session...'
                      : 'Start Voice Conversation'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="theme-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <Volume2
                className={`h-4 w-4 ${
                  voiceSpeaking
                    ? 'text-emerald-600'
                    : voiceStatus === 'connected'
                    ? 'theme-accent-text'
                    : 'theme-muted'
                }`}
              />
              <span className="theme-heading font-medium">
                Status:{' '}
                {voiceStatus === 'idle'
                  ? 'Ready to connect'
                  : voiceStatus === 'connecting'
                  ? 'Connecting to Gemini Live API...'
                  : voiceSpeaking
                  ? 'AI Research Bot is speaking...'
                  : !micActive
                  ? 'Connected (Type or tap a prompt to hear spoken AI reply)'
                  : isMuted
                  ? 'Connected (Microphone muted)'
                  : 'Connected & listening — speak naturally'}
              </span>
            </div>
            {voiceTranscripts.length > 0 && (
              <button
                type="button"
                onClick={() => setVoiceTranscripts([])}
                className="theme-muted underline underline-offset-2 hover:opacity-80"
              >
                Clear Transcript
              </button>
            )}
          </div>

          {voiceNotice && (
            <div
              role="status"
              className="rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900"
            >
              {voiceNotice}
            </div>
          )}

          {voiceError && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
            >
              {voiceError}
            </div>
          )}

          {voiceStatus === 'connected' && (
            <div className="space-y-3">
              <div>
                <p className="theme-heading text-xs font-semibold">
                  Quick Spoken Prompts (tap to hear AI answer aloud)
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendVoiceTopicPrompt(prompt)}
                      className="theme-surface-muted rounded-md border px-3 py-2 text-left text-xs font-medium hover:opacity-85"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!voicePromptInput.trim()) return;
                  sendVoiceTopicPrompt(voicePromptInput);
                  setVoicePromptInput('');
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="text"
                  value={voicePromptInput}
                  onChange={(e) => setVoicePromptInput(e.target.value)}
                  maxLength={500}
                  placeholder="Or type a question here to hear the Voice Assistant speak the answer..."
                  className="theme-surface flex-1 rounded-md border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                />
                <button
                  type="submit"
                  disabled={!voicePromptInput.trim()}
                  className="theme-btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Ask Aloud</span>
                </button>
              </form>
            </div>
          )}

          <div
            aria-live="polite"
            className="theme-surface-muted min-h-[240px] max-h-[420px] space-y-3 overflow-y-auto rounded-lg border p-4"
          >
            {voiceTranscripts.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <Mic className="theme-accent-text h-8 w-8" />
                <p className="theme-heading mt-3 text-sm font-semibold">
                  Live Voice Transcript
                </p>
                <p className="theme-muted mt-1 max-w-md text-xs leading-relaxed">
                  Click &ldquo;Start Voice Conversation&rdquo;, grant microphone access, and ask about survey results, top Android applications, or safety recommendations.
                </p>
              </div>
            ) : (
              voiceTranscripts.map((item) => {
                const isUser = item.role === 'user';
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="theme-accent-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg border px-4 py-2.5 text-sm leading-relaxed ${
                        isUser ? 'theme-btn-primary border-transparent' : 'theme-surface'
                      }`}
                    >
                      {item.text}
                    </div>
                    {isUser && (
                      <div className="theme-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-md border">
                        <User className="theme-heading h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <section className="theme-surface rounded-lg border p-6">
          <div className="mb-4">
            <p className="theme-heading text-xs font-semibold tracking-wide">
              Suggested Research Questions
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  className="theme-surface-muted rounded-md border px-3.5 py-2.5 text-left text-xs font-medium transition-colors hover:opacity-85 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div
            aria-live="polite"
            className="theme-surface-muted min-h-[260px] max-h-[460px] space-y-4 overflow-y-auto rounded-lg border p-4"
          >
            {messages.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                <Bot className="theme-accent-text h-8 w-8" />
                <p className="theme-heading mt-3 text-sm font-semibold">
                  Ready to analyze your Android usage survey
                </p>
                <p className="theme-muted mt-1 max-w-md text-xs leading-relaxed">
                  Select a suggested question above, type your query below, or switch to &ldquo;Voice Conversation&rdquo; to talk in real time.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="theme-accent-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'theme-btn-primary border-transparent'
                          : 'theme-surface'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {isUser && (
                      <div className="theme-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-md border">
                        <User className="theme-heading h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="theme-accent-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="theme-surface theme-muted rounded-lg border px-4 py-3 text-sm">
                  Analyzing live survey statistics...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
            >
              <span>{error}</span>
              {lastFailedPrompt && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(lastFailedPrompt)}
                  className="rounded border border-red-400 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="ai-bot-input" className="sr-only">
              Ask the AI Research Bot
            </label>
            <input
              id="ai-bot-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              disabled={loading}
              placeholder="Ask about usage hours, top apps, privacy awareness, or category comparisons..."
              className="theme-surface flex-1 rounded-md border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="theme-btn-primary inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? 'Sending...' : 'Ask Bot'}</span>
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
