const API_BASE = 'https://careercraft-backend-u7h4zjepfq-uc.a.run.app/api';

async function getToken() {
  return new Promise(resolve => chrome.storage.local.get(['pluginToken'], r => resolve(r.pluginToken || null)));
}

async function fetchProfile(resumeId) {
  const token = await getToken();
  if (!token) return null;
  try {
    const url = resumeId && resumeId !== 'profile'
      ? `${API_BASE}/plugin/profile?resume_id=${encodeURIComponent(resumeId)}`
      : `${API_BASE}/plugin/profile`;
    const res = await fetch(url, { headers: { Authorization: `PluginToken ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchResumes() {
  const token = await getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE}/plugin/resumes`, {
      headers: { Authorization: `PluginToken ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.resumes || [];
  } catch {
    return [];
  }
}

async function recordApplied(data) {
  const token = await getToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/plugin/applied`, {
      method: 'POST',
      headers: {
        Authorization: `PluginToken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch {}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PROFILE') {
    const resumeId = msg.resumeId || 'profile';
    fetchProfile(resumeId).then(profile => {
      if (profile) chrome.storage.local.set({ cachedProfile: profile });
      sendResponse({ profile });
    });
    return true;
  }

  if (msg.type === 'GET_RESUMES') {
    fetchResumes().then(resumes => sendResponse({ resumes }));
    return true;
  }

  if (msg.type === 'RECORD_APPLIED') {
    recordApplied(msg.data).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_CACHED_PROFILE') {
    chrome.storage.local.get(['cachedProfile'], r => sendResponse({ profile: r.cachedProfile || null }));
    return true;
  }

  if (msg.type === 'VERIFY_TOKEN') {
    const { token } = msg;
    fetch(`${API_BASE}/plugin/profile`, {
      headers: { Authorization: `PluginToken ${token}` },
    }).then(async res => {
      if (res.ok) {
        const profile = await res.json();
        chrome.storage.local.set({ pluginToken: token, cachedProfile: profile });
        sendResponse({ ok: true, profile });
      } else {
        sendResponse({ ok: false, error: 'Invalid token' });
      }
    }).catch(() => sendResponse({ ok: false, error: 'Network error' }));
    return true;
  }
});
