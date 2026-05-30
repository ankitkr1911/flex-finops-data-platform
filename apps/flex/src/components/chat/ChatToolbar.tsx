import { Check, Copy, Download, FileJson, Plus, Share2 } from 'lucide-react';
import { useState } from 'react';
import { copyMarkdownToClipboard, downloadMarkdown } from '../../lib/chat/exportMarkdown';
import { downloadChatAsPdf } from '../../lib/chat/exportPdf';
import { shareChat } from '../../lib/chat/shareChat';
import type { ChatSession } from '../../types/chat';

interface ChatToolbarProps {
  session: ChatSession | null;
  onNewChat?: () => void;
}

export function ChatToolbar({ session, onNewChat }: ChatToolbarProps) {
  const [toast, setToast] = useState<string | null>(null);

  if (!session || session.messages.length === 0) {
    if (!onNewChat) return null;
    return (
      <button
        type="button"
        onClick={onNewChat}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-accent border border-flex-accent/30 hover:bg-flex-accent/10 transition-colors"
        title="Start a new chat"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">New chat</span>
      </button>
    );
  }

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {toast && (
        <span className="flex items-center gap-1 text-[10px] text-flex-success mr-2 animate-chat-fade-in">
          <Check className="w-3 h-3" />
          {toast}
        </span>
      )}
      {onNewChat && (
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-accent border border-flex-accent/30 hover:bg-flex-accent/10 transition-colors"
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          downloadMarkdown(session);
          flash('Downloaded .md');
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 transition-colors"
        title="Download chat as Markdown"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">MD</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = downloadChatAsPdf(session);
          flash(ok ? 'Opened print for PDF' : 'Popup blocked');
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 transition-colors"
        title="Download chat as PDF"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await copyMarkdownToClipboard(session);
          flash(ok ? 'Copied markdown' : 'Copy failed');
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 transition-colors"
        title="Copy chat as Markdown"
      >
        <Copy className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Copy</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([JSON.stringify(session, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `flex-ai-${session.id.slice(0, 8)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          flash('Exported JSON');
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 transition-colors"
        title="Export chat as JSON"
      >
        <FileJson className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">JSON</span>
      </button>
      <button
        type="button"
        onClick={async () => {
          const url = `${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(
            session.id
          )}`;
          const result = await shareChat(session, url);
          if (result === 'shared') flash('Shared');
          else if (result === 'copied') flash('Copied for sharing');
          else flash('Share unavailable');
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-flex-muted hover:text-flex-accent hover:bg-flex-accent/10 transition-colors"
        title="Share chat"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>
    </div>
  );
}
