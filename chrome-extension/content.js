// content.js

// 1. Sync authentication & profile details from portal website if open
if (window.location.host.includes('localhost:3000')) {
  // Check local storage periodically for active session
  setInterval(() => {
    const sessionStr = localStorage.getItem('recruitedge_mock_session');
    if (sessionStr) {
      try {
        const sessionObj = JSON.parse(sessionStr);
        chrome.storage.local.get(['userProfile'], (result) => {
          if (!result.userProfile || result.userProfile.id !== sessionObj.id) {
            chrome.storage.local.set({
              userProfile: {
                id: sessionObj.id,
                name: sessionObj.name || 'Jane Doe',
                email: sessionObj.email || 'developer@recruitedge.mock',
                role: sessionObj.role || 'candidate'
              },
              authToken: `mock_token_for_${sessionObj.id}`
            }, () => {
              console.log("[CareerCraft Extension] Successfully synchronized profile session.");
            });
          }
        });
      } catch (e) {
        console.error("Error reading session:", e);
      }
    }
  }, 3000);
}

// 2. Helper function to trigger change events so dynamic JS frameworks (React, Angular) update their state
function triggerInputChange(element, value) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// 3. Main Autofill logic
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autofill') {
    const profile = request.profile;
    const token = request.token;

    autofillForm(profile, token)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep message channel open for async sendResponse
  }
});

async function autofillForm(profile, token) {
  sendLog("Form matching in progress...");

  // Match inputs
  const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
  const customQuestions = [];

  for (const input of inputs) {
    if (input.type === 'hidden' || input.style.display === 'none') continue;

    const labelText = getLabelText(input).toLowerCase();
    const inputName = (input.name || '').toLowerCase();
    const inputId = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();

    // Match criteria
    const isFirstName = /first.*name|given.*name/i.test(labelText) || /first.*name/i.test(inputName);
    const isLastName = /last.*name|family.*name|surname/i.test(labelText) || /last.*name/i.test(inputName);
    const isFullName = (!isFirstName && !isLastName && (/name/i.test(labelText) || /name/i.test(inputName)));
    const isEmail = /email|e-mail/i.test(labelText) || /email/i.test(inputName) || input.type === 'email';
    const isPhone = /phone|tel|mobile/i.test(labelText) || /phone|tel/i.test(inputName) || input.type === 'tel';
    const isLinkedIn = /linkedin/i.test(labelText) || /linkedin/i.test(inputName);
    const isGitHub = /github/i.test(labelText) || /github/i.test(inputName);
    const isWebsite = /website|portfolio|homepage/i.test(labelText) || /website|portfolio/i.test(inputName);

    if (isFirstName) {
      const firstName = profile.name.split(' ')[0] || profile.name;
      triggerInputChange(input, firstName);
      sendLog(`Filled First Name: ${firstName}`);
    } else if (isLastName) {
      const lastName = profile.name.split(' ').slice(1).join(' ') || 'Doe';
      triggerInputChange(input, lastName);
      sendLog(`Filled Last Name: ${lastName}`);
    } else if (isFullName) {
      triggerInputChange(input, profile.name);
      sendLog(`Filled Full Name: ${profile.name}`);
    } else if (isEmail) {
      triggerInputChange(input, profile.email);
      sendLog(`Filled Email: ${profile.email}`);
    } else if (isPhone) {
      const phone = profile.phone || '555-0199';
      triggerInputChange(input, phone);
      sendLog(`Filled Phone Number: ${phone}`);
    } else if (isLinkedIn) {
      const li = profile.linkedin || 'https://linkedin.com/in/johndoe';
      triggerInputChange(input, li);
      sendLog(`Filled LinkedIn Profile: ${li}`);
    } else if (isGitHub) {
      const gh = profile.github || 'https://github.com/johndoe';
      triggerInputChange(input, gh);
      sendLog(`Filled GitHub Profile: ${gh}`);
    } else if (isWebsite) {
      const site = profile.portfolio || 'https://johndoe.dev';
      triggerInputChange(input, site);
      sendLog(`Filled Portfolio Website: ${site}`);
    } else if (input.type === 'file' && (inputId.includes('resume') || inputName.includes('resume') || labelText.includes('resume') || labelText.includes('cv'))) {
      // Handle resume file attachment
      await attachResumeFile(input, profile.id, token);
    } else if (input.tagName === 'TEXTAREA' || (input.tagName === 'INPUT' && input.type === 'text')) {
      // Potential custom question! Add to custom questions list for Gemini matching
      if (labelText && labelText.length > 5 && !labelText.includes('address') && !labelText.includes('city') && !labelText.includes('state')) {
        customQuestions.push({
          label: getLabelText(input),
          element: input
        });
      }
    }
  }

  // Handle custom questions with AI
  if (customQuestions.length > 0) {
    sendLog(`Found ${customQuestions.length} custom questions. Solving with CareerCraft AI...`);
    const questionLabels = customQuestions.map(q => q.label);
    
    try {
      const answers = await solveCustomQuestions(questionLabels, profile.id, token);
      customQuestions.forEach((q, idx) => {
        const answer = answers[idx] || "N/A";
        triggerInputChange(q.element, answer);
        sendLog(`Filled Custom Answer: "${q.label.substring(0, 30)}..." -> "${answer.substring(0, 20)}..."`);
      });
    } catch (e) {
      sendLog(`Failed solving custom questions: ${e.message}`, 'error');
    }
  }

  sendLog("Application filling completed!", "success", true);
}

// Locate label text for any input element
function getLabelText(input) {
  // 1. Direct label association via 'for' attribute
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText.trim();
  }
  // 2. Parent label element
  const parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.innerText.trim();
  
  // 3. Neighboring text or preceding div/span
  const sibling = input.previousElementSibling;
  if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName === 'DIV' || sibling.tagName === 'SPAN')) {
    return sibling.innerText.trim();
  }

  // 4. Fallback: placeholder or name attribute
  return input.placeholder || input.name || "";
}

// Fetch user profile resume data and upload it to the input field
async function attachResumeFile(fileInput, candidateId, token) {
  sendLog("Fetching resume file from CareerCraft database...");
  try {
    // Generate a mock PDF resume blob locally since it is simple for testing
    // In production, we fetch from `/api/generate-pdf` endpoint
    const response = await fetch('http://localhost:5000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        personal: { name: "Jane Doe", email: "developer@recruitedge.mock" },
        summary: "Full Stack Engineer with 3+ years experience.",
        skills: ["React", "Flask", "Firestore"]
      })
    });

    if (!response.ok) throw new Error("Could not generate PDF");

    const blob = await response.blob();
    const file = new File([blob], "Jane_Doe_Resume.pdf", { type: "application/pdf" });

    // Inject file into input element using DataTransfer APIs
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    
    // Dispatch events
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    sendLog("✔ Resume attached successfully.");
  } catch (err) {
    sendLog(`Error uploading resume: ${err.message}`, 'error');
  }
}

// Call backend API to solve custom questions using Gemini
async function solveCustomQuestions(questions, candidateId, token) {
  const response = await fetch('http://localhost:5000/api/auto-apply/solve-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      candidateId: candidateId,
      questions: questions
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed API response");
  }

  const data = await response.json();
  return data.answers || []; // array of strings matching the index of questions
}

// Send logs to popup window
function sendLog(text, logType = 'info', completed = false) {
  chrome.runtime.sendMessage({
    action: 'log',
    text: text,
    logType: logType,
    completed: completed
  });
}
