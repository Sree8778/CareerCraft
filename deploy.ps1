# ── CareerCraft — Google Cloud Run deployment script (Windows PowerShell) ─────
# Usage:  .\deploy.ps1
# Prereq: gcloud CLI installed and authenticated  (gcloud auth login)
# ----------------------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 1. Load .env.cloud ────────────────────────────────────────────────────────
$EnvFile = Join-Path $PSScriptRoot ".env.cloud"
if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing .env.cloud — copy .env.cloud.example, fill in values, and retry."
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim())
}

$PROJECT  = $env:GCP_PROJECT_ID
$REGION   = $env:GCP_REGION
$GEMINI   = $env:GEMINI_API_KEY

if (-not $PROJECT -or -not $REGION -or -not $GEMINI) {
    Write-Error "GCP_PROJECT_ID, GCP_REGION, and GEMINI_API_KEY must be set in .env.cloud"
    exit 1
}

$BACKEND_SVC  = "careercraft-backend"
$FRONTEND_SVC = "careercraft-frontend"
$REPO         = "us-docker.pkg.dev/$PROJECT/careercraft"
$BACKEND_IMG  = "$REPO/backend"
$FRONTEND_IMG = "$REPO/frontend"

Write-Host "`n=== CareerCraft Cloud Run Deployment ===" -ForegroundColor Cyan
Write-Host "Project : $PROJECT"
Write-Host "Region  : $REGION"

# ── 2. Set active project ─────────────────────────────────────────────────────
Write-Host "`n[1/7] Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $PROJECT

# ── 3. Enable required APIs ───────────────────────────────────────────────────
Write-Host "`n[2/7] Enabling APIs (this takes ~1 min first time)..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com

# ── 4. Create Artifact Registry repo (idempotent) ────────────────────────────
Write-Host "`n[3/7] Creating Artifact Registry repository..." -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories describe careercraft --location=$REGION 2>$null
if (-not $repoExists) {
    gcloud artifacts repositories create careercraft `
        --repository-format=docker `
        --location=$REGION `
        --description="CareerCraft Docker images"
}
gcloud auth configure-docker "us-docker.pkg.dev" --quiet

# ── 5. Build & deploy Flask backend ──────────────────────────────────────────
Write-Host "`n[4/7] Building backend image via Cloud Build..." -ForegroundColor Yellow
$BackendDir = Join-Path $PSScriptRoot "web\backend"
gcloud builds submit $BackendDir --tag $BACKEND_IMG

Write-Host "`n[5/7] Deploying backend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $BACKEND_SVC `
    --image      $BACKEND_IMG `
    --region     $REGION `
    --platform   managed `
    --allow-unauthenticated `
    --memory     512Mi `
    --cpu        1 `
    --max-instances 3 `
    --set-env-vars "GEMINI_API_KEY=$GEMINI"

# Capture backend URL
$BACKEND_URL = gcloud run services describe $BACKEND_SVC `
    --region $REGION --format "value(status.url)"

Write-Host "Backend live at: $BACKEND_URL" -ForegroundColor Green

# ── 6. Build & deploy Next.js frontend ───────────────────────────────────────
Write-Host "`n[6/7] Building frontend image via Cloud Build..." -ForegroundColor Yellow
$FrontendDir = Join-Path $PSScriptRoot "web"

$BuildArgs = @(
    "--tag", $FRONTEND_IMG,
    "--build-arg", "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL/api",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_API_KEY=$env:NEXT_PUBLIC_FIREBASE_API_KEY",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_APP_ID=$env:NEXT_PUBLIC_FIREBASE_APP_ID",
    "--build-arg", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$env:NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
)

gcloud builds submit $FrontendDir @BuildArgs

Write-Host "`n[7/7] Deploying frontend to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $FRONTEND_SVC `
    --image      $FRONTEND_IMG `
    --region     $REGION `
    --platform   managed `
    --allow-unauthenticated `
    --memory     512Mi `
    --cpu        1 `
    --max-instances 3

$FRONTEND_URL = gcloud run services describe $FRONTEND_SVC `
    --region $REGION --format "value(status.url)"

# ── 7. Summary ────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Frontend : $FRONTEND_URL"
Write-Host " Backend  : $BACKEND_URL"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add $FRONTEND_URL to Firebase Console → Authentication → Authorized domains"
Write-Host "  2. Update Firebase Firestore rules if needed"
Write-Host "  3. Visit $FRONTEND_URL to verify the app"
Write-Host ""
