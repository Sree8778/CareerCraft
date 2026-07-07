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

function detectATS(url) {
  for (const { pattern, label } of ATS_PATTERNS) {
    if (pattern.test(url)) return label;
  }
  return null;
}

async function getCurrentTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0] || null));
  });
}

function sendToContent(tabId, message) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

// DOM elements
const screenSetup = document.getElementById('screen-setup');
const screenConnected = document.getElementById('screen-connected');
const tokenInput = document.getElementById('token-input');
const btnConnect = document.getElementById('btn-connect');
const setupError = document.getElementById('setup-error');
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const atsIndicator = document.getElementById('ats-indicator');
const btnFill = document.getElementById('btn-fill');
const fillResult = document.getElementById('fill-result');
const btnRefresh = document.getElementById('btn-refresh');
const btnDisconnect = document.getElementById('btn-disconnect');

function showError(msg) {
  setupError.textContent = msg;
  setupError.style.display = 'block';
}

function renderProfile(profile) {
  if (!profile) return;
  const initials = (profile.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  profileAvatar.textContent = initials;
  profileName.textContent = profile.name || '—';
  profileEmail.textContent = profile.email || '';
}

async function showConnected() {
  screenSetup.style.display = 'none';
  screenConnected.style.display = 'flex';

  chrome.storage.local.get(['cachedProfile'], ({ cachedProfile }) => {
    renderProfile(cachedProfile);
  });

  const tab = await getCurrentTab();
  if (tab?.url) {
    const ats = detectATS(tab.url);
    if (ats) {
      atsIndicator.textContent = `${ats} detected`;
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
  if (pluginToken) {
    showConnected();
  }
});

// Connect flow
btnConnect.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) { showError('Please paste your plugin token.'); return; }
  setupError.style.display = 'none';
  btnConnect.textContent = 'Connecting…';
  btnConnect.disabled = true;

  chrome.runtime.sendMessage({ type: 'VERIFY_TOKEN', token }, ({ ok, profile, error }) => {
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect';
    if (ok) {
      renderProfile(profile);
      showConnected();
    } else {
      showError(error || 'Failed to connect. Check your token and try again.');
    }
  });
});

// Fill button — inject content script and trigger fill
btnFill.addEventListener('click', async () => {
  fillResult.style.display = 'none';
  const tab = await getCurrentTab();
  if (!tab) return;

  btnFill.disabled = true;
  btnFill.textContent = 'Filling…';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch {}

  const profile = await new Promise(resolve =>
    chrome.storage.local.get(['cachedProfile'], r => resolve(r.cachedProfile))
  );

  const res = await sendToContent(tab.id, { type: 'FILL_FORM', profile });
  const count = res?.filled || 0;

  fillResult.style.display = 'block';
  if (count > 0) {
    fillResult.className = 'fill-result success';
    fillResult.textContent = `Filled ${count} field${count > 1 ? 's' : ''} successfully!`;
  } else {
    fillResult.className = 'fill-result error';
    fillResult.textContent = 'No matching fields found on this page.';
  }

  btnFill.disabled = false;
  btnFill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Auto-Fill This Application`;
});

// Refresh profile
btnRefresh.addEventListener('click', () => {
  btnRefresh.textContent = 'Refreshing…';
  chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, ({ profile }) => {
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

// Handle FILL_FORM from popup manually (content.js already has its own init, but popup can trigger via scripting)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILL_RESULT') {
    fillResult.style.display = 'block';
    fillResult.className = `fill-result ${msg.filled > 0 ? 'success' : 'error'}`;
    fillResult.textContent = msg.filled > 0
      ? `Filled ${msg.filled} field${msg.filled > 1 ? 's' : ''}!`
      : 'No matching fields found.';
  }
});
