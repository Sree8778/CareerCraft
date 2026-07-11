// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const profileInfo = document.getElementById('profileInfo');
  const jobCard = document.getElementById('jobCard');
  const detectedJobTitle = document.getElementById('detectedJobTitle');
  const detectedJobSource = document.getElementById('detectedJobSource');
  const autofillBtn = document.getElementById('autofillBtn');
  const logBox = document.getElementById('logBox');

  // Helper to log messages inside popup
  function log(message, type = 'info') {
    logBox.style.display = 'block';
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // 1. Check local storage for authenticated profile data synced from career portal
  chrome.storage.local.get(['userProfile', 'authToken'], (result) => {
    if (result.userProfile && result.authToken) {
      statusDot.classList.add('connected');
      statusText.innerText = 'Connected';
      
      const profile = result.userProfile;
      profileInfo.innerHTML = `
        <div class="profile-name">${profile.name || 'Candidate'}</div>
        <div class="profile-email">${profile.email || ''}</div>
        <div style="font-size: 11px; margin-top: 4px; color: var(--success);">✔ Profile Synced</div>
      `;
      
      // Enable autofill if we are on a valid form page
      checkCurrentTab(result.userProfile, result.authToken);
    } else {
      statusDot.classList.remove('connected');
      statusText.innerText = 'Disconnected';
    }
  });

  // 2. Check current tab URL to see if it matches supported job boards
  function checkCurrentTab(profile, token) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const tab = tabs[0];
      const url = tab.url;

      let source = '';
      if (url.includes('indeed.com')) source = 'Indeed';
      else if (url.includes('greenhouse.io')) source = 'Greenhouse';
      else if (url.includes('lever.co')) source = 'Lever';

      if (source) {
        jobCard.style.display = 'block';
        detectedJobTitle.innerText = tab.title.split('-')[0] || 'Job Application Form';
        detectedJobSource.innerText = `Platform: ${source}`;
        autofillBtn.disabled = false;

        // Set button listener
        autofillBtn.onclick = () => {
          autofillBtn.disabled = true;
          log('Starting form analysis...', 'info');
          
          // Send message to content script of the active tab to start filling
          chrome.tabs.sendMessage(tab.id, { 
            action: 'autofill', 
            profile: profile,
            token: token
          }, (response) => {
            if (chrome.runtime.lastError) {
              log(`Error connecting to tab: ${chrome.runtime.lastError.message}`, 'error');
              autofillBtn.disabled = false;
              return;
            }
            if (response && response.success) {
              log('Auto-fill process initiated successfully!', 'success');
            } else {
              log(`Auto-fill failed: ${response?.error || 'Unknown error'}`, 'error');
              autofillBtn.disabled = false;
            }
          });
        };
      }
    });
  }

  // Listen to status updates sent from the content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'log') {
      log(message.text, message.logType || 'info');
      if (message.completed) {
        autofillBtn.disabled = false;
      }
    }
  });
});
