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

// FIELD_MAP — ordered specific → general to avoid false matches
const FIELD_MAP = [
  { keys: ['first.?name', 'first_name', 'firstname', 'fname', 'given.?name', 'forename'], profileKey: 'firstName' },
  { keys: ['last.?name', 'last_name', 'lastname', 'lname', 'family.?name', 'surname'], profileKey: 'lastName' },
  { keys: ['middle.?name', 'middle_name', 'middlename', 'mname'], profileKey: 'middleName' },
  { keys: ['e.?mail', 'email.?address', 'email.?id'], profileKey: 'email' },
  { keys: ['phone', 'mobile', 'cell', 'telephone', 'tel', 'contact.?number', 'phone.?number'], profileKey: 'phone' },
  { keys: ['linkedin', 'linked.?in'], profileKey: 'linkedin' },
  { keys: ['website', 'portfolio', 'personal.?site', 'web.?site', 'homepage', 'personal.?url'], profileKey: 'website' },
  { keys: ['current.?company', 'current.?employer', 'employer', 'organization', 'organisation'], profileKey: 'currentCompany' },
  { keys: ['job.?title', 'current.?title', 'current.?position', 'position.?title', 'headline', 'designation'], profileKey: 'headline' },
  { keys: ['city', 'location', 'current.?location', 'where.?are.?you', 'based.?in', 'zip', 'postal', 'address'], profileKey: 'location' },
  { keys: ['cover.?letter', 'cover.?note', 'about.?yourself', 'tell.?us', 'additional.?info', 'message', 'introduction', 'summary', 'why.?interested', 'motivation'], profileKey: 'summary' },
  { keys: ['\\bname\\b', 'full.?name', 'your.?name', 'applicant.?name', 'candidate.?name', 'contact.?name'], profileKey: 'name' },
];

function resolveValue(profile, key) {
  const nameParts = (profile.name || '').trim().split(/\s+/);
  const extras = {
    firstName:  nameParts[0] || '',
    lastName:   nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '',
  };
  return ({ ...profile, ...extras })[key] || '';
}

