param(
  [string]$EnvFile = "$PSScriptRoot\..\.env.local",
  [switch]$SkipBuild,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Import-LocalEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing local env file: $Path. Copy .env.local.example to .env.local and fill your local values."
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -le 0) {
      continue
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$projectRoot = Resolve-Path -LiteralPath "$PSScriptRoot\.."
Import-LocalEnv -Path $EnvFile

if ($ValidateOnly) {
  if (-not (Test-Path -LiteralPath "$projectRoot\dist\main.js")) {
    throw "Missing built server: $projectRoot\dist\main.js. Run cmd /c npm run build first."
  }
  exit 0
}

if (-not $SkipBuild) {
  Push-Location -LiteralPath $projectRoot
  try {
    cmd /c npm run build 1>$null
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

& "C:\Program Files\nodejs\node.exe" "$projectRoot\dist\main.js"
