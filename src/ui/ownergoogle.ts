// The owner area's MN × for Google accounts: who asked for MN ×, who has it (and until when),
// and which phones each of them uses. Anyone may open MN by signing in with Google; MN × is
// what the owner gives. Only the owner's account can see or change these (the cloud's rules
// check it too).

import { esc, type App } from './app.ts';
import { OWNER_EMAIL, type AccessEntry, type AccessRequest, type CheckIn } from '../platform/cloudapi.ts';
import { account, backend, cloudOn, isOwnerAccount, signIn, signOut } from './cloud.ts';
import { googleButton } from './access.ts';
import { popIn, stagger } from '../render/motion.ts';

const DAY = 86_400_000;
const LENGTHS: [number, string][] = [[0, 'No end date'], [30, '30 days'], [90, '90 days'], [365, '1 year']];

const ago = (t: number, now = Date.now()): string => {
  const m = Math.round((now - t) / 60_000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};
const untilText = (u: number): string => (!u ? 'No end date' : u < Date.now() ? `Ended ${new Date(u).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : `Until ${new Date(u).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);

/** Fill `box` with the MN × for Google accounts section (nothing when this build has no Google sign-in). */
export function mountOwnerGoogle(app: App, box: HTMLElement): void {
  if (!cloudOn(app)) return;
  const paint = async () => {
    const who = account(app);
    if (!who || !isOwnerAccount(app)) {
      box.innerHTML = `<div class="card ow-card og-card">
        <h2>MN × for Google accounts</h2>
        <p class="fine">${who ? `Signed in as <b>${esc(who.email)}</b>, which isn’t the owner’s account.` : 'Parents who sign in with Google can ask for MN ×. Sign in with the owner’s account to see their requests.'}</p>
        ${googleButton('og-in')}<p class="fine">Use the owner’s account, ${esc(OWNER_EMAIL)}.</p>
      </div>`;
      box.querySelector('.og-in')!.addEventListener('click', async () => {
        if (who) await signOut(app);
        await signIn(app);
        void paint();
      });
      return;
    }
    box.innerHTML = `<div class="card ow-card og-card"><h2>MN × for Google accounts</h2><p class="fine">Loading…</p></div>`;
    const b = backend(app)!;
    let requests: AccessRequest[] = [];
    let approved: AccessEntry[] = [];
    let checkins: CheckIn[] = [];
    try {
      [requests, approved, checkins] = await Promise.all([b.listRequests(), b.listAccess(), b.listCheckins()]);
    } catch {
      box.innerHTML = `<div class="card ow-card og-card"><h2>MN × for Google accounts</h2><p class="fine">Couldn’t load the lists. Check the internet connection.</p><button class="btn ghost small og-again">Try again</button></div>`;
      box.querySelector('.og-again')!.addEventListener('click', () => void paint());
      return;
    }
    const known = new Set(approved.map((e) => e.email));
    const waiting = requests.filter((r) => !known.has(r.email)).sort((x, y) => y.at - x.at);
    const phonesOf = (email: string) =>
      checkins
        .filter((c) => c.email === email)
        .flatMap((c) => Object.values(c.devices))
        .sort((x, y) => y.at - x.at);
    box.innerHTML = `
      <div class="card ow-card og-card">
        <div class="og-head"><h2>MN × for Google accounts</h2><button class="btn ghost small og-refresh">Refresh</button></div>
        <p class="fine">Signed in as the owner, ${esc(who.email)}.</p>
        <h3 class="og-h">Asking for MN × (${waiting.length})</h3>
        ${waiting.length ? waiting.map((r) => `<div class="og-row og-req" data-uid="${esc(r.uid)}"><div class="og-who"><b>${esc(r.name || r.email)}</b><small>${esc(r.email)} · ${esc(r.phone)} · ${ago(r.at)}</small></div><div class="og-btns"><button class="btn mint small og-ok">Give MN ×</button><button class="btn ghost small og-no">Say no</button></div></div>`).join('') : '<p class="fine">No one is asking.</p>'}
        <h3 class="og-h">Have MN × (${approved.length})</h3>
        ${approved.length ? approved.sort((x, y) => y.addedAt - x.addedAt).map((e) => {
          const phones = phonesOf(e.email);
          return `<div class="og-row og-acc" data-email="${esc(e.email)}"><div class="og-who"><b>${esc(e.name || e.email)}</b><small>${esc(e.email)} · ${untilText(e.until)}</small>${phones.length ? `<small class="og-phones">${phones.map((p) => `📱 ${esc(p.phone)} · ${esc(p.version)} · seen ${ago(p.at)}`).join('<br>')}</small>` : '<small class="og-phones">Not opened yet</small>'}</div><div class="og-btns"><button class="btn ghost small warn og-rm">Turn off</button></div></div>`;
        }).join('') : '<p class="fine">No one yet.</p>'}
        <h3 class="og-h">Give MN × to an email</h3>
        <div class="og-add"><input class="og-email" type="email" placeholder="name@gmail.com" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn small og-add-btn">Give MN ×</button></div>
        <p class="fine">MN × turns on or off on their phones the next time MN checks, a few times a day when online (offline, within 14 days at most).</p>
        <button class="linkish og-out">Sign out of Google on this phone</button>
      </div>`;
    const pickLength = async (who: string): Promise<number | null> => {
      const { result } = app.sheet(`<h2>MN × for ${esc(who)}</h2><p>For how long?</p>`, [...LENGTHS.map(([d, t]) => ({ label: t, value: d, kind: d === 0 ? ('mint' as const) : ('ghost' as const) })), { label: 'Cancel', value: -1, kind: 'ghost', back: true }], 'Give MN ×');
      const d = await result;
      return d === -1 || d === undefined ? null : (d as number);
    };
    const approve = async (email: string, name: string, uid?: string) => {
      const days = await pickLength(name || email);
      if (days === null) return;
      try {
        await b.approve({ email, name, until: days ? Date.now() + days * DAY : 0, addedAt: Date.now() });
        if (uid) await b.dropRequest(uid);
        app.toast(`${name || email} has MN × now.`);
      } catch {
        app.toast('That didn’t work. Check the internet connection.');
      }
      void paint();
    };
    box.querySelector('.og-refresh')!.addEventListener('click', () => void paint());
    box.querySelectorAll<HTMLElement>('.og-req').forEach((row) => {
      const r = waiting.find((x) => x.uid === row.dataset.uid)!;
      row.querySelector('.og-ok')!.addEventListener('click', () => void approve(r.email, r.name, r.uid));
      row.querySelector('.og-no')!.addEventListener('click', async () => {
        await b.dropRequest(r.uid).catch(() => undefined);
        void paint();
      });
    });
    box.querySelectorAll<HTMLElement>('.og-acc').forEach((row) => {
      const e = approved.find((x) => x.email === row.dataset.email)!;
      row.querySelector('.og-rm')!.addEventListener('click', async () => {
        const { result } = app.sheet(`<h2>Turn off MN × for ${esc(e.name || e.email)}?</h2><p>MN × turns off on their phones the next time MN checks (offline, within 14 days). They keep using MN, and their children’s progress stays.</p>`, [
          { label: 'Turn off MN ×', value: true, kind: 'danger' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Turn off MN ×');
        if (!(await result)) return;
        await b.removeAccess(e.email).catch(() => app.toast('That didn’t work. Check the internet connection.'));
        void paint();
      });
    });
    box.querySelector('.og-add-btn')!.addEventListener('click', () => {
      const v = box.querySelector<HTMLInputElement>('.og-email')!.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        popIn(box.querySelector('.og-email')!, 0, 0.95);
        return app.toast('Type a whole email address.');
      }
      void approve(v, '');
    });
    box.querySelector('.og-out')!.addEventListener('click', async () => {
      await signOut(app);
      void paint();
    });
    stagger(box.querySelectorAll('.og-row'), { gap: 40 });
  };
  void paint();
}
