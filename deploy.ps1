# CareerCraft - Google Cloud Run deployment script
# Usage: .\deploy.ps1                  (full deploy)
#        .\deploy.ps1 -FrontendOnly    (rebuild + redeploy frontend only)
param([switch]$FrontendOnly)

# Do NOT use ErrorActionPreference Stop - gcloud writes info to stderr
# which PowerShell 5.1 treats as errors.

# --- 1. Load .env.cloud ---
$EnvFile = Join-Path $PSScriptRoot ".env.cloud"
if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing .env.cloud - copy .env.cloud.example, fill in values."
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq '') { return }
    $idx = $line.IndexOf('=')
    if ($idx -gt 0) {
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
}

$PROJECT      = [System.Environment]::GetEnvironmentVariable('GCP_PROJECT_ID',           'Process')
$REGION       = [System.Environment]::GetEnvironmentVariable('GCP_REGION',               'Process')
$GEMINI       = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY',            'Process')
$VAULT_KEY    = [System.Environment]::GetEnvironmentVariable('BACKEND_VAULT_MASTER_KEY',  'Process')
$RESEND       = [System.Environment]::GetEnvironmentVariable('RESEND_API_KEY',            'Process')
$EMAIL_FROM   = [System.Environment]::GetEnvironmentVariable('EMAIL_FROM',                'Process')
$PLATFORM_URL = [System.Environment]::GetEnvironmentVariable('PLATFORM_URL',             'Process')

# Base64-encode the Firebase service account JSON so it can be passed as a Cloud Run env var
# (credentials files are gitignored and excluded from Docker images)
$CREDS_FILE = Join-Path $PSScriptRoot "web\backend\credentials\firebase-adminsdk.json"
if (-not (Test-Path $CREDS_FILE)) {
    $CREDS_FILE = Join-Path $PSScriptRoot "web\backend\credentials.json"
}
$FB_CREDS_B64 = ""
if (Test-Path $CREDS_FILE) {
    $FB_CREDS_B64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($CREDS_FILE))
    Write-Host "Firebase credentials found and encoded." -ForegroundColor Green
} else {
    Write-Host "WARNING: Firebase credentials.json not found — Cloud Run will use ADC." -ForegroundColor DarkYellow
}

if (-not $VAULT_KEY) {
    Write-Error "BACKEND_VAULT_MASTER_KEY is missing from .env.cloud — API key decryption will fail in production!"
    exit 1
}

$BACKEND_SVC  = "careercraft-backend"
$FRONTEND_SVC = "careercraft-frontend"
$REPO         = "us-central1-docker.pkg.dev/$PROJECT/careercraft"
$BACKEND_IMG  = "$REPO/backend"
$FRONTEND_IMG = "$REPO/frontend"

Write-Host ""
Write-Host "=== CareerCraft Cloud Run Deployment ===" -ForegroundColor Cyan
Write-Host "Project : $PROJECT   Region : $REGION"

# --- 2. Set account + project ---
Write-Host ""
Write-Host "[1/7] Configuring gcloud..." -ForegroundColor Yellow
& gcloud config set account sreeramvarma8888@gmail.com
& gcloud config set project $PROJECT

# --- 3. Enable APIs ---
Write-Host ""
Write-Host "[2/7] Enabling Cloud Run, Artifact Registry, Cloud Build APIs..." -ForegroundColor Yellow
& gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
if ($LASTEXITCODE -ne 0) { Write-Host "Warning: some APIs may already be enabled, continuing..." -ForegroundColor DarkYellow }

# --- 4. Create Artifact Registry repo ---
Write-Host ""
Write-Host "[3/7] Creating Artifact Registry repo (skip if exists)..." -ForegroundColor Yellow
& gcloud artifacts repositories create careercraft `
    --repository-format=docker `
    --location=$REGION `
    --description="CareerCraft Docker images" `
    --quiet
# Ignore exit code - repo may already exist
& gcloud auth configure-docker "us-central1-docker.pkg.dev" --quiet

# --- 4b. Grant Cloud Build SA permission to push to Artifact Registry ---
Write-Host ""
Write-Host "[3b] Granting Cloud Build service account Artifact Registry write access..." -ForegroundColor Yellow
$PROJECT_NUMBER = (& gcloud projects describe $PROJECT --format "value(projectNumber)").Trim()
$CB_SA = "$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
Write-Host "Cloud Build SA: $CB_SA"
& gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$CB_SA" --role="roles/artifactregistry.writer" --quiet
& gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$CB_SA" --role="roles/run.admin" --quiet
& gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$CB_SA" --role="roles/iam.serviceAccountUser" --quiet

