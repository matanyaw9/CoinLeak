// Text matching for the page search boxes (spec 21): case-insensitive,
// Hebrew and English, ignoring the invisible direction marks banks add and
// extra spaces. Pure functions, no React.

// ALM, LRM, RLM, embeddings and overrides, isolates.
const DIRECTION_MARKS = /[؜‎‏‪-‮⁦-⁩]/g;

/** Text as compared: no direction marks, single spaces, lower case. */
export function foldText(text: string): string {
  return text.replace(DIRECTION_MARKS, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when `text` holds `query`; an empty query fits everything. */
export function hasText(text: string | null | undefined, query: string): boolean {
  const q = foldText(query);
  if (q === "") return true;
  return text != null && foldText(text).includes(q);
}

export interface TextPiece {
  text: string;
  hit: boolean;
}

/** `text` cut around every place it holds `query`, for highlighting. */
export function splitHits(text: string, query: string): TextPiece[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const pieces: TextPiece[] = [];
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) pieces.push({ text: text.slice(from, at), hit: false });
    pieces.push({ text: text.slice(at, at + q.length), hit: true });
    from = at + q.length;
  }
  if (from < text.length) pieces.push({ text: text.slice(from), hit: false });
  return pieces;
}
