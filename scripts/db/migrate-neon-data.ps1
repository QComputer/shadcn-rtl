<#
.SYNOPSIS
  Safely migrates data from an old Neon/PostgreSQL database into this project's current direct Neon database URL.

.DESCRIPTION
  This script is intentionally destructive only when -ConfirmReplaceCurrentDb is passed.
  It does not store source credentials in project files. Provide the source DB URL through
  -SourceDatabaseUrl or the OLD_DATABASE_URL environment variable.

  Default flow with -ConfirmReplaceCurrentDb:
    1. Resolve destination DB from .env: DIRECT_URL, otherwise DATABASE_URL_UNPOOLED, otherwise DATABASE_URL.
    2. Backup the current destination DB into ./db-backups.
    3. Dump source DB data only, excluding _prisma_migrations table data.
    4. Drop and recreate destination public schema.
    5. Run current Prisma migrations against destination.
    6. Restore source data into the migrated destination schema.

.REQUIREMENTS
  - PostgreSQL client tools: pg_dump, pg_restore, psql
  - pnpm installed
  - Project dependencies installed, or pnpm able to run prisma from this repo
#>

[CmdletBinding()]
param(
  [string]$SourceDatabaseUrl = $env:OLD_DATABASE_URL,
  [string]$DestinationDatabaseUrl,
  [string]$EnvFile = ".env",
  [string]$BackupDir = "db-backups",
  [switch]$ConfirmReplaceCurrentDb,
  [switch]$DryRun,
  [switch]$SkipPrismaMigrate,
  [string]$ExistingSourceDataDump
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

function Fail {
  param([string]$Message)
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Required command '$Name' was not found in PATH. Install PostgreSQL client tools/pnpm and reopen PowerShell."
  }
}

function Read-DotEnvValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
      continue
    }

    $escapedName = [regex]::Escape($Name)
    if ($trimmed -match "^$escapedName\s*=\s*(.*)$") {
      $value = $Matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function Redact-DatabaseUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) {
    return "<empty>"
  }

  try {
    $uri = [System.Uri]$Url
    $hostPart = $uri.Host
    if ($uri.Port -gt 0) {
      $hostPart = "$hostPart`:$($uri.Port)"
    }
    return "$($uri.Scheme)://***:***@$hostPart$($uri.AbsolutePath)$($uri.Query)"
  } catch {
    return "<redacted database url>"
  }
}

function Invoke-CheckedCommand {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  $displayArgs = $Arguments | ForEach-Object {
    if ($_ -match '^postgres(ql)?://') { Redact-DatabaseUrl $_ } else { $_ }
  }
  Write-Host "+ $Command $($displayArgs -join ' ')" -ForegroundColor DarkGray

  if ($DryRun) {
    return
  }

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed with exit code $LASTEXITCODE: $Command"
  }
}

function Invoke-CheckedScriptCommand {
  param(
    [string]$CommandLine
  )

  Write-Host "+ $CommandLine" -ForegroundColor DarkGray
  if ($DryRun) {
    return
  }

  cmd.exe /c $CommandLine
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed with exit code $LASTEXITCODE: $CommandLine"
  }
}

function Require-ValidDatabaseUrl {
  param(
    [string]$Url,
    [string]$Name
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    Fail "$Name is empty. Provide it as a parameter or environment variable."
  }

  if ($Url -notmatch '^postgres(ql)?://') {
    Fail "$Name does not look like a PostgreSQL connection URL."
  }
}

Write-Step "Checking repository root"
if (-not (Test-Path "package.json") -or -not (Test-Path "prisma/schema.prisma")) {
  Fail "Run this script from the project root."
}

Write-Step "Checking required commands"
Assert-Command "pg_dump"
Assert-Command "pg_restore"
Assert-Command "psql"
Assert-Command "pnpm"

if ([string]::IsNullOrWhiteSpace($DestinationDatabaseUrl)) {
  $destinationFromDirect = Read-DotEnvValue -Path $EnvFile -Name "DIRECT_URL"
  $destinationFromUnpooled = Read-DotEnvValue -Path $EnvFile -Name "DATABASE_URL_UNPOOLED"
  $destinationFromPooled = Read-DotEnvValue -Path $EnvFile -Name "DATABASE_URL"
  if (-not [string]::IsNullOrWhiteSpace($destinationFromDirect)) {
    $DestinationDatabaseUrl = $destinationFromDirect
  } elseif (-not [string]::IsNullOrWhiteSpace($destinationFromUnpooled)) {
    $DestinationDatabaseUrl = $destinationFromUnpooled
  } else {
    $DestinationDatabaseUrl = $destinationFromPooled
  }
}

