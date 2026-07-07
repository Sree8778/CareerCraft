const ATS_PATTERNS = [
  { pattern: /boards\.greenhouse\.io|job-boards\.greenhouse\.io/, label: 'Greenhouse' },
  { pattern: /jobs\.lever\.co/, label: 'Lever' },
  { pattern: /jobs\.ashbyhq\.com/, label: 'Ashby' },
  { pattern: /apply\.workable\.com/, label: 'Workable' },
  { pattern: /jobs\.smartrecruiters\.com/, label: 'SmartRecruiters' },
  { pattern: /myworkdayjobs\.com/, label: 'Workday' },
  { pattern: /indeed\.com/, label: 'Indeed' },
  { pattern: /linkedin\.com\/jobs/, label: 'LinkedIn' },
];

// FIELD_MAP passed as arg into page world (must be JSON-serializable)
const FIELD_MAP = [
  { keys: ['first.?name', 'first_name', 'firstname', 'fname', 'given.?name', 'forename'], profileKey: 'firstName' },
  { keys: ['last.?name', 'last_name', 'lastname', 'lname', 'family.?name', 'surname'], profileKey: 'lastName' },
  { keys: ['middle.?name', 'middle_name', 'middlename', 'mname'], profileKey: 'middleName' },
  { keys: ['e.?mail', 'email.?address', 'email.?id', 'email'], profileKey: 'email' },
  { keys: ['phone', 'mobile', 'cell', 'telephone', 'tel', 'contact.?number', 'phone.?number'], profileKey: 'phone' },
  { keys: ['linkedin', 'linked.?in'], profileKey: 'linkedin' },
  { keys: ['website', 'portfolio', 'personal.?site', 'web.?site', 'homepage', 'personal.?url'], profileKey: 'website' },
  { keys: ['current.?company', 'current.?employer', 'employer', 'organization', 'organisation'], profileKey: 'currentCompany' },
  { keys: ['job.?title', 'current.?title', 'current.?position', 'position.?title', 'headline', 'designation'], profileKey: 'headline' },
  { keys: ['city', 'location', 'current.?location', 'zip', 'postal', 'address'], profileKey: 'location' },
  { keys: ['cover.?letter', 'cover.?note', 'about.?yourself', 'tell.?us', 'additional.?info', 'introduction', 'summary', 'motivation'], profileKey: 'summary' },
  { keys: ['full.?name', 'your.?name', 'applicant.?name', 'candidate.?name', 'contact.?name', '^name$', 'your name'], profileKey: 'name' },
];

// This function is injected and runs inside the PAGE's JS context (world: MAIN)
function doFillForm(profile, fieldMap) {
  function resolve(key) {
    const parts = (profile.name || '').trim().split(/\s+/).filter(Boolean);
    const m = {
      ...profile,
      firstName:  parts[0] || '',
      lastName:   parts.length > 1 ? parts.slice(1).join(' ') : '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    };
    return (m[key] || '').trim();
  }

  function haystack(el) {
    const parts = [];
    const add = s => { if (s && s.trim()) parts.push(s.trim().toLowerCase()); };

    // Attributes
    if (el.name)        add(el.name.replace(/[_\-]/g, ' '));
    if (el.id)          add(el.id.replace(/[_\-]/g, ' '));
    if (el.placeholder) add(el.placeholder);
    add(el.getAttribute('aria-label'));
    add(el.getAttribute('data-label'));
    add(el.getAttribute('data-field-label'));
    add(el.getAttribute('title'));
    add(el.getAttribute('name'));

    // aria-labelledby
    const lbBy = el.getAttribute('aria-labelledby');
    if (lbBy) lbBy.split(/\s+/).forEach(id => { const e = document.getElementById(id); if (e) add(e.textContent); });

    // Native label association
    if (el.id) document.querySelectorAll('label').forEach(l => { if (l.htmlFor === el.id) add(l.textContent); });
    if (el.labels) Array.from(el.labels).forEach(l => add(l.textContent));

    // Walk up DOM — at each level grab prev siblings + label-like children
    let node = el.parentElement;
    for (let d = 0; d < 10 && node && node.tagName !== 'BODY'; d++) {
      if (node.tagName === 'LABEL') { add(node.textContent); break; }

      // Previous siblings
      let sib = node.previousElementSibling;
      for (let s = 0; s < 4 && sib; s++, sib = sib.previousElementSibling) {
        const t = sib.textContent.trim();
        if (t.length > 0 && t.length < 150) add(t);
      }

      // Any label-like element inside this container that doesn't contain the input
      ['label', 'legend', 'dt'].forEach(sel => {
        node.querySelectorAll(sel).forEach(l => {
          if (!l.contains(el)) { const t = l.textContent.trim(); if (t.length > 0 && t.length < 150) add(t); }
        });
      });
      // class-based label selectors (case insensitive via attribute)
      node.querySelectorAll('[class]').forEach(el2 => {
        if (el2.contains(el)) return;
        const cls = el2.className.toLowerCase();
        if (cls.includes('label') || cls.includes('title') || cls.includes('heading')) {
          const t = el2.textContent.trim();
          if (t.length > 0 && t.length < 150) add(t);
        }
      });

      node = node.parentElement;
    }

    return parts.join(' ');
  }

  function fill(el, value) {
    if (!value || el.disabled || el.readOnly) return false;
    try {
      el.focus();
      const tag = el.tagName;
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (setter && setter.set) setter.set.call(el, value);
      else el.value = value;
      ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true, cancelable: true })));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
      return true;
    } catch { return false; }
  }

  const SKIP = ['hidden','submit','button','checkbox','radio','file','image','reset'];
  const inputs = Array.from(document.querySelectorAll('input, textarea')).filter(el => {
    if (el.tagName === 'INPUT' && SKIP.includes(el.type)) return false;
    if (el.disabled || el.readOnly) return false;
    return true;
  });

  let filled = 0;
  for (const el of inputs) {
    const hs = haystack(el);
    for (const { keys, profileKey } of fieldMap) {
      let matched = false;
      for (const pat of keys) {
        try { if (new RegExp(pat, 'i').test(hs)) { matched = true; break; } } catch {}
      }
      if (matched) {
        const val = resolve(profileKey);
        if (val && fill(el, val)) { filled++; break; }
      }
    }
  }
  return filled;
}

