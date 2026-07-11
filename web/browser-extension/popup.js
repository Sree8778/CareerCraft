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
  { keys: ['street.?address', 'address.?line.?1', 'address.?1', 'addr.?1', '^addr$', 'mailing.?address', 'home.?address'], profileKey: 'address' },
  { keys: ['\\bcity\\b', '\\btown\\b', 'municipality'], profileKey: 'city' },
  { keys: ['\\bstate\\b', 'province', '\\bregion\\b'], profileKey: 'state' },
  { keys: ['zip.?code', 'postal.?code', '\\bzip\\b', '\\bpostal\\b'], profileKey: 'zip' },
  { keys: ['location', 'current.?location', 'where.?are.?you', 'based.?in'], profileKey: 'location' },
  { keys: ['cover.?letter', 'cover.?note', 'about.?yourself', 'tell.?us', 'additional.?info', 'introduction', 'summary', 'motivation'], profileKey: 'summary' },
  { keys: ['full.?name', 'your.?name', 'applicant.?name', 'candidate.?name', 'contact.?name', '^name$', 'your name'], profileKey: 'name' },
];

// Injected into PAGE main world — no chrome.* APIs allowed inside
function doFillForm(profile, fieldMap) {
  function resolve(key) {
    // Use explicit firstName/lastName from profile if backend provided them
    const m = {
      ...profile,
      // Derive only if not already present as explicit fields
      firstName:  profile.firstName || (profile.name || '').trim().split(/\s+/).slice(0, -1).join(' ') || (profile.name || '').trim().split(/\s+/)[0] || '',
      lastName:   profile.lastName  || (profile.name || '').trim().split(/\s+/).slice(-1)[0] || '',
      middleName: profile.middleName || '',
    };
    return (m[key] || '').trim();
  }

  // Build a label string ONLY from signals directly associated with this field.
  // NEVER walk above a container that holds multiple inputs — that poisons every field's haystack.
  function haystack(el) {
    const parts = [];
    const add = s => { if (s && s.trim()) parts.push(s.trim().toLowerCase()); };

    // TIER 1: attributes on the element itself (most reliable)
    if (el.name)        add(el.name.replace(/[_\-]/g, ' '));
    if (el.id)          add(el.id.replace(/[_\-]/g, ' '));
    if (el.placeholder) add(el.placeholder);
    add(el.getAttribute('aria-label'));
    add(el.getAttribute('data-label'));
    add(el.getAttribute('data-field-label'));
    add(el.getAttribute('data-automation-id'));  // Workday
    add(el.getAttribute('data-testid'));
    add(el.getAttribute('title'));

    // TIER 2: aria-labelledby (explicit link to label element by id)
    const lbBy = el.getAttribute('aria-labelledby');
    if (lbBy) {
      lbBy.split(/\s+/).forEach(id => {
        const ref = document.getElementById(id);
        if (ref) add(ref.textContent);
      });
    }

    // TIER 3: native <label for="id"> association
    if (el.id) {
      document.querySelectorAll('label[for]').forEach(l => {
        if (l.getAttribute('for') === el.id) add(l.textContent);
      });
    }
    if (el.labels && el.labels.length) Array.from(el.labels).forEach(l => add(l.textContent));

    // TIER 4: walk up DOM, but STOP the moment a container holds > 1 input
    // This prevents collecting labels from sibling fields
    let node = el.parentElement;
    for (let d = 0; d < 8 && node && !/^(BODY|HTML|FORM)$/.test(node.tagName); d++) {
      if (node.tagName === 'LABEL') { add(node.textContent); break; }

      // data-automation-id on wrapper divs (Workday pattern)
      add(node.getAttribute('data-automation-id'));
      add(node.getAttribute('aria-label'));

      // Only check DIRECT children — never querySelectorAll (that would collect sibling labels)
      // Skip: the element itself, ancestors of the element, and containers that hold other inputs
      Array.from(node.children).forEach(child => {
        if (child === el || child.contains(el)) return;
        if (child.querySelector('input:not([type=hidden]),textarea,select')) return;
        const tag = child.tagName.toLowerCase();
        const text = child.textContent.trim();
        if (!text || text.length > 150) return;
        if (['label','legend','span','p','dt','div','h1','h2','h3','h4','h5','h6','li'].includes(tag)) add(text);
        const cls = (child.className || '').toLowerCase();
        if (cls.includes('label') || cls.includes('caption') || cls.includes('heading') || cls.includes('title')) add(text);
      });

      // Previous sibling (label element above input wrapper in DOM order)
      const prev = node.previousElementSibling;
      if (prev && !prev.querySelector('input:not([type=hidden]),textarea,select')) {
        const t = prev.textContent.trim();
        if (t && t.length < 150) add(t);
      }

      node = node.parentElement;
    }

    return [...new Set(parts)].join(' ');  // deduplicate
  }

  function fill(el, value) {
    if (!value || el.disabled || el.readOnly) return false;
    try {
      el.focus();
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
      ['input', 'change', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true, cancelable: true })));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
      return true;
    } catch { return false; }
  }

  // Collect inputs from normal DOM + shadow DOM
  const SKIP = new Set(['hidden','submit','button','checkbox','radio','file','image','reset']);
  function collectInputs(root) {
    const list = [];
    try {
      root.querySelectorAll('input,textarea').forEach(el => {
        if (el.tagName === 'INPUT' && SKIP.has(el.type)) return;
        if (el.disabled || el.readOnly) return;
        list.push(el);
        // Check for shadow root on this element
        if (el.shadowRoot) list.push(...collectInputs(el.shadowRoot));
      });
      // Traverse all shadow roots
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) list.push(...collectInputs(el.shadowRoot));
      });
    } catch {}
    return list;
  }

  const inputs = collectInputs(document);

  let filled = 0;
  for (const el of inputs) {
    const hs = haystack(el);
    if (!hs) continue;
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
const resumeSelect    = document.getElementById('resume-select');
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

function populateResumeSelect(resumes) {
  const current = resumeSelect.value;
  resumeSelect.innerHTML = '';
  resumes.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    resumeSelect.appendChild(opt);
  });
  if (resumes.find(r => r.id === current)) resumeSelect.value = current;
}

