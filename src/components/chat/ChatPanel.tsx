'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatService } from '@/lib/services/chat-service';
import { supabase } from '@/lib/db/client';
import type { ChatChannel, ChatChannelType, ChatMessage, Profile } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PANEL_W = 380;
const PANEL_H = 580;

type ViewState = 'channels' | 'chat' | 'manage' | 'create';

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<ViewState>('channels');
  
  // Data State
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  
  // Loading & Async States
  const [loading, setLoading] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  
  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  
  // Management State
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChatChannelType>('general');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Computed Auth
  const canChat = useMemo(() => profile?.role ? chatService.canUseChat(profile.role) : false, [profile?.role]);
  const isAdminOrOwner = profile?.role === 'admin' || profile?.role === 'owner';

  // Role Colors
  const ROLE_COLORS: Record<string, { bg: string, text: string }> = {
    admin: { bg: '#FEE2E2', text: '#B91C1C' },
    owner: { bg: '#F3E8FF', text: '#7E22CE' },
    marketing: { bg: '#FCE7F3', text: '#BE185D' },
    finance: { bg: '#D1FAE5', text: '#047857' },
    warehouse: { bg: '#FEF3C7', text: '#B45309' },
    technician: { bg: '#DBEAFE', text: '#1D4ED8' },
    tax: { bg: '#ECFDF5', text: '#059669' },
    boss: { bg: '#E0E7FF', text: '#4338CA' },
    client: { bg: '#F3F4F6', text: '#374151' },
    default: { bg: '#F3F4F6', text: '#374151' },
  };

  // --------------------------------------------------------------------------
  // INITS & DRAG HANDLERS
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setPos({ 
        x: Math.max(8, window.innerWidth - PANEL_W - 16), 
        y: Math.max(8, window.innerHeight - PANEL_H - 16) 
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setPos(prev => prev ? {
        x: Math.max(8, Math.min(prev.x, window.innerWidth - PANEL_W - 8)),
        y: Math.max(8, Math.min(prev.y, window.innerHeight - PANEL_H - 8)),
      } : prev);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos?.x ?? 0, origY: pos?.y ?? 0 };
    setIsDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, dragRef.current.origX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - PANEL_H - 8, dragRef.current.origY + dy))
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------
  const loadChannels = useCallback(async () => {
    if (!profile?.id || !canChat) return;
    const chs = await chatService.getChannels(profile.id);
    setChannels(chs);
  }, [profile?.id, canChat]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    setLoading(true);
    const result = await chatService.getMessages(activeChannel.id, { page: 1, pageSize: 50 });
    setMessages(result.data);
    setLoading(false);
    if (profile?.id) chatService.markChannelRead(activeChannel.id, profile.id);
  }, [activeChannel, profile?.id]);

  useEffect(() => { 
    if (view === 'chat' && activeChannel) {
      loadMessages(); 
      setIsSearching(false);
      setSearchQuery('');
      setSearchResults(null);
    }
  }, [view, activeChannel, loadMessages]);

  useEffect(() => {
    if (view !== 'chat' || !activeChannel) return;
    const unsub = chatService.subscribeToMessages(activeChannel.id, async (msg) => {
      // FIX: Realtime payloads lack joined relations. If sender is missing, fetch it!
      if (!msg.sender && msg.sender_id) {
        const { data } = await supabase.from('profiles').select('name, email, avatar_url, role').eq('id', msg.sender_id).single();
        if (data) Object.assign(msg, { sender: data });
      }
      setMessages(prev => [...prev, msg]);
      if (profile?.id) chatService.markChannelRead(activeChannel.id, profile.id);
    });
    return unsub;
  }, [activeChannel, profile?.id, view]);

  useEffect(() => {
    if (!isSearching) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSearching]);

  // Load profiles for management
  useEffect(() => {
    if ((view === 'manage' || view === 'create') && isAdminOrOwner && allProfiles.length === 0) {
      supabase.from('profiles').select('id, name, email, role').then(({ data }) => {
        if (data) setAllProfiles(data as Profile[]);
      });
    }
  }, [view, isAdminOrOwner, allProfiles.length]);

  // Load members for active channel management
  useEffect(() => {
    if (view === 'manage' && activeChannel && isAdminOrOwner) {
      chatService.getChannelMembers(activeChannel.id).then(setChannelMembers);
    }
  }, [view, activeChannel, isAdminOrOwner]);

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!activeChannel || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await chatService.searchMessages(activeChannel.id, searchQuery);
      setSearchResults(res.data);
    } catch(e) { /* ignore */ }
    setLoading(false);
  };

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

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !isAdminOrOwner || !profile) return;
    setLoading(true);
    try {
      const ch = await chatService.createChannel(newChannelName, newChannelType, newChannelDesc);
      await chatService.addMember(ch.id, profile.id); // auto join creator
      await loadChannels();
      setNewChannelName('');
      setNewChannelDesc('');
      setView('channels');
    } catch(err) {
      alert('Error creating channel');
    }
    setLoading(false);
  };

  const handleDeleteChannel = async () => {
    if (!activeChannel || !isAdminOrOwner) return;
    if (!confirm('Are you sure you want to delete this channel? All messages will be lost forever.')) return;
    setLoading(true);
    try {
      await chatService.deleteChannel(activeChannel.id);
      setActiveChannel(null);
      await loadChannels();
      setView('channels');
    } catch(err) {
      alert('Error deleting channel');
    }
    setLoading(false);
  };

  const toggleMember = async (userId: string) => {
    if (!activeChannel || !isAdminOrOwner) return;
    const isMember = channelMembers.includes(userId);
    try {
      if (isMember) {
        await chatService.removeMember(activeChannel.id, userId);
        setChannelMembers(prev => prev.filter(id => id !== userId));
      } else {
        await chatService.addMember(activeChannel.id, userId);
        setChannelMembers(prev => [...prev, userId]);
      }
    } catch(err) {
      alert('Error updating member');
    }
  };

  // --------------------------------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------------------------------
  const getRoleStyle = (role?: string) => ROLE_COLORS[role || ''] || ROLE_COLORS.default;

  const renderMessageList = (msgList: ChatMessage[]) => {
    return msgList.map((msg, index) => {
      const isMine = msg.sender_id === profile?.id;
      const prevMsg = index > 0 ? msgList[index - 1] : null;
      
      // iMessage logic: group consecutive messages by the same sender within 2 mins
      const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id;
      const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : 0;
      const isGrouped = isConsecutive && timeDiff < 2 * 60 * 1000;
      
      // Check if this is the start of a block
      const nextMsg = index < msgList.length - 1 ? msgList[index + 1] : null;
      const isGroupedWithNext = nextMsg && nextMsg.sender_id === msg.sender_id && (new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 2 * 60 * 1000);

      return (
        <div key={msg.id || `msg-${index}`} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: isGroupedWithNext ? '2px' : '10px', gap: '8px' }}>
          
          {/* Avatar for others - only show on last grouped message (or if not grouped) */}
          {!isMine && (
            <div style={{ width: '28px', flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
              {!isGroupedWithNext && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFF', fontSize: '10px', fontWeight: 'bold'
                }}>
                  {msg.sender?.name?.charAt(0).toUpperCase() || msg.sender?.email?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
            
            {/* Sender Header - only show on first grouped message */}
            {!isMine && !isGrouped && msg.sender && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1C1C1E' }}>
                  {msg.sender.name || msg.sender.email}
                </span>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px',
                  background: getRoleStyle(msg.sender.role).bg,
                  color: getRoleStyle(msg.sender.role).text,
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  {msg.sender.role}
                </span>
              </div>
            )}

            {/* Bubble */}
            <div style={{
              padding: '8px 14px',
              borderRadius: isMine 
               ? (isGrouped ? (isGroupedWithNext ? '18px 4px 4px 18px' : '18px 4px 18px 18px') : (isGroupedWithNext ? '18px 18px 4px 18px' : '18px 18px 18px 18px')) 
               : (isGrouped ? (isGroupedWithNext ? '4px 18px 18px 4px' : '4px 18px 18px 18px') : (isGroupedWithNext ? '18px 18px 18px 4px' : '18px 18px 18px 18px')),
              background: isMine ? '#007AFF' : '#E9E9EB',
              color: isMine ? '#FFFFFF' : '#1C1C1E',
              WebkitFontSmoothing: 'antialiased',
            }}>
              <p style={{ 
                fontSize: '15px', lineHeight: 1.4, margin: 0, 
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', 
                color: isMine ? '#FFFFFF' : '#1C1C1E', 
                fontFamily: '"SF Pro Text", "-apple-system", "BlinkMacSystemFont", "Inter", sans-serif',
                fontWeight: 400, letterSpacing: '-0.1px' 
              }}>
                {msg.content}
              </p>
              {msg.file_url && (
                <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: isMine ? 'rgba(255,255,255,0.9)' : '#007AFF', textDecoration: 'underline' }}>
                  📎 {msg.file_name ?? 'Attachment'}
                </a>
              )}
            </div>
            
            {/* Timestamp - only show if disconnected or hover natively */}
            {!isGroupedWithNext && (
              <span style={{ fontSize: '10px', color: '#8E8E93', marginTop: '4px', padding: '0 4px', fontFamily: '"SF Pro Text", "-apple-system", "BlinkMacSystemFont", "Inter", sans-serif' }}>
                {formatRelative(msg.created_at)}
              </span>
            )}
          </div>
        </div>
      );
    });
  };

  if (!canChat) return null;

  const isVisible = isOpen && pos !== null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed', left: pos ? `${pos.x}px` : '0px', top: pos ? `${pos.y}px` : '0px', 
        width: `${PANEL_W}px`, height: `${PANEL_H}px`,
        zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: '#FFFFFF', border: '1px solid #E5E5EA',
        boxShadow: isDragging ? '0 20px 60px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.08)' : (isVisible ? '0 12px 40px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.05)' : 'none'),
        borderRadius: '20px', 
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
        transition: isDragging ? 'none' : 'opacity 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s',
        userSelect: isDragging ? 'none' : 'auto',
        fontFamily: '"SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Inter", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* --------------------------------------------------------------------------
          UNIVERSAL HEADER (Draggable)
          -------------------------------------------------------------------------- */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          background: 'linear-gradient(180deg, #F9F9F9 0%, #F2F2F7 100%)',
          borderBottom: '1px solid #E5E5EA', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
          position: 'relative', zIndex: 10
        }}
      >
        <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#D1D1D6' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flex: 1 }}>
          {view !== 'channels' && (
            <button
              onClick={() => {
                if (view === 'chat') setView('channels');
                else if (view === 'manage') setView('chat');
                else if (view === 'create') setView('channels');
                setIsSearching(false);
              }}
              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#007AFF', display: 'flex', alignItems: 'center', marginLeft: '-8px' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.2px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {view === 'channels' && 'Messages'}
            {view === 'chat' && activeChannel && `# ${activeChannel.name}`}
            {view === 'create' && 'New Channel'}
            {view === 'manage' && activeChannel && `Manage #${activeChannel.name}`}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
          {view === 'channels' && isAdminOrOwner && (
            <button onClick={() => setView('create')} style={{ color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
          )}
          
          {view === 'chat' && !isSearching && (
            <button onClick={() => { setIsSearching(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} style={{ color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </button>
          )}

          {view === 'chat' && isAdminOrOwner && (
            <button onClick={() => setView('manage')} style={{ color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          )}

          <button onClick={onClose} style={{ background: '#E5E5EA', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8E8E93' }}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------------
          SEARCH BAR (Only visible if isSearching && view == 'chat')
          -------------------------------------------------------------------------- */}
      {view === 'chat' && isSearching && (
        <div style={{ padding: '8px 12px', background: '#F2F2F7', borderBottom: '1px solid #E5E5EA', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              ref={searchInputRef}
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Search messages..."
              style={{ width: '100%', padding: '6px 12px 6px 32px', borderRadius: '8px', border: 'none', fontSize: '14px', outline: 'none', fontFamily: '"SF Pro Text", "-apple-system", sans-serif' }}
            />
            <svg style={{ position: 'absolute', left: '10px', top: '8px', color: '#8E8E93', width: '14px', height: '14px' }} fill="none" strokeWidth={2.5} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </div>
          <button onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults(null); }} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          BODY: CHANNELS VIEW
          -------------------------------------------------------------------------- */}
      {view === 'channels' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F2F7' }}>
          {channels.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', color: '#8E8E93', fontWeight: 500, margin: 0 }}>No channels found</p>
              <p style={{ fontSize: '13px', color: '#AEAEB2', marginTop: '4px' }}>You have not been added to any channels.</p>
            </div>
          ) : (
            <div style={{ padding: '12px 12px' }}>
              {channels.map((ch, index) => (
                <button
                  key={ch.id || `channel-${index}`}
                  onClick={() => { setActiveChannel(ch); setView('chat'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 12px',
                    background: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer',
                    textAlign: 'left', marginBottom: '8px', transition: 'background 0.15s, transform 0.1s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9F9F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
                  }}>
                    #
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#1C1C1E', margin: 0, letterSpacing: '-0.3px', fontFamily: '"SF Pro Display", "-apple-system", sans-serif' }}>{ch.name}</p>
                    {ch.description && (
                      <p style={{ fontSize: '13px', color: '#8E8E93', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: '"SF Pro Text", "-apple-system", sans-serif' }}>
                        {ch.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------------
          BODY: CHAT VIEW
          -------------------------------------------------------------------------- */}
      {view === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 4px', background: '#FFFFFF' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{ width: '24px', height: '24px', border: '2.5px solid #E5E5EA', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : searchResults ? (
              searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <p style={{ fontSize: '14px', color: '#8E8E93', margin: 0 }}>No matching messages found</p>
                </div>
              ) : (
                renderMessageList(searchResults)
              )
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ width: '64px', height: '64px', background: '#F2F2F7', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg className="w-8 h-8 text-gray-400" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Start the conversation</p>
                <p style={{ fontSize: '14px', color: '#8E8E93', marginTop: '4px' }}>Say hi to the team!</p>
              </div>
            ) : (
              renderMessageList(messages)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          {!isSearching && (
            <div style={{ borderTop: '1px solid #E5E5EA', padding: '10px 12px', background: '#F9F9F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} disabled={sendingFile} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#8E8E93', flexShrink: 0, opacity: sendingFile ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message"
                style={{ flex: 1, padding: '10px 16px', borderRadius: '20px', border: '1px solid #E5E5EA', background: '#FFFFFF', fontSize: '15px', outline: 'none', color: '#1C1C1E', lineHeight: 1.3, fontFamily: '"SF Pro Text", "-apple-system", sans-serif' }}
              />
              <button
                onClick={handleSend} disabled={!input.trim()}
                style={{
                  background: !input.trim() ? '#E5E5EA' : '#007AFF', color: !input.trim() ? '#8E8E93' : '#FFFFFF',
                  border: 'none', borderRadius: '50%', width: '34px', height: '34px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: !input.trim() ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.2s',
                  transform: input.trim() ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <svg style={{ marginLeft: '1px' }} className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

      {/* --------------------------------------------------------------------------
          BODY: MANAGE VIEW
          -------------------------------------------------------------------------- */}
      {view === 'manage' && activeChannel && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F2F7', padding: '16px' }}>
          
          <div style={{ background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E5EA', marginBottom: '24px' }}>
             <button
               onClick={handleDeleteChannel}
               disabled={loading}
               style={{ width: '100%', padding: '16px', textAlign: 'center', background: 'none', border: 'none', color: '#FF3B30', fontSize: '16px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
               onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
               onMouseLeave={e => (e.currentTarget.style.background = 'none')}
             >
               Delete Channel
             </button>
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px' }}>Manage Members</h4>
          
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E5EA', overflow: 'hidden' }}>
            {allProfiles.length === 0 ? (
              <p style={{ padding: '16px', textAlign: 'center', color: '#8E8E93', fontSize: '14px', margin: 0 }}>Loading users...</p>
            ) : (
              allProfiles.map((p, idx) => {
                if (p.role === 'client') return null;
                const isMember = channelMembers.includes(p.id);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: idx < allProfiles.length - 1 ? '1px solid #F2F2F7' : 'none' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 500, color: '#1C1C1E', margin: 0 }}>{p.name || p.email}</p>
                      <p style={{ fontSize: '13px', color: '#8E8E93', margin: '2px 0 0' }}>{p.role}</p>
                    </div>
                    <button
                      onClick={() => toggleMember(p.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: isMember ? '#F2F2F7' : '#007AFF', color: isMember ? '#FF3B30' : '#FFFFFF',
                        transition: 'background 0.2s, transform 0.1s'
                      }}
                      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {isMember ? 'Remove' : 'Add'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          BODY: CREATE VIEW
          -------------------------------------------------------------------------- */}
      {view === 'create' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F2F7', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #E5E5EA' }}>
            
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', marginBottom: '8px' }}>Channel Name</label>
            <input 
              type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="e.g. Finance Reports"
              style={{ width: '100%', padding: '12px', background: '#F2F2F7', border: '1px solid #E5E5EA', borderRadius: '10px', fontSize: '16px', outline: 'none', marginBottom: '16px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', marginBottom: '8px' }}>Channel Type</label>
            <select
              value={newChannelType} onChange={e => setNewChannelType(e.target.value as ChatChannelType)}
              style={{ width: '100%', padding: '12px', background: '#F2F2F7', border: '1px solid #E5E5EA', borderRadius: '10px', fontSize: '16px', outline: 'none', marginBottom: '16px', WebkitAppearance: 'none' }}
            >
              <option value="general">General</option>
              <option value="marketing">Marketing</option>
              <option value="finance">Finance</option>
              <option value="warehouse">Warehouse</option>
              <option value="technician">Technician</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="tax">Tax</option>
            </select>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', marginBottom: '8px' }}>Description (Optional)</label>
            <input 
              type="text" value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="What's this channel for?"
              style={{ width: '100%', padding: '12px', background: '#F2F2F7', border: '1px solid #E5E5EA', borderRadius: '10px', fontSize: '15px', outline: 'none', marginBottom: '24px' }}
            />

            <button
              onClick={handleCreateChannel} disabled={!newChannelName.trim() || loading}
              style={{
                width: '100%', padding: '14px', background: !newChannelName.trim() ? '#E5E5EA' : '#007AFF',
                color: !newChannelName.trim() ? '#8E8E93' : '#FFFFFF', fontSize: '16px', fontWeight: 600,
                border: 'none', borderRadius: '12px', cursor: !newChannelName.trim() ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
