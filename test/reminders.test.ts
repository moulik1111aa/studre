// Phone reminders: melt-watch notes follow the jar and the day, backups come due, widget data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { DEFAULT_REMINDERS, backupDue, jarOn, planReminders, widgetFacts, widgetKid, type PlanInput, type RemindChild } from '../src/core/reminders.ts';
import { REWARDS, costOf } from '../src/core/rewards.ts';

const FACTS = ['Octopuses have three hearts.', 'Honey never spoils.', 'A day on Venus is longer than its year.'];
const treat = REWARDS.find((r) => r.tier === 'small')!;

const kid = (lastPlay: string | null, coins = 60): RemindChild => {
  const c = newChild('Riya', 8, 0, '2026-10-01');
  c.wallet.treat.rewardId = treat.id;
  c.wallet.treat.coins = coins;
  c.wallet.lastPlayDay = lastPlay;
  if (lastPlay) c.stats.secondsByDay[lastPlay] = 600;
  return { id: c.id, name: 'Riya', avatar: '🦁', wallet: c.wallet, stats: c.stats };
};
const input = (children: RemindChild[], now: Date, today: string, extra: Partial<PlanInput> = {}): PlanInput => ({ children, settings: DEFAULT_REMINDERS, holiday: false, backupSnoozeUntil: 0, facts: FACTS, now, today, ...extra });

test('the jar on a day: melting only after a full day without play', () => {
  const c = kid('2026-10-25');
  const same = jarOn(c, '2026-10-25', '2026-10-25')!;
  assert.equal(same.played, true);
  assert.equal(same.missed, 0);
  const next = jarOn(c, '2026-10-26', '2026-10-25')!;
  assert.equal(next.missed, 0);
  const later = jarOn(c, '2026-10-27', '2026-10-25')!;
  assert.equal(later.missed, 1);
  assert.ok(later.pct < next.pct);
  assert.equal(next.pct, Math.floor((100 * 60) / costOf(treat)));
});

test('three notes a day, from now on, each with a fact; played today turns the evening into a well done', () => {
  const now = new Date(2026, 9, 26, 9, 0); // 9 am: the 8 am note has passed
  const items = planReminders(input([kid('2026-10-25')], now, '2026-10-26'));
  const today = items.filter((i) => new Date(i.at).getDate() === 26);
  assert.equal(today.length, 2);
  assert.ok(items.every((i) => i.text.includes('Did you know?')));
  assert.ok(items.every((i) => i.at > now.getTime()));
  // Played today: no afternoon nag, an evening cheer.
  const played = planReminders(input([kid('2026-10-26')], now, '2026-10-26')).filter((i) => new Date(i.at).getDate() === 26);
  assert.equal(played.length, 1);
  assert.match(played[0].text, /frozen|cold|safe/i);
  // Two a day.
  const two = planReminders(input([kid('2026-10-25')], now, '2026-10-26', { settings: { ...DEFAULT_REMINDERS, perDay: 2 } }));
  assert.ok(two.filter((i) => i.kind === 'melt').length <= 2 * 5);
});

test('a morning after a missed day says how much melted', () => {
  const now = new Date(2026, 9, 26, 7, 0);
  const items = planReminders(input([kid('2026-10-24')], now, '2026-10-26'));
  const morning = items.find((i) => new Date(i.at).getHours() === 8 && new Date(i.at).getDate() === 26)!;
  assert.match(morning.text, /melted|gooey|slid|lost/);
});

test('holiday: one fact a day, no melting talk; switched off: no notes', () => {
  const now = new Date(2026, 9, 26, 7, 0);
  const hol = planReminders(input([kid('2026-10-20')], now, '2026-10-26', { holiday: true }));
  assert.ok(hol.length && hol.every((i) => /holiday/i.test(i.text)));
  const off = planReminders(input([kid('2026-10-20')], now, '2026-10-26', { settings: { melt: false, perDay: 3, backup: false } }));
  assert.equal(off.length, 0);
});

test('backups: due after two new play days and a week; the note comes at a grown-up hour', () => {
  const c = kid('2026-10-25');
  c.stats.secondsByDay['2026-10-20'] = 300;
  const now = new Date(2026, 9, 26, 12, 0).getTime();
  assert.equal(backupDue(c, now), true);
  assert.equal(backupDue({ ...c, backupAt: now - 2 * 86_400_000, backupDays: 0 }, now), false);
  assert.equal(backupDue({ ...c, backupAt: 0, backupDays: 2 }, now), false);
  const items = planReminders(input([c], new Date(now), '2026-10-26'));
  const b = items.find((i) => i.kind === 'backup')!;
  assert.ok(b);
  assert.equal(new Date(b.at).getHours(), 19);
  assert.match(b.text, /only on this phone/);
  // Snoozed: not before the snooze ends.
  const snoozed = planReminders(input([c], new Date(now), '2026-10-26', { backupSnoozeUntil: now + 3 * 86_400_000 })).find((i) => i.kind === 'backup')!;
  assert.ok(snoozed.at >= now + 3 * 86_400_000);
});

test('widget data: the jar and a weekly handful of short facts', () => {
  const w = widgetKid(kid('2026-10-25'))!;
  assert.equal(w.reward, treat.name);
  assert.equal(w.cost, costOf(treat));
  assert.equal(w.lastPlay, '2026-10-25');
  const f = widgetFacts(FACTS, '2026-10-26', 2);
  assert.equal(f.length, 2);
  assert.deepEqual(widgetFacts(FACTS, '2026-10-27', 2), f);
});
