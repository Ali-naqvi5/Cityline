/**
 * CMP-01 / SEO-11: a TfL private hire operator may not advertise using "taxi",
 * "cab" or anything that implies a licensed London taxi. This is a licence
 * condition, not a style preference — one stray heading is a compliance failure,
 * so every slug, title, meta description, heading and alt text is checked.
 *
 * Used by the CMS validation hook (ADM-02) and by a CI check over site copy.
 */

/** Matched on word boundaries, so "cabin" and "cabinet" are fine but "cab" is not. */
const FORBIDDEN = [
  "taxi",
  "taxis",
  "taxicab",
  "taxicabs",
  "cab",
  "cabs",
  "cabbie",
  "cabbies",
  "minicab",
  "minicabs",
  "hackney carriage",
  "hackney carriages",
  "black cab",
  "black cabs",
] as const;

export type ForbiddenWord = (typeof FORBIDDEN)[number];

export interface ForbiddenWordHit {
  word: ForbiddenWord;
  /** Character offset in the original text, for highlighting in the admin. */
  index: number;
}

/**
 * Treat hyphens, underscores and slashes as spaces so slugs
 * ("heathrow-taxi-transfer") are caught the same as prose.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[-_/.]+/g, " ");
}

export function findForbiddenWords(text: string): ForbiddenWordHit[] {
  if (!text) return [];
  const haystack = normalise(text);
  const hits: ForbiddenWordHit[] = [];

  for (const word of FORBIDDEN) {
    // String.raw, so the \p escapes reach the regex engine intact.
    const pattern = new RegExp(
      String.raw`(?<![\p{L}\p{N}])` + word + String.raw`(?![\p{L}\p{N}])`,
      "giu",
    );
    for (const match of haystack.matchAll(pattern)) {
      if (match.index !== undefined) hits.push({ word, index: match.index });
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

export function containsForbiddenWord(text: string): boolean {
  return findForbiddenWords(text).length > 0;
}

/**
 * Message shown to an editor who pastes competitor copy into the CMS.
 * Returns null when the text is clean.
 */
export function forbiddenWordError(text: string, field = "This field"): string | null {
  const hits = findForbiddenWords(text);
  if (hits.length === 0) return null;

  const words = [...new Set(hits.map((h) => h.word))].join(", ");
  return (
    `${field} contains wording a licensed private hire operator may not use: ${words}. ` +
    `Use "transfer", "private hire" or "chauffeur" instead (TfL condition, CMP-01).`
  );
}
