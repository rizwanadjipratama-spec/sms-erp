'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatService } from '@/lib/services/chat-service';
import type { ChatChannel, ChatMessage } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canChat = useMemo(() => {
    if (!profile?.role) return false;
    return chatService.canUseChat(profile.role);
  }, [profile?.role]);

  // Load channels
  useEffect(() => {
    if (!profile?.id || !canChat) return;
    chatService.getChannels(profile.id).then(setChannels);
  }, [profile?.id, canChat]);

  // Load messages when channel changes
  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    setLoading(true);
    const result = await chatService.getMessages(activeChannel.id, { page: 1, pageSize: 50 });
    setMessages(result.data);
    setLoading(false);
    if (profile?.id) {
      chatService.markChannelRead(activeChannel.id, profile.id);
    }
  }, [activeChannel, profile?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime messages
  useEffect(() => {
    if (!activeChannel) return;
    const unsub = chatService.subscribeToMessages(activeChannel.id, (msg) => {
      setMessages(prev => [...prev, msg]);
      if (profile?.id) {
        chatService.markChannelRead(activeChannel.id, profile.id);
      }
    });
    return unsub;
  }, [activeChannel, profile?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannel || !profile?.id) return;
    const content = input.trim();
    setInput('');
    await chatService.sendMessage({
      channelId: activeChannel.id,
      senderId: profile.id,
      content,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel || !profile?.id) return;
    setSendingFile(true);
    try {
      await chatService.sendMessage({
        channelId: activeChannel.id,
        senderId: profile.id,
        content: `Shared a file: ${file.name}`,
        file,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSendingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen || !canChat) return null;

  return (
    <div className="fixed bottom-0 right-0 z-40 flex h-[500px] w-full max-w-[400px] flex-col overflow-hidden rounded-tl-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:bottom-4 sm:right-4 sm:rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {activeChannel && (
            <button
              onClick={() => setActiveChannel(null)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {activeChannel ? `# ${activeChannel.name}` : 'Chat'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {!activeChannel ? (
        // Channel list
        <div className="flex-1 overflow-y-auto p-2">
          {channels.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">No channels available</p>
          ) : (
            channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-900/30">
                  #
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{ch.name}</p>
                  {ch.description && (
                    <p className="truncate text-xs text-gray-500">{ch.description}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        // Messages
        <>
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No messages yet</p>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} className={`mb-3 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      isMine
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                    }`}>
                      {!isMine && msg.sender && (
                        <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                          {msg.sender.name ?? msg.sender.email}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                      {msg.file_url && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mt-1 inline-block text-xs underline ${isMine ? 'text-blue-200' : 'text-blue-600'}`}
                        >
                          {msg.file_name ?? 'Download file'}
                        </a>
                      )}
                      <p className={`mt-0.5 text-[10px] ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatRelative(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingFile}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800"
                aria-label="Attach file"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-300 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-600"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                aria-label="Send"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