Require-ValidDatabaseUrl -Url $SourceDatabaseUrl -Name "SourceDatabaseUrl / OLD_DATABASE_URL"
Require-ValidDatabaseUrl -Url $DestinationDatabaseUrl -Name "DestinationDatabaseUrl / current .env DIRECT_URL"

if ($SourceDatabaseUrl -eq $DestinationDatabaseUrl) {
  Fail "Source and destination database URLs are identical. Refusing to continue."
}

Write-Step "Resolved migration endpoints"
Write-Host "Source:      $(Redact-DatabaseUrl $SourceDatabaseUrl)"
Write-Host "Destination: $(Redact-DatabaseUrl $DestinationDatabaseUrl)"
Write-Host "Backup dir:  $BackupDir"

if ($DryRun) {
  Write-Warn "DryRun is enabled. Commands will be printed but not executed."
}

if (-not $ConfirmReplaceCurrentDb -and -not $DryRun) {
  Fail "This migration replaces the current destination DB data. Re-run with -ConfirmReplaceCurrentDb after reviewing the dry-run output."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$currentBackupFile = Join-Path $BackupDir "current-before-neon-data-migration-$timestamp.dump"
$sourceDataDumpFile = if (-not [string]::IsNullOrWhiteSpace($ExistingSourceDataDump)) {
  $ExistingSourceDataDump
} else {
  Join-Path $BackupDir "source-old-neon-data-only-$timestamp.dump"
}

Write-Step "Preparing backup directory"
if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

Write-Step "Backing up current destination DB before replacement"
Invoke-CheckedCommand -Command "pg_dump" -Arguments @(
  $DestinationDatabaseUrl,
  "--format=custom",
  "--no-owner",
  "--no-acl",
  "--file", $currentBackupFile
)

if ([string]::IsNullOrWhiteSpace($ExistingSourceDataDump)) {
  Write-Step "Dumping old source DB data only"
  Invoke-CheckedCommand -Command "pg_dump" -Arguments @(
    $SourceDatabaseUrl,
    "--format=custom",
    "--data-only",
    "--no-owner",
    "--no-acl",
    "--exclude-table-data=_prisma_migrations",
    "--file", $sourceDataDumpFile
  )
} else {
  Write-Step "Using existing source data dump"
  if (-not $DryRun -and -not (Test-Path $ExistingSourceDataDump)) {
    Fail "Existing source data dump was not found: $ExistingSourceDataDump"
  }
}

Write-Step "Resetting destination public schema"
Invoke-CheckedCommand -Command "psql" -Arguments @(
  $DestinationDatabaseUrl,
  "-v", "ON_ERROR_STOP=1",
  "-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
)

if (-not $SkipPrismaMigrate) {
  Write-Step "Applying current Prisma migrations to destination"
  if (-not $DryRun) {
    $env:DATABASE_URL = $DestinationDatabaseUrl
  }
  Invoke-CheckedScriptCommand -CommandLine "pnpm run db:migrate"
} else {
  Write-Warn "SkipPrismaMigrate is enabled. Destination schema must already match the current Prisma schema."
}

Write-Step "Restoring old data into current migrated schema"
Invoke-CheckedCommand -Command "pg_restore" -Arguments @(
  "--dbname", $DestinationDatabaseUrl,
  "--data-only",
  "--no-owner",
  "--no-acl",
  "--single-transaction",
  $sourceDataDumpFile
)

Write-Step "Running post-migration database drift validation"
if (-not $DryRun) {
  $env:DATABASE_URL = $DestinationDatabaseUrl
}
Invoke-CheckedScriptCommand -CommandLine "pnpm run db:drift"

Write-Warn "Source data dump kept for safety: $sourceDataDumpFile"

Write-Step "Migration completed"
Write-Host "Current DB backup: $currentBackupFile"
Write-Host "Source data dump:   $sourceDataDumpFile"
Write-Host "Next recommended checks: pnpm run typecheck; pnpm run build; pnpm run quality:local"
