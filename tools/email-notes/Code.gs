/**
 * MN Mission Next: email notes for access requests (free, runs in your own Google account).
 *
 * Every 5 minutes this script looks at MN's cloud (Firestore, project mn-mission-next):
 *  - someone asked to use MN  → an email to them ("we've got your request"), with a hidden copy to you;
 *  - you approved someone      → a welcome email to them ("You're in"), only once SEND_WELCOME is true.
 * It only reads the cloud; it never changes anything there.
 *
 * Set up once: paste this file and appsscript.json into a new project at script.google.com,
 * then run setup() and allow the permissions it asks for. That's it.
 */

const PROJECT = 'mn-mission-next';
/** Gets a hidden copy (bcc) of every request email. */
const NOTIFY_TO = 'mbatechindore@gmail.com';
/** Welcome emails to approved people: on hold for now. Set to true to start them (only approvals from then on get one). */
const SEND_WELCOME = false;
/** What people see as the sender, and where their replies go. */
const FROM_NAME = 'MN Mission Next';
const REPLY_TO = 'moulikmishra11@gmail.com';
const PRIVACY = 'https://mn-mission-next.web.app/privacy';

/** Run this once by hand: it remembers who is already approved (no emails for them) and starts the 5-minute check. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const access = list_('access');
  const seen = {};
  access.forEach((d) => (seen[d.id] = Number(d.f.addedAt || 0)));
  props.setProperty('seenAccess', JSON.stringify(seen));
  props.setProperty('seenRequests', '{}');
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('check').timeBased().everyMinutes(5).create();
  check();
  Logger.log('Set up. ' + access.length + ' approved account(s) noted; checking every 5 minutes.');
}

/** Runs every 5 minutes. */
function check() {
  const props = PropertiesService.getScriptProperties();
  const seenReq = JSON.parse(props.getProperty('seenRequests') || '{}');
  const seenAcc = JSON.parse(props.getProperty('seenAccess') || '{}');
  const access = list_('access');
  const approved = {};
  access.forEach((d) => (approved[d.id] = d.f));

  // New requests (from someone not approved yet): an email to them, with a hidden copy to you.
  // Once per request: tapping "Check again" in MN doesn't send another.
  const requests = list_('requests');
  const stillOpen = {};
  requests.forEach((d) => {
    const r = d.f;
    const at = Number(r.at || 0);
    stillOpen[d.id] = at;
    if (approved[String(r.email || '').toLowerCase()]) return;
    if (d.id in seenReq) return;
    seenReq[d.id] = at;
    if (!r.email) return;
    send_(String(r.email), 'MN Mission Next: we’ve got your request',
      '<p>Hi' + (r.name ? ' ' + esc_(String(r.name).split(' ')[0]) : '') + ',</p>' +
      '<p>Thanks for signing in to MN Mission Next with <b>' + esc_(r.email) + '</b>. Your request to use MN is with us, and we’ll let you know once it’s approved.</p>' +
      '<p>Phone code: <b>' + esc_(r.phone || '?') + '</b><br>Requested: ' + esc_(when_(at)) + '</p>' +
      '<p>Once you’re approved, open MN and tap <b>Check again</b>. If you have a phone-code key, you can keep using MN with it meanwhile.</p>' +
      '<p style="color:#5B5F7A;font-size:13px">Questions? Just reply to this email.</p>',
      NOTIFY_TO);
  });
  Object.keys(seenReq).forEach((k) => { if (!(k in stillOpen)) delete seenReq[k]; });

  // Newly approved accounts: a welcome email to them.
  access.forEach((d) => {
    const a = d.f;
    const added = Number(a.addedAt || 0);
    if (seenAcc[d.id] === added) return;
    seenAcc[d.id] = added;
    if (!SEND_WELCOME) return; // on hold: noted as seen, so turning it on later doesn't email past approvals
    const until = Number(a.until || 0);
    send_(d.id, 'You’re in: MN Mission Next is ready',
      '<p>Hi' + (a.name ? ' ' + esc_(String(a.name).split(' ')[0]) : '') + ',</p>' +
      '<p>Your Google account <b>' + esc_(d.id) + '</b> can now use MN' + (until ? ', until ' + esc_(day_(until)) : '') + '.</p>' +
      '<p>Open MN on your phone and tap <b>Check again</b>, or just close MN and open it again. Your children’s progress is backed up from now on.</p>' +
      '<p style="color:#5B5F7A;font-size:13px">Questions? Just reply to this email. Privacy policy: <a href="' + PRIVACY + '">' + PRIVACY + '</a></p>');
  });
  Object.keys(seenAcc).forEach((k) => { if (!approved[k]) delete seenAcc[k]; });

  props.setProperty('seenRequests', JSON.stringify(seenReq));
  props.setProperty('seenAccess', JSON.stringify(seenAcc));
}

// ── helpers ──────────────────────────────────────────────────────────────

/** Every document in a collection, as { id, f: plain fields }. */
function list_(collection) {
  const out = [];
  let page = '';
  for (let n = 0; n < 20; n++) {
    const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/' + collection + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) throw new Error('Firestore ' + collection + ': ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
    const j = JSON.parse(res.getContentText());
    (j.documents || []).forEach((d) => out.push({ id: decodeURIComponent(d.name.split('/').pop()), f: plain_(d.fields || {}) }));
    if (!j.nextPageToken) break;
    page = j.nextPageToken;
  }
  return out;
}

function plain_(fields) {
  const o = {};
  Object.keys(fields).forEach((k) => {
    const v = fields[k];
    o[k] = 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : null;
  });
  return o;
}

function send_(to, subject, body, bcc) {
  MailApp.sendEmail({
    to: to,
    bcc: bcc || '',
    subject: subject,
    name: FROM_NAME,
    replyTo: REPLY_TO,
    htmlBody: '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#16182B;max-width:520px">' + body + '<p style="color:#5B5F7A;font-size:13px;margin-top:24px">MN Mission Next</p></div>',
  });
}

const esc_ = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const when_ = (ms) => Utilities.formatDate(new Date(ms), 'Asia/Kolkata', 'd MMM yyyy, h:mm a') + ' IST';
const day_ = (ms) => Utilities.formatDate(new Date(ms), 'Asia/Kolkata', 'd MMM yyyy');
