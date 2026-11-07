// Phone reminders: the daily learning-time note, reward ready, backups coming due, widget data.
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

test('learning time: one note a day at the chosen time, naming who has not played, with a fact', () => {
  const now = new Date(2026, 9, 26, 9, 0);
  const items = planReminders(input([kid('2026-10-25')], now, '2026-10-26')).filter((i) => i.kind === 'daily');
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => new Date(i.at).getHours() === 17 && i.text.includes('Riya') && i.text.includes('Did you know?')));
  // Played today: no note today, the rest stay.
  const played = planReminders(input([kid('2026-10-26')], now, '2026-10-26')).filter((i) => i.kind === 'daily');
  assert.equal(played.length, 4);
  assert.ok(played.every((i) => new Date(i.at).getDate() !== 26));
  // Another time; and after today's time has passed, it starts tomorrow.
  const at730 = planReminders(input([kid('2026-10-25')], now, '2026-10-26', { settings: { ...DEFAULT_REMINDERS, dailyAt: '07:30' } })).filter((i) => i.kind === 'daily');
  assert.equal(new Date(at730[0].at).getDate(), 27);
  assert.equal(new Date(at730[0].at).getMinutes(), 30);
});

test('reward ready: a full jar gets a note at a parent hour for three days', () => {
  const now = new Date(2026, 9, 26, 9, 0);
  const c = kid('2026-10-26', 400);
  c.wallet.treat.waiting = true;
  const ready = planReminders(input([c], now, '2026-10-26')).filter((i) => i.kind === 'ready');
  assert.equal(ready.length, 3);
  assert.equal(new Date(ready[0].at).getHours(), 18);
  assert.match(ready[0].text, /Riya’s .* is ready/);
  assert.match(ready[0].text, /Given/);
  assert.equal(planReminders(input([kid('2026-10-26')], now, '2026-10-26')).filter((i) => i.kind === 'ready').length, 0);
});

test('pause rewards: no learning-time notes; all switched off: no notes; old saves: no jar notes', () => {
  const now = new Date(2026, 9, 26, 7, 0);
  assert.equal(planReminders(input([kid('2026-10-20')], now, '2026-10-26', { holiday: true })).filter((i) => i.kind === 'daily').length, 0);
  const off = planReminders(input([kid('2026-10-20')], now, '2026-10-26', { settings: { daily: false, dailyAt: '17:00', ready: false, backup: false } }));
  assert.equal(off.length, 0);
  const old = planReminders(input([kid('2026-10-20')], now, '2026-10-26', { settings: { melt: true, perDay: 3, backup: false } as never }));
  assert.ok(old.every((i) => i.kind === 'daily'));
});

test('backups: due after two new play days and a week; the note comes at a parent hour', () => {
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

test('no note at bedtime', () => {
  const now = new Date(2026, 9, 26, 9, 0);
  const late = { ...DEFAULT_REMINDERS, dailyAt: '20:00' };
  const bed = { on: true, from: '19:00', to: '07:00' };
  assert.equal(planReminders(input([kid('2026-10-25')], now, '2026-10-26', { settings: late })).filter((i) => i.kind === 'daily').length, 5);
  assert.equal(planReminders(input([kid('2026-10-25')], now, '2026-10-26', { settings: late, quiet: { bed } })).filter((i) => i.kind === 'daily').length, 0);
});
