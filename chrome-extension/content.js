// content.js
// config.js is injected before this file (see manifest.json content_scripts order).
// API_BASE and APP_ORIGIN are available as globals from config.js.

// ── Helper: trigger React/Angular state updates ──────────────────────────────
function triggerInputChange(element, value) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Main: listen for autofill messages from the popup ────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autofill') {
    const profile = request.profile;
    const token   = request.token;

    autofillForm(profile, token)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep message channel open for async sendResponse
  }
});

// ── Autofill logic ────────────────────────────────────────────────────────────
async function autofillForm(profile, token) {
  sendLog('Form matching in progress...');

  const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
  const customQuestions = [];

  for (const input of inputs) {
    if (input.type === 'hidden' || input.style.display === 'none') continue;

    const labelText  = getLabelText(input).toLowerCase();
    const inputName  = (input.name  || '').toLowerCase();
    const inputId    = (input.id    || '').toLowerCase();

    const isFirstName = /first.*name|given.*name/i.test(labelText) || /first.*name/i.test(inputName);
    const isLastName  = /last.*name|family.*name|surname/i.test(labelText)  || /last.*name/i.test(inputName);
    const isFullName  = (!isFirstName && !isLastName && (/name/i.test(labelText) || /name/i.test(inputName)));
    const isEmail     = /email|e-mail/i.test(labelText) || /email/i.test(inputName) || input.type === 'email';
    const isPhone     = /phone|tel|mobile/i.test(labelText) || /phone|tel/i.test(inputName) || input.type === 'tel';
    const isLinkedIn  = /linkedin/i.test(labelText) || /linkedin/i.test(inputName);
    const isGitHub    = /github/i.test(labelText)   || /github/i.test(inputName);
    const isWebsite   = /website|portfolio|homepage/i.test(labelText) || /website|portfolio/i.test(inputName);

    if (isFirstName) {
      const firstName = profile.name.split(' ')[0] || profile.name;
      triggerInputChange(input, firstName);
      sendLog(`Filled First Name: ${firstName}`);
    } else if (isLastName) {
      const lastName = profile.name.split(' ').slice(1).join(' ') || '';
      triggerInputChange(input, lastName);
      sendLog(`Filled Last Name: ${lastName}`);
    } else if (isFullName) {
      triggerInputChange(input, profile.name);
      sendLog(`Filled Full Name: ${profile.name}`);
    } else if (isEmail) {
      triggerInputChange(input, profile.email);
      sendLog(`Filled Email: ${profile.email}`);
    } else if (isPhone) {
      const phone = profile.phone || '';
      triggerInputChange(input, phone);
      sendLog(`Filled Phone: ${phone}`);
    } else if (isLinkedIn) {
      const li = profile.linkedin || '';
      triggerInputChange(input, li);
      sendLog(`Filled LinkedIn: ${li}`);
    } else if (isGitHub) {
      const gh = profile.github || '';
      triggerInputChange(input, gh);
      sendLog(`Filled GitHub: ${gh}`);
    } else if (isWebsite) {
      const site = profile.portfolio || '';
      triggerInputChange(input, site);
      sendLog(`Filled Website: ${site}`);
    } else if (
      input.type === 'file' &&
      (inputId.includes('resume') || inputName.includes('resume') ||
       labelText.includes('resume') || labelText.includes('cv'))
    ) {
      await attachResumeFile(input, profile.id, token);
    } else if (
      (input.tagName === 'TEXTAREA' || (input.tagName === 'INPUT' && input.type === 'text')) &&
      labelText && labelText.length > 5 &&
      !labelText.includes('address') && !labelText.includes('city') && !labelText.includes('state')
    ) {
      customQuestions.push({ label: getLabelText(input), element: input });
    }
  }

  if (customQuestions.length > 0) {
    sendLog(`Found ${customQuestions.length} custom questions. Solving with CareerCraft AI...`);
    try {
      const answers = await solveCustomQuestions(customQuestions.map(q => q.label), profile.id, token);
      customQuestions.forEach((q, idx) => {
        const answer = answers[idx] || '';
        triggerInputChange(q.element, answer);
        sendLog(`Filled: "${q.label.substring(0, 30)}..." → "${answer.substring(0, 30)}..."`);
      });
    } catch (e) {
      sendLog(`Failed solving custom questions: ${e.message}`, 'error');
    }
  }

  sendLog('Application filling completed!', 'success', true);
}

// ── Locate label text for any input element ───────────────────────────────────
function getLabelText(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText.trim();
  }
  const parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.innerText.trim();
  const sibling = input.previousElementSibling;
  if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName === 'DIV' || sibling.tagName === 'SPAN')) {
    return sibling.innerText.trim();
  }
  return input.placeholder || input.name || '';
}

// ── Fetch the candidate's resume PDF from the backend and attach it ───────────
async function attachResumeFile(fileInput, candidateId, token) {
  sendLog('Fetching resume from CareerCraft...');
  try {
    const response = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const blob  = await response.blob();
    const name  = `${(candidateId || 'resume').replace(/[^a-z0-9]/gi, '_')}_resume.pdf`;
    const file  = new File([blob], name, { type: 'application/pdf' });

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    sendLog('✔ Resume attached successfully.');
  } catch (err) {
    sendLog(`Error attaching resume: ${err.message}`, 'error');
  }
}

// ── Call backend to answer custom application questions via AI ─────────────────
async function solveCustomQuestions(questions, candidateId, token) {
  const response = await fetch(`${API_BASE}/api/auto-apply/solve-questions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ candidateId, questions }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.answers || [];
}

// ── Send log messages to the popup window ─────────────────────────────────────
function sendLog(text, logType = 'info', completed = false) {
  chrome.runtime.sendMessage({ action: 'log', text, logType, completed });
}
