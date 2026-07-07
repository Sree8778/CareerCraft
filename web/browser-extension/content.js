// ATS detection
function detectATS() {
  const url = location.href;
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co/.test(url)) return 'lever';
  if (/jobs\.ashbyhq\.com/.test(url)) return 'ashby';
  if (/apply\.workable\.com/.test(url)) return 'workable';
  if (/jobs\.smartrecruiters\.com/.test(url)) return 'smartrecruiters';
  if (/myworkdayjobs\.com/.test(url)) return 'workday';
  if (/indeed\.com/.test(url)) return 'indeed';
  if (/linkedin\.com\/jobs/.test(url)) return 'linkedin';
  return null;
}

// Field matching
const FIELD_MAP = [
  { keys: ['first.*name', 'first_name', 'firstname'], profileKey: 'firstName' },
  { keys: ['last.*name', 'last_name', 'lastname'], profileKey: 'lastName' },
  { keys: ['full.*name', 'name', 'your.*name'], profileKey: 'name' },
  { keys: ['email', 'e-mail', 'email.*address'], profileKey: 'email' },
  { keys: ['phone', 'mobile', 'cell', 'telephone'], profileKey: 'phone' },
  { keys: ['location', 'city', 'address', 'where.*based'], profileKey: 'location' },
  { keys: ['linkedin', 'linked.*in'], profileKey: 'linkedin' },
  { keys: ['website', 'portfolio', 'personal.*site', 'url'], profileKey: 'website' },
  { keys: ['summary', 'cover.*letter', 'about.*you', 'tell.*us'], profileKey: 'summary' },
  { keys: ['current.*company', 'employer', 'company'], profileKey: 'currentCompany' },
  { keys: ['title', 'job.*title', 'current.*title', 'role'], profileKey: 'headline' },
];

function resolveValue(profile, key) {
  const parts = profile.name?.split(' ') || [];
  const extras = {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
  const merged = { ...profile, ...extras };
  return merged[key] || '';
}

function matchesField(labelText, fieldName, profileKey) {
  const haystack = `${labelText} ${fieldName}`.toLowerCase();
  return FIELD_MAP.find(m =>
    m.profileKey === profileKey &&
    m.keys.some(pattern => new RegExp(pattern, 'i').test(haystack))
  );
}

function findMatchingField(el, profile) {
  const name = (el.name || el.id || '').toLowerCase();
  const placeholder = (el.placeholder || '').toLowerCase();
  const label = (() => {
    if (el.labels?.[0]) return el.labels[0].textContent.toLowerCase();
    const ariaLabel = el.getAttribute('aria-label') || '';
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const lblEl = document.getElementById(labelledBy);
      if (lblEl) return lblEl.textContent.toLowerCase();
    }
    const parent = el.closest('label, [class*="field"], [class*="form-group"], [class*="input"]');
    if (parent) return parent.textContent.toLowerCase();
    return ariaLabel.toLowerCase();
  })();

  const haystack = `${label} ${name} ${placeholder}`;

  for (const mapping of FIELD_MAP) {
    if (mapping.keys.some(pat => new RegExp(pat, 'i').test(haystack))) {
      return resolveValue(profile, mapping.profileKey);
    }
  }
  return null;
}