async function getCurrentTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0] || null));
  });
}

// DOM refs
const screenSetup     = document.getElementById('screen-setup');
const screenConnected = document.getElementById('screen-connected');
const tokenInput      = document.getElementById('token-input');
const btnConnect      = document.getElementById('btn-connect');
const setupError      = document.getElementById('setup-error');
const profileAvatar   = document.getElementById('profile-avatar');
const profileName     = document.getElementById('profile-name');
const profileEmail    = document.getElementById('profile-email');
const atsIndicator    = document.getElementById('ats-indicator');
const btnFill         = document.getElementById('btn-fill');
const fillResult      = document.getElementById('fill-result');
const btnRefresh      = document.getElementById('btn-refresh');
const btnDisconnect   = document.getElementById('btn-disconnect');

const FILL_BTN_DEFAULT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Auto-Fill This Application`;

function renderProfile(profile) {
  if (!profile) return;
  const initials = (profile.name || 'U').split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  profileAvatar.textContent = initials || 'U';
  profileName.textContent  = profile.name  || '—';
  profileEmail.textContent = profile.email || '';
}

async function showConnected() {
  screenSetup.style.display = 'none';
  screenConnected.style.display = 'flex';
  chrome.storage.local.get(['cachedProfile'], ({ cachedProfile }) => renderProfile(cachedProfile));

  const tab = await getCurrentTab();
  if (tab?.url) {
    const ats = ATS_PATTERNS.find(p => p.pattern.test(tab.url));
    if (ats) {
      atsIndicator.textContent = `${ats.label} detected`;
      atsIndicator.className = 'ats-badge ats-detected';
    } else {
      atsIndicator.textContent = 'Fill any form on this page';
      atsIndicator.className = 'ats-badge ats-none';
    }
    btnFill.disabled = false;
  }
}

// Init
chrome.storage.local.get(['pluginToken'], ({ pluginToken }) => {
  if (pluginToken) showConnected();
});

// Connect
btnConnect.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) { setupError.textContent = 'Please paste your plugin token.'; setupError.style.display = 'block'; return; }
  setupError.style.display = 'none';
  btnConnect.textContent = 'Connecting…';
  btnConnect.disabled = true;
  chrome.runtime.sendMessage({ type: 'VERIFY_TOKEN', token }, ({ ok, profile, error } = {}) => {
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect';
    if (ok) { renderProfile(profile); showConnected(); }
    else { setupError.textContent = error || 'Invalid token.'; setupError.style.display = 'block'; }
  });
});

// Auto-Fill — injects fill function directly into page main world
btnFill.addEventListener('click', async () => {
  fillResult.style.display = 'none';
  const tab = await getCurrentTab();
  if (!tab) return;
  btnFill.disabled = true;
  btnFill.textContent = 'Filling…';

  const profile = await new Promise(resolve =>
    chrome.storage.local.get(['cachedProfile'], r => resolve(r.cachedProfile || null))
  );

  if (!profile) {
    fillResult.className = 'fill-result error';
    fillResult.textContent = 'Profile not loaded — click Refresh Profile first.';
    fillResult.style.display = 'block';
    btnFill.disabled = false;
    btnFill.innerHTML = FILL_BTN_DEFAULT;
    return;
  }

  let count = 0;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: doFillForm,
      args: [profile, FIELD_MAP],
    });
    count = results?.[0]?.result ?? 0;
  } catch (err) {
    console.error('executeScript failed:', err);
  }

  fillResult.style.display = 'block';
  if (count > 0) {
    fillResult.className = 'fill-result success';
    fillResult.textContent = `Filled ${count} field${count > 1 ? 's' : ''} successfully!`;
    chrome.runtime.sendMessage({ type: 'RECORD_APPLIED', data: { jobUrl: tab.url, jobTitle: tab.title, company: '', ats: '' } });
  } else {
    fillResult.className = 'fill-result error';
    fillResult.textContent = 'No matching fields found. Make sure the form is visible and scroll to it.';
  }

  btnFill.disabled = false;
  btnFill.innerHTML = FILL_BTN_DEFAULT;
});

// Refresh profile
btnRefresh.addEventListener('click', () => {
  btnRefresh.textContent = 'Refreshing…';
  chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, ({ profile } = {}) => {
    renderProfile(profile);
    btnRefresh.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Refresh Profile`;
  });
});

// Disconnect
btnDisconnect.addEventListener('click', () => {
  chrome.storage.local.remove(['pluginToken', 'cachedProfile'], () => {
    screenConnected.style.display = 'none';
    screenSetup.style.display = 'flex';
    tokenInput.value = '';
  });
});
