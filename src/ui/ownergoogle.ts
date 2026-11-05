// The owner area's Google accounts: who asked to get in, who is approved (and until when),
// and which phones each account uses. Only the owner's account can see or change these (the
// cloud's rules check it too).

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

/** Fill `box` with the Google accounts section (nothing when this build has no Google sign-in). */
export function mountOwnerGoogle(app: App, box: HTMLElement): void {
  if (!cloudOn(app)) return;
  const paint = async () => {
    const who = account(app);
    if (!who || !isOwnerAccount(app)) {
      box.innerHTML = `<div class="card ow-card og-card">
        <h2>Google accounts</h2>
        <p class="fine">${who ? `Signed in as <b>${esc(who.email)}</b>, which isn’t the owner’s account.` : 'People can unlock MN with a Google account you approve. Sign in with the owner’s account to see requests.'}</p>
        ${googleButton('og-in')}<p class="fine">Use the owner’s account, ${esc(OWNER_EMAIL)}.</p>
      </div>`;
      box.querySelector('.og-in')!.addEventListener('click', async () => {
        if (who) await signOut(app);
        await signIn(app);
        void paint();
      });
      return;
    }
    box.innerHTML = `<div class="card ow-card og-card"><h2>Google accounts</h2><p class="fine">Loading…</p></div>`;
    const b = backend(app)!;
    let requests: AccessRequest[] = [];
    let approved: AccessEntry[] = [];
    let checkins: CheckIn[] = [];
    try {
      [requests, approved, checkins] = await Promise.all([b.listRequests(), b.listAccess(), b.listCheckins()]);
    } catch {
      box.innerHTML = `<div class="card ow-card og-card"><h2>Google accounts</h2><p class="fine">Couldn’t load the lists. Check the internet connection.</p><button class="btn ghost small og-again">Try again</button></div>`;
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
        <div class="og-head"><h2>Google accounts</h2><button class="btn ghost small og-refresh">Refresh</button></div>
        <p class="fine">Signed in as the owner, ${esc(who.email)}.</p>
        <h3 class="og-h">Asking to get in (${waiting.length})</h3>
        ${waiting.length ? waiting.map((r) => `<div class="og-row og-req" data-uid="${esc(r.uid)}"><div class="og-who"><b>${esc(r.name || r.email)}</b><small>${esc(r.email)} · ${esc(r.phone)} · ${ago(r.at)}</small></div><div class="og-btns"><button class="btn mint small og-ok">Approve</button><button class="btn ghost small og-no">Deny</button></div></div>`).join('') : '<p class="fine">No one is waiting.</p>'}
        <h3 class="og-h">Approved (${approved.length})</h3>
        ${approved.length ? approved.sort((x, y) => y.addedAt - x.addedAt).map((e) => {
          const phones = phonesOf(e.email);
          return `<div class="og-row og-acc" data-email="${esc(e.email)}"><div class="og-who"><b>${esc(e.name || e.email)}</b><small>${esc(e.email)} · ${untilText(e.until)}</small>${phones.length ? `<small class="og-phones">${phones.map((p) => `📱 ${esc(p.phone)} · ${esc(p.version)} · seen ${ago(p.at)}`).join('<br>')}</small>` : '<small class="og-phones">Not opened yet</small>'}</div><div class="og-btns"><button class="btn ghost small warn og-rm">Remove</button></div></div>`;
        }).join('') : '<p class="fine">No one yet.</p>'}
        <h3 class="og-h">Approve an email</h3>
        <div class="og-add"><input class="og-email" type="email" placeholder="name@gmail.com" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn small og-add-btn">Approve</button></div>
        <p class="fine">A removed account locks the next time that phone goes online (within 14 days at most).</p>
        <button class="linkish og-out">Sign out of Google on this phone</button>
      </div>`;
    const pickLength = async (who: string): Promise<number | null> => {
      const { result } = app.sheet(`<h2>Approve ${esc(who)}</h2><p>How long can they use MN?</p>`, [...LENGTHS.map(([d, t]) => ({ label: t, value: d, kind: d === 0 ? ('mint' as const) : ('ghost' as const) })), { label: 'Cancel', value: -1, kind: 'ghost', back: true }], 'Approve');
      const d = await result;
      return d === -1 || d === undefined ? null : (d as number);
    };
    const approve = async (email: string, name: string, uid?: string) => {
      const days = await pickLength(name || email);
      if (days === null) return;
      try {
        await b.approve({ email, name, until: days ? Date.now() + days * DAY : 0, addedAt: Date.now() });
        if (uid) await b.dropRequest(uid);
        app.toast(`${name || email} is approved.`);
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
        const { result } = app.sheet(`<h2>Remove ${esc(e.name || e.email)}?</h2><p>MN locks on their phones the next time they go online (within 14 days). Their children’s progress stays on their phones.</p>`, [
          { label: 'Remove', value: true, kind: 'danger' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Remove access');
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