// Aggressive label extraction — walks DOM, checks all common label patterns
function getFieldHaystack(el) {
  const parts = [];

  const push = str => { if (str && str.trim()) parts.push(str.trim().toLowerCase()); };

  // Direct attributes
  push(el.name?.replace(/[_\-]/g, ' '));
  push(el.id?.replace(/[_\-]/g, ' '));
  push(el.placeholder);
  push(el.getAttribute('aria-label'));
  push(el.getAttribute('data-label'));
  push(el.getAttribute('data-field'));
  push(el.getAttribute('data-testid')?.replace(/[_\-]/g, ' '));

  // aria-labelledby — may reference multiple ids
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach(id => {
      const lbl = document.getElementById(id);
      if (lbl) push(lbl.textContent);
    });
  }

  // Native <label for="id"> association
  if (el.id) {
    document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`).forEach(l => push(l.textContent));
  }
  if (el.labels?.length) {
    Array.from(el.labels).forEach(l => push(l.textContent));
  }

  // Walk up DOM — at each level check for label-like elements
  let node = el.parentElement;
  for (let depth = 0; depth < 8 && node && node !== document.body; depth++) {
    // If the parent itself is a <label>
    if (node.tagName === 'LABEL') { push(node.textContent); break; }

    // Check previous siblings (label often sits before input wrapper)
    let sib = node.previousElementSibling;
    for (let s = 0; s < 3 && sib; s++, sib = sib.previousElementSibling) {
      const tag = sib.tagName.toLowerCase();
      const text = sib.textContent.trim();
      if (text.length > 0 && text.length < 100 &&
          ['label', 'span', 'p', 'div', 'legend', 'dt', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        push(text);
      }
    }

    // Check first text-only child of parent (label above input in same wrapper)
    const firstTextChild = node.querySelector('label, [class*="label" i], [class*="Label"], legend');
    if (firstTextChild && !firstTextChild.contains(el)) {
      const text = firstTextChild.textContent.trim();
      if (text.length > 0 && text.length < 100) push(text);
    }

    node = node.parentElement;
  }

  // fieldset/legend
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) push(legend.textContent);
  }

  return parts.join(' ');
}

function findMatchingField(el, profile) {
  const haystack = getFieldHaystack(el);
  if (!haystack) return null;

  for (const mapping of FIELD_MAP) {
    if (mapping.keys.some(pat => new RegExp(pat, 'i').test(haystack))) {
      return resolveValue(profile, mapping.profileKey);
    }
  }
  return null;
}

function fillField(el, value) {
  if (!value) return false;
  if (el.tagName.toLowerCase() === 'select') return false;
  if (el.value === value) return false; // already filled, don't count as filled

  el.focus();

  // Use native setter so React/Vue/Angular see the change
  const proto = el.tagName.toLowerCase() === 'textarea'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;

  ['input', 'change', 'blur'].forEach(evt =>
    el.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }))
  );

  // For frameworks that need KeyboardEvent (e.g. some Workday builds)
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  return true;
}

function fillForm(profile) {
  const inputs = document.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=image]):not([type=reset]), textarea'
  );
  let filled = 0;
  inputs.forEach(el => {
    if (el.disabled || el.readOnly) return;
    const value = findMatchingField(el, profile);
    if (value && fillField(el, value)) filled++;
  });
  return filled;
}

function getJobMeta() {
  const ats = detectATS();
  let title = document.querySelector('meta[property="og:title"]')?.content || document.title;
  let company = document.querySelector('meta[property="og:site_name"]')?.content || '';

  if (ats === 'greenhouse') {
    title = document.querySelector('.job-title, h1.app-title, h1')?.textContent?.trim() || title;
    company = document.querySelector('.company-name, .company')?.textContent?.trim() || company;
  } else if (ats === 'lever') {
    title = document.querySelector('.posting-header h2, h2')?.textContent?.trim() || title;
    company = document.querySelector('.main-header-logo img')?.alt || company;
  } else if (ats === 'ashby') {
    title = document.querySelector('h1')?.textContent?.trim() || title;
  } else if (ats === 'workday') {
    title = document.querySelector('[data-automation-id="jobPostingHeader"] h2, h2')?.textContent?.trim() || title;
  }

  return { title: title.slice(0, 200), company: company.slice(0, 100), url: location.href, ats };
}

// Floating overlay button
let _overlay = null;
function injectOverlay(profile) {
  if (document.getElementById('__cc_overlay')) return;
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
      transition:transform .15s,box-shadow .15s; user-select:none;
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
  btn.addEventListener('click', () => {
    status.style.display = 'block';
    status.textContent = 'Filling form…';
    const filled = fillForm(profile);
    if (filled > 0) {
      status.style.color = '#4ade80';
      status.textContent = `Filled ${filled} field${filled > 1 ? 's' : ''}!`;
      const meta = getJobMeta();
      chrome.runtime.sendMessage({
        type: 'RECORD_APPLIED',
        data: { jobTitle: meta.title, company: meta.company, jobUrl: meta.url, ats: meta.ats },
      });
    } else {
      status.style.color = '#f87171';
      status.textContent = 'No fillable fields detected. Try scrolling to the form first.';
    }
    setTimeout(() => { status.style.display = 'none'; }, 4000);
  });
}

// Message handler — popup-triggered fill
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FILL_FORM') {
    const profile = msg.profile;
    if (!profile) { sendResponse({ filled: 0 }); return true; }
    const filled = fillForm(profile);
    if (filled > 0) {
      const meta = getJobMeta();
      chrome.runtime.sendMessage({
        type: 'RECORD_APPLIED',
        data: { jobTitle: meta.title, company: meta.company, jobUrl: meta.url, ats: meta.ats },
      });
    }
    sendResponse({ filled });
    return true;
  }
});

// Auto-init overlay (guard via DOM element check prevents duplicates on re-injection)
if (!document.getElementById('__cc_overlay')) {
  chrome.runtime.sendMessage({ type: 'GET_CACHED_PROFILE' }, ({ profile } = {}) => {
    if (profile) {
      injectOverlay(profile);
    } else {
      chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, ({ profile: p } = {}) => {
        if (p) injectOverlay(p);
      });
    }
  });
}