# --- 5. Build + deploy backend (skip if -FrontendOnly) ---
if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "[4/7] Building backend via Cloud Build (~5 min)..." -ForegroundColor Yellow
    $BackendDir = Join-Path $PSScriptRoot "web\backend"
    & gcloud builds submit $BackendDir --tag $BACKEND_IMG
    if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed."; exit 1 }

    Write-Host ""
    Write-Host "[5/7] Deploying backend to Cloud Run..." -ForegroundColor Yellow
    # Write env vars to a temp YAML file to handle long base64 values safely
    $envYamlPath = [System.IO.Path]::GetTempFileName() + ".yaml"
    @"
GEMINI_API_KEY: "$GEMINI"
BACKEND_VAULT_MASTER_KEY: "$VAULT_KEY"
FIREBASE_CREDENTIALS_B64: "$FB_CREDS_B64"
RESEND_API_KEY: "$RESEND"
EMAIL_FROM: "$EMAIL_FROM"
PLATFORM_URL: "$PLATFORM_URL"
"@ | Out-File -FilePath $envYamlPath -Encoding utf8 -NoNewline

    & gcloud run deploy $BACKEND_SVC `
        --image $BACKEND_IMG `
        --region $REGION `
        --platform managed `
        --allow-unauthenticated `
        --memory 2Gi `
        --cpu 1 `
        --max-instances 3 `
        --timeout 300 `
        --env-vars-file $envYamlPath `
        --quiet
    Remove-Item $envYamlPath -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { Write-Error "Backend deploy failed."; exit 1 }
} else {
    Write-Host ""
    Write-Host "[skip] Backend build skipped (-FrontendOnly mode)" -ForegroundColor DarkYellow
    # Still update env vars on the running backend service so vault key is not stale
    Write-Host "[5b] Updating backend env vars on existing Cloud Run service..." -ForegroundColor Yellow
    $envYamlPath = [System.IO.Path]::GetTempFileName() + ".yaml"
    @"
GEMINI_API_KEY: "$GEMINI"
BACKEND_VAULT_MASTER_KEY: "$VAULT_KEY"
FIREBASE_CREDENTIALS_B64: "$FB_CREDS_B64"
RESEND_API_KEY: "$RESEND"
EMAIL_FROM: "$EMAIL_FROM"
PLATFORM_URL: "$PLATFORM_URL"
"@ | Out-File -FilePath $envYamlPath -Encoding utf8 -NoNewline
    & gcloud run services update $BACKEND_SVC `
        --region $REGION `
        --timeout 300 `
        --memory 2Gi `
        --env-vars-file $envYamlPath `
        --quiet
    Remove-Item $envYamlPath -ErrorAction SilentlyContinue
}

$BACKEND_URL = & gcloud run services describe $BACKEND_SVC --region $REGION --format "value(status.url)"
Write-Host "Backend URL: $BACKEND_URL" -ForegroundColor Green

# --- 7. Build frontend ---
Write-Host ""
Write-Host "[6/7] Building frontend via Cloud Build (~5 min)..." -ForegroundColor Yellow
$FrontendDir = Join-Path $PSScriptRoot "web"

$FB_KEY    = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_API_KEY',            'Process')
$FB_AUTH   = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',        'Process')
$FB_PROJ   = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_PROJECT_ID',         'Process')
$FB_BUCKET = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',     'Process')
$FB_SENDER = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','Process')
$FB_APP    = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_APP_ID',             'Process')
$FB_MS     = [System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',     'Process')

$SUBS = "_IMAGE=$FRONTEND_IMG,_API=$($BACKEND_URL)/api,_FB_KEY=$FB_KEY,_FB_AUTH=$FB_AUTH,_FB_PROJ=$FB_PROJ,_FB_BUCKET=$FB_BUCKET,_FB_SENDER=$FB_SENDER,_FB_APP=$FB_APP,_FB_MEASURE=$FB_MS"

& gcloud builds submit $FrontendDir `
    --config "$FrontendDir\cloudbuild.yaml" `
    --substitutions $SUBS
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed."; exit 1 }

# --- 8. Deploy frontend ---
Write-Host ""
Write-Host "[7/7] Deploying frontend to Cloud Run..." -ForegroundColor Yellow
& gcloud run deploy $FRONTEND_SVC `
    --image $FRONTEND_IMG `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --max-instances 3 `
    --quiet
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend deploy failed."; exit 1 }

$FRONTEND_URL = & gcloud run services describe $FRONTEND_SVC --region $REGION --format "value(status.url)"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Frontend : $FRONTEND_URL"
Write-Host " Backend  : $BACKEND_URL"
Write-Host ""
Write-Host "Next step: add $FRONTEND_URL to Firebase Console > Authentication > Authorized domains"
