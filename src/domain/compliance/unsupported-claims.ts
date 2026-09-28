/**
 * Claims the system cannot keep, blocked at build time.
 *
 * **Flight tracking will never be built.** Cityline confirmed this on
 * 20 September 2026 and reaffirmed it on 22 September 2026 as a permanent
 * decision — not now, not later. It also matches the project spec's scope
 * rules, which list "no automatic flight tracking" among the things that are
 * out of scope.
 *
 * The reason this is a check rather than a note: the supplied designs promise
 * it on at least seven pages, in phrases like "we monitor flight BA 1392 via
 * live radar" and "your chauffeur's arrival time adjusts automatically". Most
 * of those pages are still to be built, and the copy would arrive with them.
 * A note in a document does not stop that; a failing build does.
 *
 * What Cityline actually does, and what the site may say: the customer gives a
 * flight number, a person checks the arrival time before the driver is sent,
 * and free waiting runs from the time the aircraft lands. That is a real
 * service and describing it is fine. Claiming a system is watching the flight
 * is not.
 *
 * Denials are allowed. "We do not track your flight automatically" is a
 * sentence the site should be able to write, so a negation immediately before
 * the claim excuses it.
 */
export interface UnsupportedClaim {
  id: string;
  /** How the designs phrase it. Case-insensitive. */
  pattern: RegExp;
  /** What to write instead. */
  instead: string;
}

export const UNSUPPORTED_CLAIMS: readonly UnsupportedClaim[] = [
  {
    id: "flight-radar",
    pattern: /\b(flight|live|air\s?traffic)\s*radar\b|\bradar\s+(feed|tracking)/i,
    instead:
      "Say the office checks your arrival time before sending your driver. There is no radar.",
  },
  {
    id: "flight-monitoring",
    pattern: /\bflight\s+(monitoring|tracking)\b/i,
    instead:
      'Say "we check your flight before your driver is sent" — a person does it, not a system.',
  },
  {
    id: "we-monitor-your-flight",
    pattern:
      /\b(we|our\s+(?:team|dispatch|system)\w*)\s+(monitor|monitors|track|tracks)\b[^.!?]{0,40}\bflight/i,
    instead:
      'Describe the manual check: "our team checks your flight\'s arrival time before dispatch".',
  },
  {
    id: "flight-is-monitored",
    pattern: /\bflights?\b[^.!?]{0,40}\b(is|are)\s+(monitored|tracked)\b/i,
    instead: "Passive voice does not make it true. Describe the manual check instead.",
  },
  {
    id: "automatic-adjustment",
    pattern:
      /\b(arrival|pickup|collection)\s+time[^.!?]{0,40}\badjusts?\s+automatically\b|\bautomatically\s+(adjusts?|shifts?)\b[^.!?]{0,40}\b(pickup|arrival|schedule)/i,
    instead:
      "Nothing adjusts automatically. Staff move the pickup after checking the flight.",
  },
  {
    id: "delay-guarantee",
    pattern: /\bflight\s+delay\s+(protection|guarantee)\b|\bdelay\s+buffer\b/i,
    instead:
      "Say what is actually offered: free waiting time counted from when the aircraft lands.",
  },
];

/**
 * A negation in the few words immediately before the claim.
 *
 * Deliberately a narrow window rather than the whole sentence. Scanning the
 * whole sentence looked simpler and was wrong twice: "arrival time adjusts
 * automatically at **no** extra charge" and "we track your flight so you
 * **never** have to worry" are both promises, and both contain a negation
 * somewhere in them. What matters is whether the negation attaches to the
 * claim, not whether one appears nearby.
 */
const NEGATION = /\b(no|not|never|without|cannot|can't|don't|doesn't)\b[^.!?]{0,30}$/i;

export interface ClaimHit {
  id: string;
  /** The sentence the claim was found in, trimmed. */
  sentence: string;
  instead: string;
}

export function findUnsupportedClaims(text: string): ClaimHit[] {
  if (!text) return [];

  const hits: ClaimHit[] = [];

  // Sentence by sentence, so a denial elsewhere in the file cannot excuse a
  // claim here, and a denial here is not reported as one.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n/)) {
    for (const claim of UNSUPPORTED_CLAIMS) {
      const match = claim.pattern.exec(sentence);
      if (match) {
        // Is this sentence denying the claim rather than making it?
        if (NEGATION.test(sentence.slice(0, match.index))) continue;

        hits.push({
          id: claim.id,
          sentence: sentence.trim().slice(0, 140),
          instead: claim.instead,
        });
      }
    }
  }

  return hits;
}

export function claimsUnsupportedCapability(text: string): boolean {
  return findUnsupportedClaims(text).length > 0;
}
