import type { ChatMessage, ChatSession } from '../../types/chat';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMessage(message: ChatMessage): string {
  const role = message.role === 'user' ? 'You' : 'Flex AI';
  const created = new Date(message.createdAt).toLocaleString();
  const content = escapeHtml(message.content).replaceAll('\n', '<br />');
  return `
    <article class="msg">
      <header>
        <strong>${escapeHtml(role)}</strong>
        <span>${escapeHtml(created)}</span>
      </header>
      <div class="body">${content}</div>
    </article>
  `;
}

function buildPrintableHtml(session: ChatSession): string {
  const title = escapeHtml(session.title);
  const exportedAt = escapeHtml(new Date().toLocaleString());
  const messageHtml = session.messages.map(renderMessage).join('\n');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Flex AI Chat Export</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      .meta { color: #475569; margin-bottom: 22px; font-size: 12px; }
      .msg { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
      .msg header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #334155; }
      .msg .body { font-size: 14px; line-height: 1.5; white-space: normal; }
    </style>
  </head>
  <body>
    <h1>Flex AI - ${title}</h1>
    <div class="meta">Exported ${exportedAt}</div>
    ${messageHtml}
  </body>
</html>`;
}

export function downloadChatAsPdf(session: ChatSession): boolean {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=860');
  if (!win) return false;
  win.document.open();
  win.document.write(buildPrintableHtml(session));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
