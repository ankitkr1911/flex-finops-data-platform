import { copyMarkdownToClipboard, sessionToMarkdown } from './exportMarkdown';
import type { ChatSession } from '../../types/chat';

export async function shareChat(
  session: ChatSession,
  shareUrl?: string
): Promise<'shared' | 'copied' | 'failed'> {
  const body = sessionToMarkdown(session);
  const text = shareUrl ? `${body}\n\nOpen in Flex: ${shareUrl}` : body;
  const title = `Flex AI: ${session.title}`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url: shareUrl });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'failed';
    }
  }

  const ok = await copyMarkdownToClipboard(session);
  return ok ? 'copied' : 'failed';
}
