// Lesson checks for every skill: each question has a lesson, it builds, it ends by stating the
// right answer, no text says "undefined"/"NaN", board timings fit the steps, and no "slip" note
// matches the correct answer.
//   node scripts/check-lessons.ts [skill-id-prefix] [--show]
import { allSkills } from '../src/core/areas/index.ts';
import { makeQuestion } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
import { isCorrect, valueOf, type Question } from '../src/core/question.ts';
import { STEP_KEYS, type Lesson } from '../src/core/teach/types.ts';
import { lessonOf } from '../src/core/teach/index.ts';

export interface Problem {
  skill: string;
  prompt: string;
  issue: string;
}

const norm = (s: string) => s.replace(/(\d),(?=\d)/g, '$1').replace(/−/g, '-').replace(/\s+/g, '').replace(/₹/g, '').toLowerCase();

/** Does the last step state the answer? */
export function statesAnswer(q: Pick<Question, 'answer'>, l: Lesson): boolean {
  const last = l.steps[l.steps.length - 1];
  const text = [last.say, ...(last.math ?? []), last.after ?? ''].join(' ');
  const a = norm(q.answer);
  if (norm(text).includes(a)) return true;
  // Two answers ("−3,2"): both stated.
  const raw = q.answer.replace(/−/g, '-').replace(/\s+/g, '');
  if (/^-?\d+(,-?\d+)+$/.test(raw)) {
    const said = (text.replace(/−/g, '-').match(/-?\d+/g) ?? []).map(Number);
    return raw.split(',').every((x) => said.includes(Number(x)));
  }
  // Same value written another way (e.g. 12.50 for 12.5, 1 1/2 for 3/2).
  const va = valueOf(q.answer);
  if (!Number.isFinite(va)) return false;
  const nums = text.replace(/−/g, '-').match(/-?\d+(?:\.\d+)?(?:\s\d+\/\d+|\/\d+)?/g) ?? [];
  return nums.some((m) => Math.abs(valueOf(m) - va) < 1e-9);
}

export function checkLesson(skill: string, q: Question): Problem[] {
  const out: Problem[] = [];
  const p = (issue: string) => out.push({ skill, prompt: q.prompt, issue });
  if (!q.teach) {
    p('no lesson');
    return out;
  }
  let l: Lesson;
  try {
    q.teach();
    l = lessonOf(q);
  } catch (e) {
    p(`throws: ${(e as Error).message}`);
    return out;
  }
  if (!l.steps.length) p('no steps');
  else if (!l.steps[l.steps.length - 1].end) p('last step is not the answer step');
  if (l.steps.length && !statesAnswer(q, l)) p(`answer ${q.answer} not in last step: "${[l.steps[l.steps.length - 1].say, ...(l.steps[l.steps.length - 1].math ?? [])].join(' | ')}"`);
  const all = JSON.stringify(l);
  for (const bad of ['undefined', 'NaN', 'Infinity', '[object']) if (all.includes(bad)) p(`text contains ${bad}`);
  if (/\d-\d/.test(l.steps.map((s) => [s.say, ...(s.math ?? [])].join(' ')).join(' '))) p('ASCII minus between digits');
  // Board timings within the steps.
  const n = l.steps.length;
  const keys = new Set<string>(STEP_KEYS);
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (keys.has(k) && typeof x === 'number' && (x < 0 || x > n)) p(`board ${k}=${x} outside ${n} steps`);
        walk(x);
      }
  };
  if (l.board) walk(l.board);
  for (const s of l.slips ?? []) if (isCorrect(q, s.answer)) p(`slip note matches the right answer (${s.answer}): ${s.note}`);
  if (l.steps.length > 9) p(`long lesson: ${l.steps.length} steps`);
  return out;
}

const isMain = process.argv[1]?.endsWith('check-lessons.ts');
if (isMain) {
  const only = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '';
  const show = process.argv.includes('--show');
  let total = 0;
  const bySkill = new Map<string, Problem[]>();
  for (const s of allSkills().filter((x) => x.id.startsWith(only))) {
    const rng = createRng(`lessons:${s.id}`);
    const probs: Problem[] = [];
    for (let i = 0; i < 60; i++) {
      const q = makeQuestion(s, rng, [0, 0.3, 0.6, 1][i % 4], new Set());
      probs.push(...checkLesson(s.id, q));
      total++;
      if (show && i < 2) {
        const l = q.teach?.();
        console.log(`\n── ${s.id}: ${q.prompt}  [${q.answer}]`);
        l?.steps.forEach((st, k) => console.log(`  ${k + 1}. ${st.say}${st.math ? '  ⟨' + st.math.join(' | ') + '⟩' : ''}${st.after ? '  ' + st.after : ''}`));
      }
    }
    if (probs.length) bySkill.set(s.id, probs);
  }
  const missing = [...bySkill].filter(([, ps]) => ps.some((x) => x.issue === 'no lesson'));
  console.log(`\nChecked ${total} questions. Skills with problems: ${bySkill.size} (no lesson: ${missing.length}).`);
  for (const [id, ps] of bySkill) {
    const kinds = new Map<string, Problem>();
    for (const x of ps) if (!kinds.has(x.issue.slice(0, 40))) kinds.set(x.issue.slice(0, 40), x);
    if ([...kinds.values()].every((x) => x.issue === 'no lesson')) continue;
    console.log(`  ${id}: ${[...kinds.values()].slice(0, 3).map((x) => `${x.issue} — "${x.prompt}"`).join(' ‖ ')}`);
  }
  if (missing.length) console.log(`  No lesson yet: ${missing.map(([id]) => id).join(', ')}`);
}
