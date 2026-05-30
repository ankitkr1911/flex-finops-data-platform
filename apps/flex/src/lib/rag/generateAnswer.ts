import type { RetrievedChunk } from './types';
import { synthesizeResponse } from './synthesize';

function humanize(answer: string): string {
  let text = answer;
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\bTop retrieved context\b:?/gi, 'What I checked');
  text = text.replace(/\s\|\s/g, ', ');

  if (/What I checked/i.test(text)) {
    text = text.replace(
      /What I checked[\s\S]*$/i,
      'I can also share the exact records behind this if you want to audit the details.'
    );
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function generateAnswer(query: string, sources: RetrievedChunk[]): string {
  return humanize(synthesizeResponse(query, sources));
}
