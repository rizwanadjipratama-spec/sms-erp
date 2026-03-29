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

const PANEL_W = 380;
const PANEL_H = 520;

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

  // Drag state
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize position on first open
  useEffect(() => {
    if (isOpen && pos === null) {
      setPos({
        x: window.innerWidth - PANEL_W - 16,
        y: window.innerHeight - PANEL_H - 16,
      });
    }
  }, [isOpen, pos]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => {
        if (!prev) return prev;
        return {
          x: Math.min(prev.x, window.innerWidth - PANEL_W - 8),
          y: Math.min(prev.y, window.innerHeight - PANEL_H - 8),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from header area (not buttons)
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? 0,
      origY: pos?.y ?? 0,
    };
    setIsDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, dragRef.current.origX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - PANEL_H - 8, dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const canChat = useMemo(() => {
    if (!profile?.role) return false;
    return chatService.canUseChat(profile.role);
  }, [profile?.role]);

  useEffect(() => {
    if (!profile?.id || !canChat) return;
    chatService.getChannels(profile.id).then(setChannels);
  }, [profile?.id, canChat]);

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

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!activeChannel) return;
    const unsub = chatService.subscribeToMessages(activeChannel.id, (msg) => {
      setMessages(prev => [...prev, msg]);
      if (profile?.id) chatService.markChannelRead(activeChannel.id, profile.id);
    });
    return unsub;
  }, [activeChannel, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannel || !profile?.id) return;
    const content = input.trim();
    setInput('');
    await chatService.sendMessage({ channelId: activeChannel.id, senderId: profile.id, content });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel || !profile?.id) return;
    setSendingFile(true);
    try {
      await chatService.sendMessage({ channelId: activeChannel.id, senderId: profile.id, content: `Shared a file: ${file.name}`, file });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSendingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen || !canChat || !pos) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${PANEL_W}px`,
        height: `${PANEL_H}px`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid #E5E5EA',
        boxShadow: isDragging
          ? '0 20px 60px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.08)'
          : '0 12px 40px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.05)',
        borderRadius: '20px',
        transition: isDragging ? 'box-shadow 0.15s' : 'box-shadow 0.15s',
        userSelect: isDragging ? 'none' : 'auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header — draggable */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          background: 'linear-gradient(180deg, #F9F9F9 0%, #F2F2F7 100%)',
          borderBottom: '1px solid #E5E5EA',
          padding: '10px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* Drag indicator */}
        <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: '#D1D1D6',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          {activeChannel && (
            <button
              onClick={() => setActiveChannel(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: '#007AFF',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.2px', margin: 0 }}>
            {activeChannel ? `# ${activeChannel.name}` : 'Messages'}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '4px',
            background: '#E5E5EA',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#8E8E93',
          }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      {!activeChannel ? (
        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F2F7' }}>
          {channels.length === 0 ? (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: '14px', color: '#8E8E93' }}>
              No channels available
            </p>
          ) : (
            <div style={{ padding: '8px' }}>
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '12px',
                    background: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '4px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
                  }}>
                    #
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{ch.name}</p>
                    {ch.description && (
                      <p style={{ fontSize: '13px', color: '#8E8E93', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ch.description}
                      </p>
                    )}
                  </div>
                  <svg style={{ color: '#C7C7CC', flexShrink: 0 }} className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', background: '#FFFFFF' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{
                  width: '24px', height: '24px',
                  border: '2.5px solid #E5E5EA', borderTopColor: '#007AFF',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <p style={{ fontSize: '14px', color: '#8E8E93', margin: 0 }}>No messages yet</p>
                <p style={{ fontSize: '12px', color: '#AEAEB2', marginTop: '4px' }}>Send the first message!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                    <div style={{
                      maxWidth: '75%', padding: '8px 14px',
                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMine ? '#007AFF' : '#E9E9EB',
                      color: isMine ? '#FFFFFF' : '#1C1C1E',
                      WebkitFontSmoothing: 'antialiased',
                    }}>
                      {!isMine && msg.sender && (
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#007AFF', margin: '0 0 2px' }}>
                          {msg.sender.name ?? msg.sender.email}
                        </p>
                      )}
                      <p style={{ fontSize: '15px', lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: isMine ? '#FFFFFF' : '#1C1C1E', fontWeight: 400, letterSpacing: '-0.1px' }}>
                        {msg.content}
                      </p>
                      {msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: '4px', fontSize: '12px', color: isMine ? 'rgba(255,255,255,0.85)' : '#007AFF', textDecoration: 'underline' }}>
                          {msg.file_name ?? 'Download file'}
                        </a>
                      )}
                      <p style={{ fontSize: '11px', margin: '4px 0 0', color: isMine ? 'rgba(255,255,255,0.75)' : '#8E8E93', fontWeight: 400 }}>
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
          <div style={{ borderTop: '1px solid #E5E5EA', padding: '10px 12px', background: '#F9F9F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()} disabled={sendingFile}
              style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#007AFF', flexShrink: 0, opacity: sendingFile ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
              aria-label="Attach file"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1px solid #E5E5EA', background: '#FFFFFF', fontSize: '15px', outline: 'none', color: '#1C1C1E', lineHeight: 1.3 }}
            />
            <button
              onClick={handleSend} disabled={!input.trim()}
              style={{
                background: !input.trim() ? '#C7C7CC' : '#007AFF', border: 'none', borderRadius: '50%',
                width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !input.trim() ? 'default' : 'pointer', flexShrink: 0, transition: 'background 0.2s',
              }}
              aria-label="Send"
            >
              <svg style={{ color: '#FFFFFF', marginLeft: '1px' }} className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
