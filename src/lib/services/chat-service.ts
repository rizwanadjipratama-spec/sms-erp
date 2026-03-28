// ============================================================================
// CHAT SERVICE — Internal messaging between staff
// ============================================================================

import { chatDb, storageDb } from '@/lib/db';
import { supabase } from '@/lib/db';
import type { ChatChannel, ChatMessage, PaginationParams, UserRole } from '@/types/types';

const CHAT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Roles that can use chat (everyone except clients)
const CHAT_ROLES: UserRole[] = ['marketing', 'boss', 'finance', 'warehouse', 'technician', 'admin', 'owner', 'tax'];

export const chatService = {
  canUseChat(role: UserRole): boolean {
    return CHAT_ROLES.includes(role);
  },

  async getChannels(userId: string): Promise<ChatChannel[]> {
    return chatDb.getChannels(userId);
  },

  async getMessages(channelId: string, pagination?: PaginationParams) {
    return chatDb.getMessages(channelId, pagination);
  },

  async sendMessage(params: {
    channelId: string;
    senderId: string;
    content: string;
    file?: File;
    replyTo?: string;
  }): Promise<ChatMessage> {
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let fileType: string | undefined;

    if (params.file) {
      if (!CHAT_ALLOWED_TYPES.includes(params.file.type)) {
        throw new Error('File type not allowed');
      }
      if (params.file.size > MAX_CHAT_FILE_SIZE) {
        throw new Error('File too large (max 10MB)');
      }

      const ext = params.file.name.split('.').pop() ?? 'bin';
      const path = `${params.channelId}/${crypto.randomUUID()}.${ext}`;
      fileUrl = await storageDb.upload('chat-files', path, params.file);
      fileName = params.file.name;
      fileType = params.file.type;
    }

    return chatDb.sendMessage({
      channel_id: params.channelId,
      sender_id: params.senderId,
      content: params.content,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      reply_to: params.replyTo,
    });
  },

  async markChannelRead(channelId: string, userId: string): Promise<void> {
    await chatDb.updateLastRead(channelId, userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    return chatDb.getUnreadCount(userId);
  },

  subscribeToMessages(channelId: string, onMessage: (msg: ChatMessage) => void) {
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          onMessage(payload.new as ChatMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
