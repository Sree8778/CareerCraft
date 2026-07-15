# CareerCraft Test Runner
# Usage:
#   .\tests\run_tests.ps1              — run all tests, headless, HTML report
#   .\tests\run_tests.ps1 -Suite api   — only API health checks
#   .\tests\run_tests.ps1 -Suite ui    — only UI tests
#   .\tests\run_tests.ps1 -Suite ai    — only browser-use AI exploratory tests
#   .\tests\run_tests.ps1 -Headed      — watch tests run in browser window

param(
    [string]$Suite = "all",
    [switch]$Headed
)

$ErrorActionPreference = "Continue"

# ── Environment ────────────────────────────────────────────────────────────────
# Edit these or set them as environment variables before running.
$env:CAREERCRAFT_FRONTEND = "https://careercraft-frontend-u7h4zjepfq-uc.a.run.app"
$env:CAREERCRAFT_BACKEND  = "https://careercraft-backend-u7h4zjepfq-uc.a.run.app"

# Fill in your test account credentials:
# $env:CANDIDATE_EMAIL    = "testcandidate@yourapp.com"
# $env:CANDIDATE_PASSWORD = "Test@1234"
# $env:RECRUITER_EMAIL    = "testrecruiter@yourapp.com"
# $env:RECRUITER_PASSWORD = "Test@1234"
# $env:GEMINI_API_KEY     = "your-gemini-key"         # enables AI feature tests
# $env:FIREBASE_API_KEY   = "your-firebase-web-key"   # enables auth'd API tests

if ($Headed) { $env:HEADLESS = "false"; $env:SLOW_MO = "300" }
else          { $env:HEADLESS = "true";  $env:SLOW_MO = "0"   }

# ── Install deps if needed ─────────────────────────────────────────────────────
Write-Host "`n=== CareerCraft Test Suite ===" -ForegroundColor Cyan

$pythonOk = python -c "import playwright" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup] Installing test dependencies..." -ForegroundColor Yellow
    pip install -r tests/requirements.txt -q
    python -m playwright install chromium
}

# ── Report directory ───────────────────────────────────────────────────────────
$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$reportDir  = "tests/reports/$timestamp"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportFile = "$reportDir/report.html"

# ── Select test files ──────────────────────────────────────────────────────────
$testFiles = switch ($Suite) {
    "api" { "tests/test_api_health.py" }
    "ui"  { "tests/test_ui_public.py tests/test_ui_candidate.py tests/test_ui_recruiter.py" }
    "ai"  { "tests/test_ai_explorer.py" }
    default { "tests/" }
}

# ── Run ───────────────────────────────────────────────────────────────────────
Write-Host "[run] Suite=$Suite  Headless=$($env:HEADLESS)  Report=$reportFile`n" -ForegroundColor Green

$cmd = "pytest $testFiles -v --tb=short --html=$reportFile --self-contained-html -p no:warnings"
Invoke-Expression $cmd
$exitCode = $LASTEXITCODE

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "HTML report: $reportFile" -ForegroundColor Yellow
if (Test-Path $reportFile) {
    Start-Process $reportFile
}

exit $exitCode
