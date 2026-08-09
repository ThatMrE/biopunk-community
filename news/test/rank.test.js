import test from 'node:test';
import assert from 'node:assert/strict';
import { hotScore, rankStories, ageInHours, GRAVITY, AGE_OFFSET_HOURS } from '../src/rank.js';

const NOW = 1_700_000_000;
const hoursAgo = (h) => NOW - h * 3600;

test('score decays with age at the configured gravity', () => {
  const fresh = hotScore({ points: 101, created_at: hoursAgo(1), comment_count: 0 }, NOW);
  const old = hotScore({ points: 101, created_at: hoursAgo(24), comment_count: 0 }, NOW);
  assert.ok(fresh > old);
  assert.equal(fresh, 100 / (1 + AGE_OFFSET_HOURS) ** GRAVITY);
});

test('the submitter seed vote does not count toward score', () => {
  assert.equal(hotScore({ points: 1, created_at: NOW, comment_count: 0 }, NOW), 0);
});

test('discussion nudges a story up, but less than an upvote does', () => {
  const base = { created_at: hoursAgo(3), points: 11 };
  const quiet = hotScore({ ...base, comment_count: 0 }, NOW);
  const busy = hotScore({ ...base, comment_count: 8 }, NOW);
  const upvoted = hotScore({ ...base, points: 19, comment_count: 0 }, NOW);
  assert.ok(busy > quiet);
  assert.ok(upvoted > busy);
});

test('flags penalise a story multiplicatively', () => {
  const clean = hotScore({ points: 51, created_at: hoursAgo(2), flag_count: 0 }, NOW);
  const flagged = hotScore({ points: 51, created_at: hoursAgo(2), flag_count: 2 }, NOW);
  assert.ok(flagged < clean / 3);
});

test('ageInHours never goes negative for clock skew', () => {
  assert.equal(ageInHours(NOW + 500, NOW), 0);
});

test('rankStories orders by score, newest breaking ties', () => {
  const ranked = rankStories(
    [
      { id: 1, points: 6, created_at: hoursAgo(10), comment_count: 0 },
      { id: 2, points: 60, created_at: hoursAgo(10), comment_count: 0 },
      { id: 3, points: 60, created_at: hoursAgo(1), comment_count: 0 },
    ],
    NOW,
  );
  assert.deepEqual(ranked.map((s) => s.id), [3, 2, 1]);
});

test('a single domain cannot own the whole page', () => {
  const items = [
    { id: 1, points: 100, created_at: hoursAgo(2), domain: 'megajournal.com' },
    { id: 2, points: 95, created_at: hoursAgo(2), domain: 'megajournal.com' },
    { id: 3, points: 90, created_at: hoursAgo(2), domain: 'megajournal.com' },
    { id: 4, points: 70, created_at: hoursAgo(2), domain: 'smalllab.org' },
  ];
  const ranked = rankStories(items, NOW);
  assert.equal(ranked[0].id, 1, 'the best story from a domain keeps its place');
  assert.equal(ranked[1].id, 4, 'a lower-scoring story from another domain jumps the repeats');
  assert.deepEqual(ranked.map((s) => s.id), [1, 4, 2, 3], 'repeats are demoted progressively');
});

test('rankStories does not mutate its input', () => {
  const items = [{ id: 1, points: 10, created_at: hoursAgo(1), domain: 'a.com' }];
  rankStories(items, NOW);
  assert.equal(items[0].score, undefined);
});
