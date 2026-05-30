import {
  Database,
  Download,
  MessageSquare,
  PanelLeft,
  Pin,
  Plus,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMoreMenu } from '../components/chat/ChatMoreMenu';
import { ChatToolbar } from '../components/chat/ChatToolbar';
import { ScrollToBottom } from '../components/chat/ScrollToBottom';
import { SessionSearch } from '../components/chat/SessionSearch';
import { SuggestedPrompts } from '../components/chat/SuggestedPrompts';
import { downloadChatAsPdf } from '../lib/chat/exportPdf';
import { shareChat } from '../lib/chat/shareChat';
import { filterSessions } from '../lib/chat/sessionUtils';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useRagChat } from '../hooks/useRagChat';

export function AIAssistant() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    messages,
    isProcessing,
    knowledgeChunkCount,
    sendMessage,
    startNewChat,
    selectSession,
    deleteSession,
    stopStreaming,
    setMessageFeedback,
    setMessageComment,
    regenerateLastResponse,
    clearConversation,
    renameSession,
    togglePinSession,
    duplicateSession,
    lastAssistantMessageId,
    executeChatAction,
  } = useRagChat();

  const location = useLocation();
  const aiQueryHandled = useRef(false);
  const linkedChatHandled = useRef(false);

  const { isMobile, isTablet } = useBreakpoint();
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionQuery, setSessionQuery] = useState('');
  const [quickToast, setQuickToast] = useState<string | null>(null);
  const filteredSessions = useMemo(
    () => filterSessions(sessions, sessionQuery),
    [sessions, sessionQuery]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;
  const showSidebar = !isMobile;
  const hasExportableChat = !!activeSession && activeSession.messages.length > 0;

  const flash = (msg: string) => {
    setQuickToast(msg);
    window.setTimeout(() => setQuickToast(null), 2200);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isMobile) setSessionsOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const aiQuery = (location.state as { aiQuery?: string } | null)?.aiQuery;
    if (!aiQuery || aiQueryHandled.current || isProcessing) return;
    aiQueryHandled.current = true;
    void sendMessage(aiQuery);
    window.history.replaceState({}, document.title);
  }, [location.state, isProcessing, sendMessage]);

  useEffect(() => {
    if (linkedChatHandled.current) return;
    const params = new URLSearchParams(location.search);
    const linkedChatId = params.get('chat');
    if (!linkedChatId || !sessions.some((s) => s.id === linkedChatId)) return;
    linkedChatHandled.current = true;
    selectSession(linkedChatId);
  }, [location.search, selectSession, sessions]);

  const sessionList = (
    <>
      <div className="p-3 sm:p-4 border-b border-flex-border/40 shrink-0">
        <button
          type="button"
          onClick={() => {
            startNewChat();
            if (isMobile) setSessionsOpen(false);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-flex-accent/15 text-flex-accent border border-flex-accent/30 text-sm font-medium hover:bg-flex-accent/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>
      <SessionSearch value={sessionQuery} onChange={setSessionQuery} />
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 overscroll-contain">
        {filteredSessions.length === 0 && (
          <p className="px-3 py-4 text-xs text-flex-muted">
            {sessionQuery ? 'No matching chats' : 'No conversations yet'}
          </p>
        )}
        {filteredSessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-1 rounded-lg ${
              s.id === activeSessionId ? 'bg-flex-accent/10' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => {
                selectSession(s.id);
                if (isMobile) setSessionsOpen(false);
              }}
              className={`flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm truncate rounded-lg transition-colors min-w-0 ${
                s.id === activeSessionId
                  ? 'text-flex-accent'
                  : 'text-flex-muted hover:text-slate-200 hover:bg-flex-surface/50'
              }`}
            >
              {s.pinned ? (
                <Pin className="w-3.5 h-3.5 shrink-0 text-flex-accent fill-flex-accent/30" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{s.title}</span>
            </button>
            <button
              type="button"
              onClick={() => togglePinSession(s.id)}
              className="p-1.5 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-flex-muted hover:text-flex-accent transition-all shrink-0"
              aria-label={s.pinned ? 'Unpin' : 'Pin'}
              title={s.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className={`w-3.5 h-3.5 ${s.pinned ? 'fill-flex-accent/40 text-flex-accent' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => deleteSession(s.id)}
              className="p-1.5 mr-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-flex-muted hover:text-flex-danger transition-all shrink-0"
              aria-label="Delete chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-flex-border/40 text-[10px] text-flex-muted space-y-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 shrink-0" />
          <span>{knowledgeChunkCount} knowledge chunks</span>
        </div>
        <p>Flex · EzTrac · dhub-rpt</p>
      </div>
    </>
  );

  return (
    <div className="flex flex-1 min-h-[400px] sm:min-h-[500px] lg:min-h-[600px] h-full">
      {showSidebar && (
        <aside
          className={`shrink-0 border-r border-flex-border/50 glass flex flex-col ${
            isTablet ? 'w-[72px]' : 'w-52 lg:w-56'
          }`}
        >
          {isTablet ? (
            <div className="flex flex-col items-center py-3 gap-2 flex-1">
              <button
                type="button"
                onClick={startNewChat}
                title="New chat"
                className="p-2.5 rounded-xl bg-flex-accent/15 text-flex-accent border border-flex-accent/30 hover:bg-flex-accent/25"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 w-full overflow-y-auto p-1 space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.title}
                    onClick={() => selectSession(s.id)}
                    className={`w-full p-2 rounded-lg flex justify-center ${
                      s.id === activeSessionId
                        ? 'bg-flex-accent/15 text-flex-accent'
                        : 'text-flex-muted hover:bg-flex-surface/50'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            sessionList
          )}
        </aside>
      )}

      {isMobile && sessionsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-label="Close sessions"
            onClick={() => setSessionsOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] glass border-r border-flex-border/50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-flex-border/40">
              <span className="font-display font-semibold text-sm">Chats</span>
              <button
                type="button"
                onClick={() => setSessionsOpen(false)}
                className="p-2 rounded-lg text-flex-muted hover:bg-flex-surface/50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sessionList}
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-b border-flex-border/40 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {isMobile && (
              <button
                type="button"
                onClick={() => setSessionsOpen(true)}
                className="p-2 -ml-1 rounded-lg text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 shrink-0"
                aria-label="Open chats"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-flex-accent/30 to-flex-accent2/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-flex-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-slate-100 truncate">
                Flex AI
              </h1>
              <p className="text-[10px] sm:text-xs text-flex-muted truncate hidden sm:block">
                FinOps, Flex, EzTrac, dhub-rpt squads & live metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ChatToolbar session={activeSession} onNewChat={startNewChat} />
            <ChatMoreMenu
              session={activeSession}
              isProcessing={isProcessing}
              canRegenerate={!!lastAssistantMessageId}
              onRegenerate={regenerateLastResponse}
              onClear={clearConversation}
              onRename={renameSession}
              onDuplicate={() => activeSessionId && duplicateSession(activeSessionId)}
              onTogglePin={() => activeSessionId && togglePinSession(activeSessionId)}
            />
          </div>
        </header>

        <ScrollToBottom containerRef={scrollRef} deps={[messages.length]} />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 print:overflow-visible"
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh] text-center animate-chat-fade-in px-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-flex-accent/20 to-flex-accent2/20 flex items-center justify-center mb-4 sm:mb-6 border border-flex-accent/20">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-flex-accent animate-pulse-soft" />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-100 mb-2">
                Ask anything about your FinOps stack
              </h2>
              <p className="text-xs sm:text-sm text-flex-muted max-w-lg mb-6 sm:mb-8">
                Flex AI knows Flex (this app), EzTrac (finance forecasting tools and initiatives),
                and dhub-rpt / RTP (squads, platforms, who works where). Also cloud spend,
                anomalies, exchange, and how it all fits together.
              </p>
              <SuggestedPrompts onSelect={sendMessage} disabled={isProcessing} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-4 w-full">
              {messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  onFeedback={
                    m.role === 'assistant'
                      ? (fb, note) => setMessageFeedback(m.id, fb, note)
                      : undefined
                  }
                  onComment={
                    m.role === 'assistant' ? (c) => setMessageComment(m.id, c) : undefined
                  }
                  onRegenerate={
                    m.role === 'assistant' && m.id === lastAssistantMessageId
                      ? regenerateLastResponse
                      : undefined
                  }
                  isLastAssistant={
                    m.role === 'assistant' && m.id === lastAssistantMessageId
                  }
                  onExecuteAction={
                    m.role === 'assistant'
                      ? (actionId) => executeChatAction(m.id, actionId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-flex-border/30 bg-flex-bg/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto w-full">
            <div className="mb-2 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-flex-muted truncate">
                  {activeSession?.title ?? 'Start a chat to enable export and sharing'}
                </p>
                {quickToast && <span className="text-[10px] text-flex-success">{quickToast}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] text-flex-accent border border-flex-accent/30 hover:bg-flex-accent/10"
                >
                  New chat
                </button>
                <button
                  type="button"
                  disabled={!hasExportableChat}
                  onClick={() => {
                    if (!activeSession) return;
                    const ok = downloadChatAsPdf(activeSession);
                    flash(ok ? 'Print dialog opened' : 'Popup blocked');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-flex-muted border border-flex-border/60 hover:text-flex-accent hover:border-flex-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={!hasExportableChat}
                  onClick={async () => {
                    if (!activeSession) return;
                    const url = `${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(
                      activeSession.id
                    )}`;
                    const result = await shareChat(activeSession, url);
                    flash(
                      result === 'shared'
                        ? 'Shared'
                        : result === 'copied'
                          ? 'Copied for sharing'
                          : 'Share unavailable'
                    );
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-flex-muted border border-flex-border/60 hover:text-flex-accent hover:border-flex-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                {lastAssistantMessageId && (
                  <>
                    <span className="text-[10px] text-flex-muted ml-1">Feedback</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMessageFeedback(lastAssistantMessageId, 'up');
                        flash('Thanks for the feedback');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-flex-muted hover:text-flex-success hover:bg-flex-success/10"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Helpful
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessageFeedback(lastAssistantMessageId, 'down');
                        flash('Feedback saved');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-flex-muted hover:text-flex-danger hover:bg-flex-danger/10"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      Needs work
                    </button>
                  </>
                )}
              </div>
            </div>
            <ChatComposer
              onSend={sendMessage}
              onStop={stopStreaming}
              disabled={isProcessing}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
