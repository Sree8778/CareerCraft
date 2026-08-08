// popup.js
// config.js is loaded before this script via popup.html script tag.
// APP_ORIGIN is available as a global from config.js.

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot        = document.getElementById('statusDot');
  const statusText       = document.getElementById('statusText');
  const profileInfo      = document.getElementById('profileInfo');
  const jobCard          = document.getElementById('jobCard');
  const detectedJobTitle = document.getElementById('detectedJobTitle');
  const detectedJobSource= document.getElementById('detectedJobSource');
  const autofillBtn      = document.getElementById('autofillBtn');
  const logBox           = document.getElementById('logBox');

  // ── Helper: append a log entry inside the popup ──────────────────────────
  function log(message, type = 'info') {
    logBox.style.display = 'block';
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ── 1. Check chrome.storage.local for an authenticated session ───────────
  // The CareerCraft web app writes the real Firebase ID token via:
  //   chrome.storage.local.set({ userProfile: { id, name, email, ... }, authToken: idToken })
  // on the Settings → Connect Extension page (triggered by the user).
  chrome.storage.local.get(['userProfile', 'authToken'], (result) => {
    if (result.userProfile && result.authToken) {
      statusDot.classList.add('connected');
      statusText.innerText = 'Connected';

      const profile = result.userProfile;
      // Escape HTML to avoid XSS from stored profile data
      const safeName  = (profile.name  || 'Candidate').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeEmail = (profile.email || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      profileInfo.innerHTML = `
        <div class="profile-name">${safeName}</div>
        <div class="profile-email">${safeEmail}</div>
        <div style="font-size: 11px; margin-top: 4px; color: var(--success);">✔ Profile Synced</div>
      `;

      checkCurrentTab(result.userProfile, result.authToken);
    } else {
      statusDot.classList.remove('connected');
      statusText.innerText = 'Disconnected';
      profileInfo.innerHTML = `
        <div style="font-size: 12px; color: var(--muted, #888); line-height: 1.5;">
          Not connected. Open <a href="${APP_ORIGIN}/candidate/settings" target="_blank"
            style="color: var(--accent, #6366f1);">CareerCraft Settings</a> and click
          <strong>Connect Extension</strong> to link your account.
        </div>
      `;
    }
  });

  // ── 2. Check current tab for a supported job-board URL ───────────────────
  function checkCurrentTab(profile, token) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      const tab = tabs[0];
      const url = tab.url || '';

      let source = '';
      if (url.includes('indeed.com'))    source = 'Indeed';
      else if (url.includes('greenhouse.io')) source = 'Greenhouse';
      else if (url.includes('lever.co'))     source = 'Lever';

      if (source) {
        jobCard.style.display = 'block';
        detectedJobTitle.innerText  = tab.title.split('-')[0]?.trim() || 'Job Application Form';
        detectedJobSource.innerText = `Platform: ${source}`;
        autofillBtn.disabled = false;

        autofillBtn.onclick = () => {
          autofillBtn.disabled = true;
          log('Starting form analysis...', 'info');

          chrome.tabs.sendMessage(tab.id, { action: 'autofill', profile, token }, (response) => {
            if (chrome.runtime.lastError) {
              log(`Error: ${chrome.runtime.lastError.message}`, 'error');
              autofillBtn.disabled = false;
              return;
            }
            if (response && response.success) {
              log('Auto-fill process initiated!', 'success');
            } else {
              log(`Auto-fill failed: ${response?.error || 'Unknown error'}`, 'error');
              autofillBtn.disabled = false;
            }
          });
        };
      }
    });
  }

  // ── 3. Receive log messages from the content script ──────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'log') {
      log(message.text, message.logType || 'info');
      if (message.completed) {
        autofillBtn.disabled = false;
      }
    }
  });
});