function fillField(el, value) {
  if (!value) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return false;
  if (el.value === value) return true;

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function fillForm(profile) {
  const inputs = document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea');
  let filled = 0;
  inputs.forEach(el => {
    const value = findMatchingField(el, profile);
    if (value && fillField(el, value)) filled++;
  });
  return filled;
}

function getJobMeta() {
  const ats = detectATS();
  let title = document.title;
  let company = '';

  // Try OG / structured data
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  if (ogTitle) title = ogTitle;

  // ATS-specific selectors
  if (ats === 'greenhouse') {
    title = document.querySelector('.job-title, h1.app-title, h1')?.textContent?.trim() || title;
    company = document.querySelector('.company-name, .company')?.textContent?.trim() || '';
  } else if (ats === 'lever') {
    title = document.querySelector('.posting-header h2, h2')?.textContent?.trim() || title;
    company = document.querySelector('.main-header-logo img')?.alt || document.querySelector('.posting-categories .sort-by-team')?.textContent?.trim() || '';
  } else if (ats === 'ashby') {
    title = document.querySelector('h1[class*="title"], h1')?.textContent?.trim() || title;
    company = document.querySelector('[class*="company"], [class*="org"]')?.textContent?.trim() || '';
  } else if (ats === 'workday') {
    title = document.querySelector('[data-automation-id="jobPostingHeader"] h2, h2')?.textContent?.trim() || title;
    company = document.querySelector('[data-automation-id="company"] p')?.textContent?.trim() || '';
  }

  return { title, company, url: location.href, ats };
}

// Inject floating button
let _overlay = null;
function injectOverlay(profile) {
  if (_overlay) return;
  _overlay = document.createElement('div');
  _overlay.id = '__cc_overlay';
  _overlay.innerHTML = `
    <div style="
      position:fixed; bottom:24px; right:24px; z-index:2147483647;
      background:linear-gradient(135deg,#6d28d9,#4f46e5);
      color:#fff; border-radius:16px; padding:12px 18px;
      box-shadow:0 8px 32px rgba(79,70,229,0.5);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:13px; font-weight:700; cursor:pointer;
      display:flex; align-items:center; gap:8px;
      border:1px solid rgba(255,255,255,0.15);
      transition:transform .15s,box-shadow .15s;
      user-select:none;
    " id="__cc_btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
      Auto-Fill with CareerCraft
    </div>
    <div id="__cc_status" style="
      position:fixed; bottom:78px; right:24px; z-index:2147483647;
      background:#18181b; color:#a1a1aa; border-radius:12px; padding:8px 14px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:12px; box-shadow:0 4px 16px rgba(0,0,0,0.4);
      border:1px solid rgba(255,255,255,0.1); display:none;
    "></div>
  `;
  document.body.appendChild(_overlay);

  const btn = document.getElementById('__cc_btn');
  const status = document.getElementById('__cc_status');

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 12px 40px rgba(79,70,229,0.7)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.boxShadow = '0 8px 32px rgba(79,70,229,0.5)';
  });

  btn.addEventListener('click', async () => {
    status.style.display = 'block';
    status.textContent = 'Filling form…';
    const filled = fillForm(profile);
    if (filled > 0) {
      status.style.color = '#4ade80';
      status.textContent = `Filled ${filled} field${filled > 1 ? 's' : ''} successfully!`;
      const meta = getJobMeta();
      chrome.runtime.sendMessage({
        type: 'RECORD_APPLIED',
        data: { jobTitle: meta.title, company: meta.company, jobUrl: meta.url, ats: meta.ats },
      });
    } else {
      status.style.color = '#f87171';
      status.textContent = 'No matching fields found on this page.';
    }
    setTimeout(() => { status.style.display = 'none'; }, 3500);
  });
}

// Message handler for popup-triggered fill
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FILL_FORM') {
    const profile = msg.profile;
    if (!profile) { sendResponse({ filled: 0 }); return; }
    const filled = fillForm(profile);
    if (filled > 0) {
      const meta = getJobMeta();
      chrome.runtime.sendMessage({
        type: 'RECORD_APPLIED',
        data: { jobTitle: meta.title, company: meta.company, jobUrl: meta.url, ats: meta.ats },
      });
    }
    sendResponse({ filled });
  }
});

// Init
(async () => {
  const ats = detectATS();
  if (!ats) return;

  chrome.runtime.sendMessage({ type: 'GET_CACHED_PROFILE' }, ({ profile }) => {
    if (profile) {
      injectOverlay(profile);
    } else {
      chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, ({ profile: p }) => {
        if (p) injectOverlay(p);
      });
    }
  });
})();
