/**
 * Front page ranking.
 *
 * The base is the classic Hacker News formula — points decaying against age
 * raised to a gravity exponent — with two adjustments that suit a feed of
 * biotech links: a small bonus for stories that are actually being discussed,
 * and a penalty for stories that pile up flags or repeat a domain that is
 * already sitting on the front page.
 */

export const GRAVITY = 1.8;
export const AGE_OFFSET_HOURS = 2;
/** How much a comment is worth relative to an upvote when ranking. */
export const DISCUSSION_WEIGHT = 0.25;
/** Multiplier applied per extra story from the same domain in the candidate set. */
export const DOMAIN_DIVERSITY_PENALTY = 0.65;
export const FLAG_PENALTY = 0.5;

export function ageInHours(createdAt, now) {
  return Math.max(0, (now - createdAt) / 3600);
}

/**
 * Score a single item. `points` is the vote count, everything else optional.
 */
export function hotScore(item, now = Math.floor(Date.now() / 1000)) {
  const points = Math.max(0, (item.points ?? 1) - 1);
  const discussion = DISCUSSION_WEIGHT * (item.comment_count ?? 0);
  const hours = ageInHours(item.created_at ?? now, now);
  const decay = (hours + AGE_OFFSET_HOURS) ** GRAVITY;
  let score = (points + discussion) / decay;
  if (item.flag_count) score *= FLAG_PENALTY ** item.flag_count;
  return score;
}

/**
 * Rank a candidate list. Returns a new array sorted by score, with repeated
 * domains progressively demoted so one outlet cannot own the front page.
 */
export function rankStories(items, now = Math.floor(Date.now() / 1000)) {
  const byScore = items
    .map((item) => ({ ...item, score: hotScore(item, now) }))
    .sort(compareScore);

  // Walk the ranked list top-down so the *best* story from a domain keeps its
  // score and only the follow-ups get demoted.
  const seenDomain = new Map();
  for (const item of byScore) {
    if (!item.domain) continue;
    const seen = seenDomain.get(item.domain) ?? 0;
    item.score *= DOMAIN_DIVERSITY_PENALTY ** seen;
    seenDomain.set(item.domain, seen + 1);
  }
  return byScore.sort(compareScore);
}

function compareScore(a, b) {
  return b.score - a.score || b.created_at - a.created_at || b.id - a.id;
}