async function loadResumes() {
  chrome.runtime.sendMessage({ type: 'GET_RESUMES' }, ({ resumes } = {}) => {
    if (resumes && resumes.length > 1) populateResumeSelect(resumes);
  });
}

async function showConnected() {
  screenSetup.style.display = 'none';
  screenConnected.style.display = 'flex';
  chrome.storage.local.get(['cachedProfile', 'selectedResumeId'], ({ cachedProfile, selectedResumeId }) => {
    renderProfile(cachedProfile);
    if (selectedResumeId) resumeSelect.value = selectedResumeId;
  });
  loadResumes();

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
    // allFrames: true so we reach forms embedded in iframes (Workday, Taleo, iCIMS, etc.)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: doFillForm,
      args: [profile, FIELD_MAP],
    });
    count = (results || []).reduce((sum, r) => sum + (r?.result || 0), 0);
  } catch (err) {
    console.error('executeScript failed:', err);
    // Fallback: try main frame only
    try {
      const r2 = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: doFillForm,
        args: [profile, FIELD_MAP],
      });
      count = r2?.[0]?.result || 0;
    } catch {}
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

// Resume selection — re-fetch profile for selected resume
resumeSelect.addEventListener('change', () => {
  const resumeId = resumeSelect.value;
  chrome.storage.local.set({ selectedResumeId: resumeId });
  resumeSelect.disabled = true;
  chrome.runtime.sendMessage({ type: 'GET_PROFILE', resumeId }, ({ profile } = {}) => {
    resumeSelect.disabled = false;
    if (profile) renderProfile(profile);
  });
});

// Refresh profile
btnRefresh.addEventListener('click', () => {
  const resumeId = resumeSelect.value || 'profile';
  btnRefresh.textContent = 'Refreshing…';
  chrome.runtime.sendMessage({ type: 'GET_PROFILE', resumeId }, ({ profile } = {}) => {
    renderProfile(profile);
    btnRefresh.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Refresh Profile`;
  });
});

// Disconnect
btnDisconnect.addEventListener('click', () => {
  chrome.storage.local.remove(['pluginToken', 'cachedProfile', 'selectedResumeId'], () => {
    screenConnected.style.display = 'none';
    screenSetup.style.display = 'flex';
    tokenInput.value = '';
  });
});
