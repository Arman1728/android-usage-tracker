import { CHAT_BOARD_ROLES, ChatBoardRole } from '../types/survey';

export interface ValidatedChatBoardInput {
  senderName: string;
  roleTag: ChatBoardRole;
  message: string;
}

export function validateChatBoardInput(raw: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: ValidatedChatBoardInput;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Chat board post must be a JSON object.' };
  }

  const record = raw as Record<string, unknown>;
  const rawName = typeof record.senderName === 'string' ? record.senderName : '';
  const rawRole = typeof record.roleTag === 'string' ? record.roleTag.trim() : '';
  const rawMessage = typeof record.message === 'string' ? record.message : '';

  const senderName = rawName.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  const message = rawMessage.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

  if (senderName.length < 2 || senderName.length > 60) {
    return { valid: false, error: 'Display name must be between 2 and 60 characters.' };
  }

  if (!CHAT_BOARD_ROLES.includes(rawRole as ChatBoardRole)) {
    return { valid: false, error: 'Please select a valid participant role.' };
  }

  if (message.length < 2 || message.length > 500) {
    return { valid: false, error: 'Message must be between 2 and 500 characters.' };
  }

  return {
    valid: true,
    sanitized: {
      senderName,
      roleTag: rawRole as ChatBoardRole,
      message,
    },
  };
}
