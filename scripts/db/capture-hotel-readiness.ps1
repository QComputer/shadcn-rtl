param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$databaseUrl = $env:HOTEL_PREFLIGHT_DATABASE_URL
if (-not $databaseUrl) { throw "Set HOTEL_PREFLIGHT_DATABASE_URL to the reviewed target connection string." }
if (-not (Get-Command psql -ErrorAction SilentlyContinue) -or -not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "PostgreSQL client tools psql and pg_dump are required."
}

$outputFullPath = [IO.Path]::GetFullPath($OutputDirectory)
if ($outputFullPath.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Readiness evidence must be stored outside the repository."
}
if (Test-Path -LiteralPath $outputFullPath) {
  if ((Get-ChildItem -LiteralPath $outputFullPath -Force | Measure-Object).Count -ne 0) { throw "Output directory must be empty." }
} else {
  New-Item -ItemType Directory -Path $outputFullPath | Out-Null
}

$uri = [Uri]$databaseUrl
if ($uri.Scheme -notin @("postgres", "postgresql")) { throw "Only PostgreSQL connection URLs are accepted." }
$userInfo = $uri.UserInfo.Split(":", 2)
$env:PGHOST = $uri.Host
$env:PGPORT = if ($uri.Port -gt 0) { [string]$uri.Port } else { "5432" }
$env:PGUSER = [Uri]::UnescapeDataString($userInfo[0])
$env:PGPASSWORD = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
$env:PGDATABASE = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
if (-not $env:PGDATABASE) { throw "Database name is missing from the connection URL." }
$env:PGSSLMODE = if ($uri.Query -match "(?:\?|&)sslmode=([^&]+)") { [Uri]::UnescapeDataString($Matches[1]) } else { "require" }

try {
  $identity = & psql -X -v ON_ERROR_STOP=1 -Atc "BEGIN READ ONLY; SELECT json_build_object('database', current_database(), 'serverVersion', current_setting('server_version'), 'readOnly', current_setting('default_transaction_read_only'))::text; COMMIT;"
  if ($LASTEXITCODE -ne 0) { throw "Read-only target identity query failed." }
  $identityRecord = $identity | ConvertFrom-Json
  if ($identityRecord.readOnly -ne "on") { throw "Target session did not report default_transaction_read_only=on." }

  $ledgerQuery = "BEGIN READ ONLY; SELECT migration_name || E'\t' || checksum || E'\t' || COALESCE(finished_at::text,'') || E'\t' || COALESCE(rolled_back_at::text,'') FROM _prisma_migrations ORDER BY migration_name, started_at; COMMIT;"
  $ledger = & psql -X -v ON_ERROR_STOP=1 -Atc $ledgerQuery
  if ($LASTEXITCODE -ne 0) { throw "Could not read Prisma migration ledger." }
  $ledgerPath = Join-Path $outputFullPath "prisma-migrations.tsv"
  [IO.File]::WriteAllLines($ledgerPath, [string[]]$ledger, [Text.UTF8Encoding]::new($false))

  $schemaPath = Join-Path $outputFullPath "schema-only.sql"
  & pg_dump --schema-only --no-owner --no-privileges --file $schemaPath
  if ($LASTEXITCODE -ne 0) { throw "Schema-only dump failed." }

  $sourceMigrations = Get-ChildItem (Join-Path $repositoryRoot "prisma/migrations") -Directory | ForEach-Object {
    $sqlPath = Join-Path $_.FullName "migration.sql"
    if (Test-Path -LiteralPath $sqlPath) {
      [pscustomobject]@{ name = $_.Name; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $sqlPath).Hash.ToLowerInvariant() }
    }
  }
  $ledgerRows = foreach ($line in $ledger) {
    $parts = $line -split "`t", 4
    if ($parts.Count -eq 4) { [pscustomobject]@{ name = $parts[0]; checksum = $parts[1]; finishedAt = $parts[2]; rolledBackAt = $parts[3] } }
  }
  $completed = @($ledgerRows | Where-Object { $_.finishedAt -and -not $_.rolledBackAt })
  $sourceNames = @{}; foreach ($m in $sourceMigrations) { $sourceNames[$m.name] = $m }
  $ledgerNames = @{}; foreach ($m in $ledgerRows) { $ledgerNames[$m.name] = $true }
  $report = [ordered]@{
    capturedAtUtc = [DateTime]::UtcNow.ToString("o")
    target = $identityRecord
    schemaOnlySha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $schemaPath).Hash.ToLowerInvariant()
    sourceMigrationCount = $sourceMigrations.Count
    ledgerRowCount = $ledgerRows.Count
    completedMigrationCount = $completed.Count
    sourceNotInLedger = @($sourceMigrations | Where-Object { -not $ledgerNames.ContainsKey($_.name) } | ForEach-Object { $_.name })
    ledgerNotInSource = @($ledgerRows | Where-Object { -not $sourceNames.ContainsKey($_.name) } | ForEach-Object { $_.name } | Sort-Object -Unique)
    checksumMismatches = @($completed | Where-Object { $sourceNames.ContainsKey($_.name) -and $sourceNames[$_.name].sha256 -ne $_.checksum } | ForEach-Object { $_.name })
    evidenceFiles = @("schema-only.sql", "prisma-migrations.tsv")
  }
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputFullPath "readiness.json") -Encoding utf8
  Write-Output "Read-only schema and migration evidence captured. Review readiness.json; no database writes were issued."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGHOST -ErrorAction SilentlyContinue
  Remove-Item Env:PGPORT -ErrorAction SilentlyContinue
  Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
  Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}
