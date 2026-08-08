// chrome-extension/config.js
//
// Configuration for the CareerCraft Chrome Extension.
// Update API_BASE and APP_ORIGIN to match your deployed environment.
//
// For local development these default to localhost automatically.
// For production:
//   API_BASE  = your Cloud Run backend URL  (e.g. https://backend-xxxx.run.app)
//   APP_ORIGIN = your Next.js frontend URL  (e.g. https://careercraft.example.com)

const IS_DEV = !('update_url' in chrome.runtime.getManifest());

const API_BASE  = IS_DEV
  ? 'http://localhost:5000'
  : 'https://YOUR_BACKEND_CLOUD_RUN_URL';   // ← replace before releasing

const APP_ORIGIN = IS_DEV
  ? 'http://localhost:3000'
  : 'https://YOUR_FRONTEND_URL';            // ← replace before releasing
