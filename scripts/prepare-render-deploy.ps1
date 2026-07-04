[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Installing/updating project dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[2/4] Running TypeScript checks..." -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[3/4] Creating production builds..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[4/4] Checking Git changes..." -ForegroundColor Cyan
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw "Not inside a Git branch. Open PowerShell in the project root and retry."
}

Write-Host "Validation finished successfully on branch: $branch" -ForegroundColor Green
Write-Host "Next: review 'git status', then commit and push using the commands in RENDER_DEPLOY.md." -ForegroundColor Yellow
git status --short
