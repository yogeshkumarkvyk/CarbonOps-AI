/* CarbonOps AI sign-in portal. Hosted mode uses Supabase Auth; standalone mode remains local. */
(function (G) {
  'use strict';
  const A = G.CarbonOps; const esc = G.CO_CHARTS.esc;
  const ACC_KEY = 'carbonops-accounts';
  const SES_KEY = 'carbonops-session';
  const AU = { tab: 'signin', err: '', info: '', busy: false, show: false, strength: 0 };
  let ACTIVE = null;
  const cloudReady = () => !!(G.CarbonOpsCloud && G.CarbonOpsCloud.ready);
  const cloudUser = (u) => ({ id: u.id, email: u.email || '', name: (u.user_metadata && u.user_metadata.full_name) || (u.email || 'User').split('@')[0], org: (u.user_metadata && u.user_metadata.organization) || '', role: (u.user_metadata && u.user_metadata.role) || 'Plant admin' });

  // ---------- storage ----------
  function accounts() { try { return JSON.parse(localStorage.getItem(ACC_KEY) || '[]'); } catch (e) { return []; } }
  function saveAccounts(list) { try { localStorage.setItem(ACC_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function session() {
    try { const s = JSON.parse(localStorage.getItem(SES_KEY) || sessionStorage.getItem(SES_KEY) || 'null'); if (s && s.until > Date.now()) return s; } catch (e) { /* ignore */ }
    return null;
  }
  function setSession(id, remember) {
    const s = JSON.stringify({ id, until: Date.now() + (remember ? 30 : 1) * 86400000 });
    try { if (remember) localStorage.setItem(SES_KEY, s); else sessionStorage.setItem(SES_KEY, s); } catch (e) { /* ignore */ }
  }
  function clearSession() { try { localStorage.removeItem(SES_KEY); sessionStorage.removeItem(SES_KEY); } catch (e) { /* ignore */ } }

  // ---------- crypto ----------
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  async function hashPw(pw, saltHex) {
    if (!(G.crypto && G.crypto.subtle)) throw new Error('nocrypto');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const key = await G.crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await G.crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  }
  const newSalt = () => hex(G.crypto.getRandomValues(new Uint8Array(16)));
  const newId = () => 'u' + hex(G.crypto.getRandomValues(new Uint8Array(6)));
  function strength(pw) {
    let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // ---------- portal ----------
  const ic = A.ic;
  // Login page: split screen. Brand and industrial visual on the left, authentication on the right.
  const LOGO = '<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#B7F34A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4.5c6.5 2.6 10 8 9.4 14.6-4.8 1.4-9.6.5-13-2.6"/><path d="M16 4.5c-4.4 4.2-5.7 9.6-3.6 15.4"/><path d="M6.5 27.5c3-6.2 8-10.6 15-13"/><circle cx="6.5" cy="27.5" r="1.6" fill="#B7F34A" stroke="none"/></svg>';
  function visual() {
    // abstract industrial skyline with carbon-flow lines (no photograph, no claims)
    const stacks = [[70, 300, 26, 150], [118, 300, 18, 118], [520, 300, 22, 168], [560, 300, 16, 132]];
    const sky = 'M0 300 L0 238 L40 238 L40 214 L96 214 L96 246 L150 246 L150 196 L182 180 L214 196 L246 180 L278 196 L278 230 L330 230 L330 206 L392 206 L392 236 L450 236 L450 188 L500 188 L500 230 L600 230 L600 300 Z';
    let flows = ''; const pts = [[60, 140], [150, 96], [250, 128], [340, 82], [430, 118], [520, 70], [590, 104]];
    flows += '<polyline points="' + pts.map((p) => p.join(',')).join(' ') + '" class="lp-flow"/>';
    flows += pts.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 === 1 ? 3.4 : 2.2) + '" class="lp-node' + (i % 3 === 1 ? ' hi' : '') + '"/>').join('');
    const grid = Array.from({ length: 13 }, (_, i) => '<line x1="' + (i * 50) + '" y1="0" x2="' + (i * 50) + '" y2="300" class="lp-grid"/>').join('') + Array.from({ length: 7 }, (_, i) => '<line x1="0" y1="' + (i * 50) + '" x2="600" y2="' + (i * 50) + '" class="lp-grid"/>').join('');
    const plume = stacks.map(([x, y, w, h], i) => '<rect x="' + x + '" y="' + (y - h) + '" width="' + w + '" height="' + h + '" class="lp-stack"/><path d="M' + (x + w / 2) + ' ' + (y - h - 6) + ' q 12 -18 2 -36 q -10 -18 6 -38" class="lp-plume" style="animation-delay:' + (i * 0.8) + 's"/>').join('');
    return '<svg class="lp-visual-svg" viewBox="0 0 600 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="lpFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101412" stop-opacity="0"/><stop offset="1" stop-color="#101412" stop-opacity=".9"/></linearGradient><radialGradient id="lpGlow" cx=".72" cy=".55" r=".55"><stop offset="0" stop-color="#B7F34A" stop-opacity=".16"/><stop offset="1" stop-color="#B7F34A" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="600" height="300" fill="url(#lpGlow)"/>' + grid + flows + plume + '<path d="' + sky + '" class="lp-sky"/>' +
      Array.from({ length: 18 }, (_, i) => '<rect x="' + (160 + (i % 6) * 18) + '" y="' + (206 + Math.floor(i / 6) * 12) + '" width="8" height="4" class="lp-win' + (i % 5 === 0 ? ' on' : '') + '"/>').join('') +
      '<rect width="600" height="300" fill="url(#lpFade)"/></svg>';
  }
  function preview() {
    const v = [182, 176, 179, 171, 168, 172, 165, 161, 163, 158, 155, 153]; const mx = 190, mn = 145;
    const pts = v.map((x, i) => (6 + i * (208 / 11)).toFixed(1) + ',' + (6 + (mx - x) / (mx - mn) * 44).toFixed(1)).join(' ');
    return '<div class="lp-preview" aria-label="Illustrative dashboard preview"><div class="lp-pv-row"><div><span class="lp-pv-l">Total emissions</span><b>153 <small>t CO₂e</small></b></div><div class="lp-pv-r"><span class="lp-pv-l">Reporting period</span><span class="lp-pv-v">Last 12 months</span></div></div>' +
      '<svg viewBox="0 0 220 56" class="lp-pv-chart" aria-hidden="true"><polyline points="' + pts + '" class="lp-pv-line"/></svg><span class="lp-pv-tag">Illustrative demo data</span></div>';
  }
  function portal() {
    const t = AU.tab; const accs = cloudReady() ? [] : accounts();
    const errOn = (k) => AU.err && new RegExp(k, 'i').test(AU.err);
    const field = (id, label, type, extra, after, inval) => '<div class="lp-field"><label for="' + id + '">' + label + '</label><div class="lp-input' + (inval ? ' bad' : '') + '"><input type="' + type + '" id="' + id + '" ' + (extra || '') + (inval ? ' aria-invalid="true" aria-describedby="lp-err"' : '') + '/>' + (after || '') + '</div></div>';
    const eye = (id) => '<button type="button" class="lp-eye" data-act="au-eye" data-arg="' + id + '" aria-label="' + (AU.show ? 'Hide' : 'Show') + ' password" aria-pressed="' + AU.show + '">' + ic(AU.show ? 'eye-off' : 'eye') + '</button>';
    const pwType = AU.show ? 'text' : 'password';
    const msg = (AU.err ? '<div class="lp-msg err" id="lp-err" role="alert">' + ic('circle-alert') + '<span>' + esc(AU.err) + '</span></div>' : '') + (AU.info ? '<div class="lp-msg ok" role="status">' + ic('circle-check') + '<span>' + esc(AU.info) + '</span></div>' : '');
    const busyBtn = (label, busyLabel) => '<button type="submit" class="lp-btn au-submit"' + (AU.busy ? ' disabled aria-busy="true"' : '') + '>' + (AU.busy ? '<span class="lp-spin" aria-hidden="true"></span>' + busyLabel : label) + '</button>';
    let form;
    if (t === 'signin') {
      form = '<form class="lp-form" data-form="signin" novalidate><h2>Welcome back</h2><p class="lp-sub">Sign in to access your carbon intelligence workspace.</p>' + msg +
        field('au-email', 'Work email', 'email', 'autocomplete="username" required placeholder="you@company.com"', '', errOn('email')) +
        field('au-pw', 'Password', pwType, 'autocomplete="current-password" required placeholder="Enter your password"', eye('au-pw'), errOn('password')) +
        '<div class="lp-row"><label class="lp-check"><input type="checkbox" id="au-remember" checked/> Remember me</label><button type="button" class="lp-link" data-act="au-forgot">Forgot password?</button></div>' +
        busyBtn('Sign in to CarbonOps', 'Signing in…') +
        '<div class="lp-or"><span>or</span></div><button type="button" class="lp-btn ghost au-demo" data-act="au-demo">' + ic('play') + 'Explore the demo workspace</button>' +
        '<p class="lp-switch">New to CarbonOps? <button type="button" class="lp-link" data-act="au-tab" data-arg="signup">Create an account</button></p></form>';
    } else if (t === 'signup') {
      form = '<form class="lp-form" data-form="signup" novalidate><h2>Create your account</h2><p class="lp-sub">Start with an empty workspace for your own factory.</p>' + msg +
        '<div class="lp-two">' + field('au-name', 'Full name', 'text', 'autocomplete="name" required placeholder="Your name"', '', errOn('name')) + field('au-org', 'Company or site', 'text', 'autocomplete="organization" placeholder="Optional"') + '</div>' +
        field('au-email', 'Work email', 'email', 'autocomplete="email" required placeholder="you@company.com"', '', errOn('email')) +
        field('au-pw', 'Password', pwType, 'autocomplete="new-password" required minlength="8" placeholder="At least 8 characters" data-in="au-strength"', eye('au-pw'), errOn('password') && !errOn('match')) +
        '<div class="lp-meter" aria-hidden="true"><i class="s' + AU.strength + '"></i></div><p class="lp-hint" id="au-hint">' + ['At least 8 characters', 'Weak: add length, numbers or symbols', 'Fair: add a number or symbol', 'Good', 'Strong'][AU.strength] + '</p>' +
        field('au-pw2', 'Confirm password', pwType, 'autocomplete="new-password" required placeholder="Repeat the password"', '', errOn('match')) +
        '<div class="lp-field"><label for="au-role">Your role</label><div class="lp-input"><select id="au-role"><option>Plant admin</option><option>Sustainability officer</option><option>Viewer</option></select></div></div>' +
        '<label class="lp-check"><input type="checkbox" id="au-agree"/> I agree to create an account and store my workspace data with CarbonOps cloud services.</label>' +
        busyBtn('Create account', 'Creating account…') +
        '<p class="lp-switch">Already have an account? <button type="button" class="lp-link" data-act="au-tab" data-arg="signin">Sign in</button></p></form>';
    } else if (t === 'forgot') {
      form = cloudReady()
        ? '<div class="lp-form"><h2>Reset your password</h2><p class="lp-sub">Password reset links are sent by Supabase Auth.</p>' +
          (AU.info ? '<div class="lp-msg info"><span>' + esc(AU.info) + '</span></div>' : '') + field('au-reset-email', 'Account email', 'email', 'autocomplete="email" required placeholder="you@company.com"') +
          '<button type="button" class="lp-btn primary" data-act="au-reset">Send reset link</button><p class="lp-switch"><button type="button" class="lp-link" data-act="au-tab" data-arg="signin">← Back to sign in</button></p></div>'
        : '<div class="lp-form"><h2>Reset your password</h2><p class="lp-sub">There is no email server behind this page, so a reset link cannot be sent.</p>' +
        '<div class="lp-msg info">' + ic('info') + '<span>Accounts live only in this browser. If you forgot a password, remove the account and create it again. Its workspace data is removed too.</span></div>' +
        (accs.length ? '<div class="lp-accts">' + accs.map((x) => '<div class="lp-acct"><span class="lp-av">' + esc(initials(x.name)) + '</span><span><b>' + esc(x.name) + '</b><small>' + esc(x.email) + '</small></span><button type="button" class="lp-btn ghost sm" data-act="au-remove" data-arg="' + x.id + '">Remove</button></div>').join('') + '</div>' : '<p class="lp-sub">No accounts in this browser yet.</p>') +
        '<p class="lp-switch"><button type="button" class="lp-link" data-act="au-tab" data-arg="signin">← Back to sign in</button></p></div>';
    } else if (t === 'recover') {
      form = '<div class="lp-form"><h2>Choose a new password</h2><p class="lp-sub">Enter a new password for your account.</p>' + msg +
        field('au-newpw', 'New password', 'password', 'autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"') +
        field('au-newpw2', 'Confirm password', 'password', 'autocomplete="new-password" required placeholder="Repeat the password"') +
        '<button type="button" class="lp-btn primary" data-act="au-recover">Update password</button></div>';
    } else {
      const docs = {
        privacy: ['Privacy', cloudReady() ? 'Hosted preview: accounts are managed by Supabase Auth and workspaces are stored in the Supabase project selected by the site operator. AI questions, workspace summaries, bill or meter images, and floor plans you submit for reading are sent through OpenRouter to its selected inference provider. Review those providers’ data terms before use. Do not submit confidential information. The site operator must publish a complete privacy notice and contact details before inviting production users.' : 'In local demo mode, account and workspace data are stored in this browser on this device. AI features are available only when connected to a supported hosted version.'],
        terms: ['Terms', 'CarbonOps is a decision-support prototype. Emissions results depend on your activity data and the emission factors shown with each record. They are estimates, not verified assurance or a regulatory compliance statement. Review AI-extracted values against the original documents before saving. The site operator must add applicable service terms before production use.'],
        help: ['Help', 'New here? Create an account, name your factory, upload a floor plan, and add data with Add data, bills, a spreadsheet, or the sample data button. To look around first, choose Explore the demo workspace. Forgot a password? Use Forgot password? on the sign-in form.']
      };
      const d = docs[t] || docs.help;
      form = '<div class="lp-form"><h2>' + d[0] + '</h2><p class="lp-doc">' + esc(d[1]) + '</p><p class="lp-switch"><button type="button" class="lp-link" data-act="au-tab" data-arg="signin">← Back to sign in</button></p></div>';
    }
    const recent = t === 'signin' && accs.length ? '<div class="lp-recent"><span>Accounts on this browser</span>' + accs.slice(0, 3).map((x) => '<button type="button" data-act="au-pick" data-arg="' + esc(x.email) + '"><span class="lp-av">' + esc(initials(x.name)) + '</span><span><b>' + esc(x.name) + '</b><small>' + esc(x.email) + '</small></span></button>').join('') + '</div>' : '';
    const feat = (icon, title, text) => '<li><span class="lp-fi">' + ic(icon) + '</span><div><b>' + title + '</b><p>' + text + '</p></div></li>';
    const first = !AU.drawn; AU.drawn = true;
    return '<div class="lp' + (first ? ' first' : '') + '">' +
      '<section class="lp-brand" aria-label="About CarbonOps AI"><div class="lp-brand-in">' +
      '<div class="lp-logo"><span class="lp-mark">' + LOGO + '</span><div><b>CarbonOps AI</b><small>INDUSTRIAL CARBON INTELLIGENCE</small></div></div>' +
      '<h1 class="lp-h1">Measure emissions.<br/><em>Make an impact.</em></h1>' +
      '<p class="lp-lede">Transform industrial data into actionable carbon intelligence. Track emissions, uncover operational inefficiencies, and make informed decisions toward a lower-carbon future.</p>' +
      '<ul class="lp-feats">' + feat('factory', 'Facility-level emissions tracking', 'Understand carbon emissions across facilities, departments, and operational processes.') + feat('sparkles', 'AI-powered reduction insights', 'Identify opportunities to reduce emissions, energy consumption, and operational waste.') + feat('git-compare-arrows', 'Scenario-based planning', 'Compare potential reduction strategies and understand their estimated environmental impact.') + '</ul></div>' +
      '<div class="lp-visual">' + visual() + preview() + '</div></section>' +
      '<main class="lp-auth"><div class="lp-mlogo"><span class="lp-mark">' + LOGO + '</span><b>CarbonOps AI</b></div><div class="lp-card">' + form + '</div>' + recent +
      '<p class="lp-note">' + ic('lock') + (cloudReady() ? 'Secure sign-in and cloud workspace storage.' : 'Local demo mode: accounts stay in this browser.') + '</p>' +
      '<footer class="lp-foot"><button type="button" data-act="au-tab" data-arg="privacy">Privacy Policy</button><span aria-hidden="true">·</span><button type="button" data-act="au-tab" data-arg="terms">Terms of Service</button><span aria-hidden="true">·</span><button type="button" data-act="au-tab" data-arg="help">Help</button></footer></main></div>';
  }
  const initials = (n) => (n || 'U').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  function show() {
    const root = document.getElementById('auth-root');
    document.getElementById('app').hidden = true;
    root.hidden = false; root.innerHTML = portal(); A.icons();
    const first = root.querySelector('input:not([type=checkbox])'); if (first && !AU.keepFocus) first.focus();
  }
  function rerender(keep) {
    const vals = {}; document.querySelectorAll('#auth-root input').forEach((i) => { vals[i.id] = i.type === 'checkbox' ? i.checked : i.value; });
    AU.keepFocus = true; show(); AU.keepFocus = false;
    if (keep !== false) Object.entries(vals).forEach(([id, v]) => { const i = document.getElementById(id); if (!i) return; if (i.type === 'checkbox') i.checked = v; else i.value = v; });
  }
  async function enter(acc) {
    ACTIVE = acc;
    document.getElementById('auth-root').hidden = true; document.getElementById('auth-root').innerHTML = '';
    document.getElementById('app').hidden = false;
    await A.startSession(acc);
  }
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };

  async function signIn() {
    const email = val('au-email').trim().toLowerCase(); const pw = val('au-pw');
    AU.err = ''; AU.info = '';
    if (!EMAIL_RE.test(email)) { AU.err = 'Enter your work email, like name@company.com.'; return rerender(); }
    if (!pw) { AU.err = 'Enter your password.'; return rerender(); }
    if (cloudReady()) {
      AU.busy = true; rerender();
      try {
        const { data, error } = await G.CarbonOpsCloud.client.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        await enter(cloudUser(data.user));
      } catch (e) { AU.busy = false; AU.err = e.message || 'Sign-in failed. Try again.'; rerender(); }
      return;
    }
    const acc = accounts().find((a) => a.email === email);
    AU.busy = true; rerender();
    try {
      const h = acc ? await hashPw(pw, acc.salt) : await hashPw(pw, '00112233445566778899aabbccddeeff');
      if (!acc || h !== acc.hash) { AU.busy = false; AU.err = 'That email and password do not match an account in this browser.'; return rerender(); }
      const list = accounts(); const me = list.find((a) => a.id === acc.id); me.lastLogin = new Date().toISOString(); saveAccounts(list);
      setSession(acc.id, document.getElementById('au-remember') && document.getElementById('au-remember').checked);
      AU.busy = false; enter(me);
    } catch (e) { AU.busy = false; AU.err = e.message === 'nocrypto' ? 'This browser cannot hash passwords here. Use the demo account instead.' : 'Sign-in failed. Try again.'; rerender(); }
  }
  async function signUp() {
    const name = val('au-name').trim(); const email = val('au-email').trim().toLowerCase(); const pw = val('au-pw'); const pw2 = val('au-pw2');
    AU.err = ''; AU.info = '';
    if (!name) AU.err = 'Enter your name.';
    else if (!EMAIL_RE.test(email)) AU.err = 'Enter a valid work email, like name@company.com.';
    else if (pw.length < 8) AU.err = 'Use a password of at least 8 characters.';
    else if (pw !== pw2) AU.err = 'The two passwords do not match.';
    else if (!document.getElementById('au-agree').checked) AU.err = 'Tick the box to confirm account creation and cloud data storage.';
    if (cloudReady()) {
      if (AU.err) return rerender();
      AU.busy = true; rerender();
      try {
        const { data, error } = await G.CarbonOpsCloud.client.auth.signUp({
          email, password: pw,
          options: { data: { full_name: name, organization: val('au-org').trim(), role: val('au-role') || 'Plant admin' } }
        });
        if (error) throw error;
        if (data.session && data.user) await enter(cloudUser(data.user));
        else { AU.busy = false; AU.tab = 'signin'; AU.info = 'Check your email to confirm your account, then sign in.'; rerender(false); }
      } catch (e) { AU.busy = false; AU.err = e.message || 'Could not create the account.'; rerender(); }
      return;
    }
    else if (accounts().some((a) => a.email === email)) AU.err = 'An account with this email already exists in this browser. Sign in instead.';
    if (AU.err) return rerender();
    AU.busy = true; rerender();
    try {
      const salt = newSalt(); const hash = await hashPw(pw, salt);
      const acc = { id: newId(), name, email, org: val('au-org').trim(), role: val('au-role') || 'Plant admin', salt, hash, created: new Date().toISOString(), lastLogin: new Date().toISOString() };
      const list = accounts(); list.push(acc);
      if (!saveAccounts(list)) { AU.busy = false; AU.err = 'This browser blocked saving the account (storage is off or full).'; return rerender(); }
      setSession(acc.id, true); AU.busy = false; enter(acc);
    } catch (e) { AU.busy = false; AU.err = e.message === 'nocrypto' ? 'This browser cannot hash passwords here. Use the demo account instead.' : 'Could not create the account. Try again.'; rerender(); }
  }

  // ---------- events ----------
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); if (f.dataset.form === 'signin') signIn(); else if (f.dataset.form === 'signup') signUp(); });
  A.ACT['au-tab'] = (t) => { AU.tab = t; AU.err = ''; AU.info = ''; AU.strength = 0; rerender(false); };
  A.ACT['au-eye'] = () => { AU.show = !AU.show; rerender(); };
  A.ACT['au-forgot'] = () => { AU.tab = 'forgot'; AU.err = ''; rerender(false); };
  A.ACT['au-reset'] = async () => {
    const email = val('au-reset-email').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { AU.info = 'Enter a valid account email.'; return rerender(false); }
    const { error } = await G.CarbonOpsCloud.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    AU.info = error ? error.message : 'If an account exists for that address, a password reset link has been sent.';
    rerender(false);
  };
  A.ACT['au-recover'] = async () => {
    const next = val('au-newpw'), repeat = val('au-newpw2');
    if (next.length < 8) { AU.err = 'Use a password of at least 8 characters.'; return rerender(false); }
    if (next !== repeat) { AU.err = 'The passwords do not match.'; return rerender(false); }
    const { error } = await G.CarbonOpsCloud.client.auth.updateUser({ password: next });
    if (error) { AU.err = error.message; return rerender(false); }
    history.replaceState(null, '', location.pathname + location.search);
    if (ACTIVE) await enter(ACTIVE); else { AU.tab = 'signin'; AU.info = 'Password updated. Please sign in.'; rerender(false); }
  };
  A.ACT['au-pick'] = (email) => { const e = document.getElementById('au-email'); if (e) e.value = email; const p = document.getElementById('au-pw'); if (p) p.focus(); };
  A.ACT['au-demo'] = () => { setSession('demo', false); enter({ id: 'demo', name: 'Demo user', email: 'demo@carbonops.example', role: 'Plant admin', demo: true }); };
  A.ACT['au-remove'] = (id) => {
    const list = accounts().filter((a) => a.id !== id); saveAccounts(list);
    try { localStorage.removeItem(A.KEY + ':' + id); } catch (e) { /* ignore */ }
    AU.info = 'Account removed from this browser.'; rerender(false);
  };
  A.ACT['theme-auth'] = () => { A.ACT['theme-set'](A.theme() === 'dark' ? 'light' : 'dark'); rerender(); };
  A.IN['au-strength'] = (v) => { AU.strength = v ? Math.max(1, strength(v)) : 0; const m = document.querySelector('.au-meter i'); if (m) m.className = 's' + AU.strength; const h = document.getElementById('au-hint'); if (h) h.textContent = ['At least 8 characters', 'Weak: add length, numbers or symbols', 'Fair: add a number or symbol', 'Good', 'Strong'][AU.strength]; };

  // ---------- account management (used by Settings) ----------
  async function changePassword(cur, next, next2) {
    if (cloudReady()) {
      if (next.length < 8) return 'Use a new password of at least 8 characters.';
      if (next !== next2) return 'The new passwords do not match.';
      const { error: reauthError } = await G.CarbonOpsCloud.client.auth.signInWithPassword({ email: ACTIVE.email, password: cur });
      if (reauthError) return 'Your current password is not correct.';
      const { error } = await G.CarbonOpsCloud.client.auth.updateUser({ password: next });
      return error ? error.message : '';
    }
    const s = session(); if (!s || s.id === 'demo') return 'The demo account has no password. Create your own account to set one.';
    const list = accounts(); const me = list.find((a) => a.id === s.id); if (!me) return 'Account not found.';
    if (next.length < 8) return 'Use a new password of at least 8 characters.';
    if (next !== next2) return 'The new passwords do not match.';
    if (await hashPw(cur, me.salt) !== me.hash) return 'Your current password is not correct.';
    me.salt = newSalt(); me.hash = await hashPw(next, me.salt); saveAccounts(list); return '';
  }
  async function updateProfile(p) {
    if (cloudReady() && ACTIVE) {
      if (p.email && p.email !== ACTIVE.email) return 'Email address changes require a verified email change flow. Update it through Supabase Auth settings for now.';
      ACTIVE = { ...ACTIVE, name: p.name || ACTIVE.name, role: p.role || ACTIVE.role, email: p.email || ACTIVE.email };
      const { error } = await G.CarbonOpsCloud.client.auth.updateUser({ data: { full_name: ACTIVE.name, role: ACTIVE.role } });
      if (error) return error.message;
      return '';
    }
    const s = session(); if (!s || s.id === 'demo') return '';
    const list = accounts(); const me = list.find((a) => a.id === s.id); if (!me) return '';
    if (p.email && p.email !== me.email && list.some((a) => a.email === p.email)) return 'Another account here already uses that email.';
    Object.assign(me, { name: p.name, email: p.email || me.email, role: p.role }); saveAccounts(list); return '';
  }
  async function signOut() {
    if (cloudReady()) {
      if (ACTIVE && !ACTIVE.demo && A.S) await G.CarbonOpsCloud.saveWorkspace(ACTIVE.id, A.S).catch((e) => console.error('CarbonOps cloud save failed:', e.message));
      await G.CarbonOpsCloud.client.auth.signOut();
    }
    ACTIVE = null; clearSession(); A.endSession(); AU.tab = 'signin'; AU.err = ''; AU.info = 'You have signed out.'; show();
  }
  async function deleteAccount() {
    if (cloudReady() && ACTIVE) {
      try {
        const deletedId = ACTIVE.id;
        const { data } = await G.CarbonOpsCloud.client.auth.getSession();
        const response = await fetch('/api/account', { method: 'DELETE', headers: { Authorization: 'Bearer ' + data.session.access_token } });
        if (!response.ok) throw new Error('Account deletion service is not configured.');
        await G.CarbonOpsCloud.client.auth.signOut(); ACTIVE = null; A.endSession();
        try { localStorage.removeItem(A.KEY + ':' + deletedId); } catch (_) { /* ignore */ }
        AU.tab = 'signin'; AU.info = 'Your account and workspace were deleted.'; show();
      } catch (e) { toast(e.message); }
      return;
    }
    const s = session(); if (!s) return;
    if (s.id !== 'demo') saveAccounts(accounts().filter((a) => a.id !== s.id));
    try { localStorage.removeItem(A.KEY + ':' + s.id); } catch (e) { /* ignore */ }
    clearSession(); A.endSession(); AU.tab = 'signin'; AU.info = 'Account and its workspace were removed from this browser.'; show();
  }
  function current() { if (cloudReady()) return ACTIVE; const s = session(); if (!s) return null; if (s.id === 'demo') return { id: 'demo', demo: true }; return accounts().find((a) => a.id === s.id) || null; }

  async function start() {
    if (cloudReady()) {
      const { data, error } = await G.CarbonOpsCloud.client.auth.getSession();
      if (error) { AU.info = 'Could not connect to account services. Try refreshing.'; show(); return; }
      if (location.hash.includes('type=recovery') && data.session) { ACTIVE = cloudUser(data.session.user); AU.tab = 'recover'; show(); return; }
      if (data.session) { await enter(cloudUser(data.session.user)); return; }
      show(); return;
    }
    const s = session();
    if (s) {
      if (s.id === 'demo') return enter({ id: 'demo', name: 'Demo user', email: 'demo@carbonops.example', role: 'Plant admin', demo: true });
      const acc = accounts().find((a) => a.id === s.id);
      if (acc) return enter(acc);
      clearSession();
    }
    show();
  }
  A.auth = { start, signOut, deleteAccount, changePassword, updateProfile, current };
})(window);
