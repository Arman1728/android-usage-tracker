import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  ExternalLink,
  MessageSquare,
  Send,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  CHAT_BOARD_ROLES,
  ChatBoardMessage,
  ChatBoardRole,
  DatasetCounts,
  DatasetScope,
  SectionId,
} from '../types/survey';
import { apiFetch } from '../utils/apiClient';

interface ChatBoardWidgetProps {
  counts: DatasetCounts;
  scope: DatasetScope;
  adminToken: string | null;
  onNavigate: (section: SectionId) => void;
}

interface QuickAiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

type BoardTab = 'ai' | 'community';

const QUICK_AI_PROMPTS = [
  'Which occupation and age group use Android phones the most?',
  'Summarize top Android apps and privacy awareness levels.',
];

export const ChatBoardWidget: React.FC<ChatBoardWidgetProps> = ({
  counts,
  scope,
  adminToken,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BoardTab>('ai');

  // AI Quick Chat state
  const [aiMessages, setAiMessages] = useState<QuickAiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLastFailed, setAiLastFailed] = useState<string | null>(null);

  // Community Chat Board state
  const [boardMessages, setBoardMessages] = useState<ChatBoardMessage[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [roleTag, setRoleTag] = useState<ChatBoardRole>('Student');
  const [boardText, setBoardText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [posting, setPosting] = useState(false);

  const aiFeedRef = useRef<HTMLDivElement | null>(null);
  const boardFeedRef = useRef<HTMLDivElement | null>(null);

  const loadBoardMessages = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await apiFetch('/api/chatboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages?: ChatBoardMessage[] };
      setBoardMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setBoardError('Unable to load community chat board messages.');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoardMessages();
  }, [loadBoardMessages]);

  useEffect(() => {
    if (open && tab === 'community') {
      void loadBoardMessages();
    }
  }, [open, tab, loadBoardMessages]);

  useEffect(() => {
    if (aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading]);

  useEffect(() => {
    if (boardFeedRef.current) {
      boardFeedRef.current.scrollTop = boardFeedRef.current.scrollHeight;
    }
  }, [boardMessages]);

  const activeCount =
    scope === 'real' ? counts.realCount : scope === 'sample' ? counts.sampleCount : counts.total;

  const sendAiPrompt = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || aiLoading) return;

    const priorHistory: Array<{ role: 'user' | 'model'; text: string }> = [];
    for (const msg of aiMessages) {
      const last = priorHistory[priorHistory.length - 1];
      if (!last && msg.role === 'model') continue;
      if (last && last.role === msg.role) {
        priorHistory[priorHistory.length - 1] = { role: msg.role, text: msg.text };
      } else {
        priorHistory.push({ role: msg.role, text: msg.text });
      }
    }

    const lastExisting = aiMessages[aiMessages.length - 1];
    const nextMessages =
      lastExisting && lastExisting.role === 'user' && lastExisting.text === trimmed
        ? aiMessages
        : [...aiMessages, { id: `qb-u-${Date.now()}`, role: 'user' as const, text: trimmed }];

    setAiMessages(nextMessages);
    setAiInput('');
    setAiError(null);
    setAiLastFailed(null);
    setAiLoading(true);

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
          history: priorHistory.slice(-6),
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

      setAiMessages((prev) => [
        ...prev,
        { id: `qb-m-${Date.now()}`, role: 'model', text: replyText },
      ]);
    } catch (err) {
      setAiLastFailed(trimmed);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAiError('Request timed out. Please click Retry.');
      } else {
        setAiError(
          err instanceof Error ? err.message : 'Unable to reach AI Research Bot.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setAiLoading(false);
    }
  };

  const handlePostToBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posting) return;

    setBoardError(null);
    setPosting(true);

    try {
      const res = await apiFetch('/api/chatboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderName: senderName.trim(),
          roleTag,
          message: boardText.trim(),
          _hp: honeypot,
        }),
      });

      const data = (await res.json()) as {
        messages?: ChatBoardMessage[];
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        setBoardError(data.error || 'Could not post message.');
        return;
      }

      if (Array.isArray(data.messages)) {
        setBoardMessages(data.messages);
      }
      setBoardText('');
    } catch {
      setBoardError('Network error while posting to the chat board.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteBoardMessage = async (id: number) => {
    if (!adminToken) return;
    try {
      const res = await apiFetch(`/api/admin/chatboard/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { messages?: ChatBoardMessage[] };
        if (Array.isArray(data.messages)) {
          setBoardMessages(data.messages);
        }
      }
    } catch {
      setBoardError('Failed to delete message.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open CSP Chat Board"
        aria-expanded={false}
        className="theme-btn-primary fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-xs font-semibold shadow-lg transition-transform hover:scale-[1.03]"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span>Chat Board</span>
        {boardMessages.length > 0 && (
          <span className="theme-accent-bg rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none">
            {boardMessages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="CSP Chat Board"
      className="theme-surface fixed bottom-4 right-4 z-40 flex max-h-[82vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-2xl sm:w-[410px]"
    >
      {/* Drawer Header */}
      <div className="theme-sidebar flex items-center justify-between gap-2 px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-violet-300" />
            <h2 className="truncate text-sm font-bold">CSP Chat Board</h2>
          </div>
          <p className="truncate text-[11px] text-slate-300">
            AI Research Q&amp;A &amp; Community Discussion
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNavigate('assistant');
            }}
            title="Open Full AI Bot & Voice Conversation"
            className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
          >
            <span>Full Bot</span>
            <ExternalLink className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Chat Board"
            className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="theme-surface-muted border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Chat Board tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ai'}
            onClick={() => setTab('ai')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'ai' ? 'theme-accent-bg' : 'theme-surface theme-muted hover:opacity-85'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Quick Chat</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'community'}
            onClick={() => setTab('community')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'community' ? 'theme-accent-bg' : 'theme-surface theme-muted hover:opacity-85'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Community Board ({boardMessages.length})</span>
          </button>
        </div>
      </div>

      {tab === 'ai' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="theme-muted border-b border-[var(--border-subtle)] px-3.5 py-2 text-[11px]">
            Context: <strong className="theme-heading font-mono">{activeCount}</strong>{' '}
            survey record(s) ({scope})
          </div>

          <div
            ref={aiFeedRef}
            className="theme-surface-muted flex-1 space-y-2.5 overflow-y-auto p-3.5 min-h-[220px] max-h-[340px]"
          >
            {aiMessages.length === 0 ? (
              <div className="space-y-2.5 py-3">
                <p className="theme-muted text-center text-xs">
                  Ask any question about the Android Phone Usage survey without leaving this page.
                </p>
                <div className="space-y-1.5">
                  {QUICK_AI_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={aiLoading}
                      onClick={() => void sendAiPrompt(prompt)}
                      className="theme-surface block w-full rounded-md border px-3 py-2 text-left text-xs font-medium hover:opacity-85 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="theme-accent-bg flex h-6 w-6 shrink-0 items-center justify-center rounded">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg border px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser ? 'theme-btn-primary border-transparent' : 'theme-surface'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}

            {aiLoading && (
              <div className="flex items-start gap-2">
                <div className="theme-accent-bg flex h-6 w-6 shrink-0 items-center justify-center rounded">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="theme-surface theme-muted rounded-lg border px-3 py-2 text-xs">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {aiError && (
            <div
              role="alert"
              className="mx-3 mt-2 flex items-center justify-between gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800"
            >
              <span>{aiError}</span>
              {aiLastFailed && (
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void sendAiPrompt(aiLastFailed)}
                  className="rounded border border-red-400 bg-white px-2 py-0.5 font-semibold hover:bg-red-100"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendAiPrompt(aiInput);
            }}
            className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              maxLength={1000}
              disabled={aiLoading}
              placeholder="Ask AI Research Bot..."
              className="theme-surface flex-1 rounded-md border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiInput.trim()}
              aria-label="Send message to AI Research Bot"
              className="theme-btn-primary inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={boardFeedRef}
            className="theme-surface-muted flex-1 space-y-2.5 overflow-y-auto p-3.5 min-h-[200px] max-h-[280px]"
          >
            {boardLoading && boardMessages.length === 0 ? (
              <p className="theme-muted py-6 text-center text-xs">Loading discussion board...</p>
            ) : boardMessages.length === 0 ? (
              <div className="py-6 text-center">
                <Users className="theme-accent-text mx-auto h-6 w-6" />
                <p className="theme-heading mt-2 text-xs font-semibold">
                  Community Discussion Board
                </p>
                <p className="theme-muted mt-1 text-[11px] leading-relaxed">
                  No messages posted yet. Share a genuine observation, survey note, or question below.
                </p>
              </div>
            ) : (
              boardMessages.map((item) => (
                <div key={item.id} className="theme-surface rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <User className="theme-accent-text h-3.5 w-3.5 shrink-0" />
                      <span className="theme-heading truncate text-xs font-semibold">
                        {item.senderName}
                      </span>
                      <span className="theme-surface-muted theme-muted rounded border px-1.5 py-0.5 text-[10px] font-medium">
                        {item.roleTag}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="theme-muted text-[10px]">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {adminToken && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteBoardMessage(item.id)}
                          aria-label={`Delete message by ${item.senderName}`}
                          className="rounded p-0.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                    {item.message}
                  </p>
                </div>
              ))
            )}
          </div>

          {boardError && (
            <div
              role="alert"
              className="mx-3 mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800"
            >
              {boardError}
            </div>
          )}

          <form
            onSubmit={handlePostToBoard}
            className="space-y-2 border-t border-[var(--border-subtle)] p-3"
          >
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="chatboard-hp">Leave empty</label>
              <input
                id="chatboard-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                maxLength={60}
                required
                placeholder="Your name"
                aria-label="Your name"
                className="theme-surface rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <select
                value={roleTag}
                onChange={(e) => setRoleTag(e.target.value as ChatBoardRole)}
                aria-label="Participant role"
                className="theme-surface rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              >
                {CHAT_BOARD_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={boardText}
                onChange={(e) => setBoardText(e.target.value)}
                maxLength={500}
                required
                placeholder="Write a note, question, or feedback..."
                aria-label="Chat board message"
                className="theme-surface flex-1 resize-none rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <button
                type="submit"
                disabled={posting || !senderName.trim() || !boardText.trim()}
                className="theme-btn-primary inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{posting ? '...' : 'Post'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
