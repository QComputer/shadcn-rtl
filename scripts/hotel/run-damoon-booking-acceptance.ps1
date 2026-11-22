param(
  [string]$Grep
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$minimumFreeBytes = 8GB
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 16)
$databaseName = "damoon_$suffix"
$databaseUser = "damoon_test_$suffix"
$containerName = "damoon-local-e2e-$suffix"
$taskLabel = 'com.bazarbaaz.task'
$taskLabelValue = 'damoon-local-acceptance'
$runLabel = 'com.bazarbaaz.run'
$tempRoot = Join-Path $env:TEMP "damoon-local-e2e-$suffix"
$envFile = Join-Path $tempRoot 'fixture.env'
$nextProcess = $null
$staticProcess = $null
$nextListenerPid = $null
$staticListenerPid = $null
$containerId = $null
$testFailed = $true
$port = $null
$script:taskExitCode = 0
. (Join-Path $PSScriptRoot 'damoon-local-cleanup.ps1')

function Assert-DiskSpace {
  $drive = Get-PSDrive -Name C
  if ($drive.Free -lt $minimumFreeBytes) {
    throw "C: free space fell below the required 8 GiB floor. Current free space: $([math]::Round($drive.Free / 1GB, 2)) GiB."
  }
}

function Test-LoopbackPortAvailable([int]$Candidate) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Candidate)
  try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Get-AvailablePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try { $listener.Start(); return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() }
}

function Invoke-Pnpm([string[]]$Arguments) {
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) {
    $script:taskExitCode = $LASTEXITCODE
    throw "pnpm command failed (exit $LASTEXITCODE): pnpm $($Arguments -join ' ')"
  }
}

function Wait-Http([string]$Uri, [hashtable]$Headers, [System.Diagnostics.Process]$Process, [string]$ServiceName) {
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    if ($Process.HasExited) { throw "$ServiceName exited during startup; see its task-scoped log under $tempRoot." }
    try {
      $response = Invoke-WebRequest -Uri $Uri -Headers $Headers -TimeoutSec 3 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return }
    } catch { }
    Start-Sleep -Seconds 1
  }
  throw "$ServiceName did not become ready within 90 seconds; see its task-scoped log under $tempRoot."
}

function Test-TaskServerCommand([string]$CommandLine, [string]$ExpectedText) {
  $repoPrefix = $repoRoot.TrimEnd('\') + '\'
  $belongsToWorktree = $CommandLine.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or $CommandLine.Contains(" $repoPrefix")
  $matchesExpected = $CommandLine.IndexOf($ExpectedText, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  if ($ExpectedText -eq 'next dev' -and $CommandLine.IndexOf('\next\dist\server\lib\start-server.js', [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $matchesExpected = $true }
  return $belongsToWorktree -and $matchesExpected
}

function Get-TaskListenerPid([int]$ListenerPort, [string]$ExpectedText) {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $ListenerPort -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($current -and $current.Name -eq 'node.exe' -and (Test-TaskServerCommand $current.CommandLine $ExpectedText)) { return $current.ProcessId }
  }
  throw "Could not verify the task-owned process listening on port $ListenerPort."
}

function Stop-TaskProcess([int]$ProcessId, [string]$ExpectedText) {
  if (-not $ProcessId) { return }
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if ($current -and $current.Name -eq 'node.exe' -and (Test-TaskServerCommand $current.CommandLine $ExpectedText)) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-TaskContainer([string]$Id) {
  if (-not $Id) { return }
  $inspectJson = & docker inspect $Id 2>$null
  if ($LASTEXITCODE -ne 0) { return }
  $container = ($inspectJson -join "`n") | ConvertFrom-Json | Select-Object -First 1
  $owner = $container.Config.Labels.PSObject.Properties[$taskLabel].Value
  $run = $container.Config.Labels.PSObject.Properties[$runLabel].Value
  $binding = $container.NetworkSettings.Ports.PSObject.Properties['5432/tcp'].Value
  if ($owner -eq $taskLabelValue -and $run -eq $suffix -and $container.Name -eq "/$containerName" -and $container.Config.Image -eq 'postgres:17' -and -not $container.HostConfig.Binds -and -not $container.Mounts -and $binding[0].HostIp -eq '127.0.0.1' -and $binding[0].HostPort -eq [string]$port) {
    $previousErrorAction = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & docker stop $Id 2>$null | Out-Null
    } finally { $ErrorActionPreference = $previousErrorAction }
  }
}

function Assert-PortFree([int]$Candidate, [string]$Purpose) {
  if (-not (Test-LoopbackPortAvailable $Candidate)) {
    throw "Loopback port $Candidate is already in use; refusing to stop or reconfigure it ($Purpose)."
  }
}

try {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  Set-Location $repoRoot
  Assert-DiskSpace

  if ($env:NODE_ENV -eq 'production' -or $env:VERCEL_ENV -eq 'production') { throw 'Production environment markers are forbidden.' }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI is required; the runner will not install or restart Docker Desktop.' }
  $dockerInfo = & docker info --format '{{.ServerVersion}}'
  if ($LASTEXITCODE -ne 0 -or -not $dockerInfo) { throw 'Docker engine is unavailable; no engine restart was attempted.' }

  if (Test-LoopbackPortAvailable 55439) { $port = 55439 } else { $port = Get-AvailablePort }
  if ($port -eq 5432) { $port = Get-AvailablePort }
  Assert-PortFree $port 'disposable PostgreSQL'
  Assert-PortFree 3000 'Next.js test server'
  Assert-PortFree 8080 'standalone Damoon server'

  if (-not (Test-Path -LiteralPath $tempRoot)) { New-Item -ItemType Directory -Path $tempRoot | Out-Null }
  $tempResolved = (Resolve-Path -LiteralPath $tempRoot).Path
  $tempBase = (Resolve-Path -LiteralPath $env:TEMP).Path
  if (-not $tempResolved.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or (Get-Item -LiteralPath $tempResolved).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
    throw 'Task temp directory failed its OS-temp containment check.'
  }

  $image = & docker image inspect postgres:17 --format '{{.Id}}' 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $image) {
    Assert-DiskSpace
    & docker pull postgres:17
    if ($LASTEXITCODE -ne 0) { throw 'Could not retrieve the PostgreSQL 17 image.' }
    Assert-DiskSpace
  }

  $randomBytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
  $databasePassword = ([BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
  [Array]::Clear($randomBytes, 0, $randomBytes.Length)

  $env:POSTGRES_USER = $databaseUser
  $env:POSTGRES_PASSWORD = $databasePassword
  $env:POSTGRES_DB = $databaseName
  $hostBinding = "127.0.0.1:$port`:5432"
  $containerOutput = & docker run --detach --rm --name $containerName --label "$taskLabel=$taskLabelValue" --label "$runLabel=$suffix" --publish $hostBinding --tmpfs '/var/lib/postgresql/data:rw,nosuid,size=2048m' --env POSTGRES_USER --env POSTGRES_PASSWORD --env POSTGRES_DB --env 'PGDATA=/var/lib/postgresql/data/pgdata' postgres:17
  if ($LASTEXITCODE -ne 0 -or -not $containerOutput) { throw 'Could not start the task-owned disposable PostgreSQL 17 container.' }
  $containerId = ($containerOutput | Select-Object -Last 1).Trim()
  Remove-Item Env:POSTGRES_USER,Env:POSTGRES_PASSWORD,Env:POSTGRES_DB -ErrorAction SilentlyContinue
  Assert-DiskSpace

  $inspectJson = & docker inspect $containerId
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the task-owned PostgreSQL container.' }
  $inspect = ($inspectJson -join "`n") | ConvertFrom-Json | Select-Object -First 1
  $owner = $inspect.Config.Labels.PSObject.Properties[$taskLabel].Value
  $run = $inspect.Config.Labels.PSObject.Properties[$runLabel].Value
  if ($inspect.Config.Image -ne 'postgres:17' -or $owner -ne $taskLabelValue -or $run -ne $suffix) {
    throw 'PostgreSQL container image or task-ownership labels did not match this run.'
  }
  $configuredTmpfs = $inspect.HostConfig.Tmpfs.PSObject.Properties['/var/lib/postgresql/data'].Value
  if (($inspect.Mounts -and $inspect.Mounts.Count -gt 0) -or $configuredTmpfs -notlike 'rw,nosuid,size=2048m*' -or $inspect.HostConfig.Binds) {
    throw 'PostgreSQL container must use only the task-owned tmpfs data mount; persistent or bind volumes are refused.'
  }
  $bindings = $inspect.NetworkSettings.Ports.PSObject.Properties['5432/tcp'].Value
  if ($bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne [string]$port) {
    throw 'PostgreSQL host publication must be exactly the selected IPv4 loopback port.'
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    & docker exec $containerId pg_isready -U $databaseUser -d $databaseName *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }

  $databaseUrl = "postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}?schema=public"
  Set-Item Env:DATABASE_RUNTIME_ADAPTER 'postgresql'
  Set-Item Env:DATABASE_URL $databaseUrl
  Set-Item Env:DIRECT_URL $databaseUrl
  Set-Item Env:LOCAL_PRISMA_EXPECTED_PORT ([string]$port)
  Set-Item Env:DAMOON_CI_DATABASE_NAME $databaseName
  Set-Item Env:DAMOON_E2E_DATABASE_USER $databaseUser
  Set-Item Env:DAMOON_LOCAL_E2E '1'
  Set-Item Env:DAMOON_E2E_ENABLED '1'
  Set-Item Env:NODE_ENV 'test'
  Set-Item Env:VERCEL_ENV 'development'
  Remove-Item Env:GITHUB_ENV -ErrorAction SilentlyContinue
  Set-Item Env:DAMOON_LOCAL_E2E_ENV_FILE $envFile
  Set-Item Env:HOTEL_GUEST_BOOKING_REQUEST_ENABLED '1'
  Set-Item Env:HOTEL_PUBLICATION_OPERATIONAL_ENABLED '1'
  Set-Item Env:HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED '0'
  Set-Item Env:HOTEL_CRON_SCHEDULER_ENABLED '0'
  Set-Item Env:HOTEL_PAYMENT_OPERATIONAL_ENABLED '0'
  Set-Item Env:HOTEL_PAYMENT_SIMULATOR_ENABLED '0'
  Set-Item Env:HOTEL_SMS_ENABLED '0'
  Set-Item Env:CUSTOMER_AUTH_SMS_WORKER_ENABLED '0'
  Set-Item Env:AUTH_SECRET (([guid]::NewGuid().ToString('N')) + ([guid]::NewGuid().ToString('N')))
  Set-Item Env:NEXTAUTH_SECRET $env:AUTH_SECRET
  Set-Item Env:AUTH_TRUST_HOST 'true'
  Set-Item Env:NEXTAUTH_URL 'http://127.0.0.1:3000'
  Set-Item Env:NEXTAUTH_URL_INTERNAL 'http://127.0.0.1:3000'
  Set-Item Env:NEXT_PUBLIC_APP_URL 'http://127.0.0.1:3000'
  Set-Item Env:DAMOON_APP_URL 'http://127.0.0.1:3000'
  Set-Item Env:DAMOON_API_ORIGIN 'http://127.0.0.1:3000'
  Set-Item Env:DAMOON_SHARED_RUNTIME_URL 'http://damoon-hotel.localhost:3000'
  Set-Item Env:NEXT_TELEMETRY_DISABLED '1'
  Set-Item Env:MEDIA_STORAGE_ROOT (Join-Path $tempRoot 'receipts')
  Set-Item Env:DAMOON_E2E_OUTPUT_DIR (Join-Path $tempRoot 'playwright-results')
  New-Item -ItemType Directory -Path $env:MEDIA_STORAGE_ROOT | Out-Null

  Invoke-Pnpm @('exec', 'node', 'scripts/hotel/verify-damoon-local-e2e-db.mjs')
  Invoke-Pnpm @('exec', 'prisma', 'validate')
  Invoke-Pnpm @('exec', 'prisma', 'generate')
  Invoke-Pnpm @('exec', 'node', 'scripts/hotel/verify-damoon-local-e2e-db.mjs')
  Invoke-Pnpm @('exec', 'prisma', 'migrate', 'deploy')
  Invoke-Pnpm @('exec', 'node', 'scripts/hotel/verify-damoon-local-e2e-db.mjs')
  Invoke-Pnpm @('exec', 'tsx', '--require=./scripts/e2e/register-server-only.cjs', 'scripts/hotel/seed-damoon-booking-e2e.mts')

  $allowedFixtureKeys = @('DAMOON_ORGANIZATION_ID','DAMOON_PROPERTY_ID','DAMOON_PROPERTY_SLUG','DAMOON_MANAGER_USERNAME','DAMOON_MANAGER_PASSWORD','DAMOON_ROOM_TYPE_SLUG','DAMOON_RATE_PLAN_CODE','DAMOON_FOREIGN_ORGANIZATION_ID','DAMOON_FOREIGN_PROPERTY_ID','DAMOON_FOREIGN_HOST','DAMOON_FOREIGN_MANAGER_USERNAME','DAMOON_FOREIGN_MANAGER_PASSWORD','DAMOON_PUBLIC_HOST','DAMOON_PUBLIC_HOSTS','DAMOON_STANDALONE_URL','DAMOON_E2E_PUBLIC_PORT')
  $fixtureLines = Get-Content -LiteralPath $envFile
  foreach ($line in $fixtureLines) {
    $separator = $line.IndexOf('=')
    if ($separator -le 0) { throw 'Fixture environment output had an invalid line.' }
    $key = $line.Substring(0, $separator)
    $value = $line.Substring($separator + 1)
    if ($key -notin $allowedFixtureKeys -or $value.Contains("`n") -or $value.Contains("`r")) { throw 'Fixture environment output contained an unexpected key or value.' }
    Set-Item -Path "Env:$key" -Value $value
  }
  Remove-Item Env:DAMOON_LOCAL_E2E_ENV_FILE -ErrorAction SilentlyContinue
  Invoke-Pnpm @('exec', 'node', 'scripts/hotel/verify-damoon-local-e2e-db.mjs')

  Set-Item Env:NODE_ENV 'development'
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $nextEntry = (Resolve-Path 'node_modules/next/dist/bin/next').Path
  $nextOut = Join-Path $tempRoot 'next.stdout.log'
  $nextErr = Join-Path $tempRoot 'next.stderr.log'
  $nextProcess = Start-Process -FilePath $nodePath -ArgumentList @($nextEntry, 'dev', '--hostname', '127.0.0.1', '--port', '3000') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $nextOut -RedirectStandardError $nextErr
  Wait-Http 'http://127.0.0.1:3000/api/auth/csrf' @{} $nextProcess 'Next.js API runtime'
  $nextListenerPid = Get-TaskListenerPid 3000 'next dev'

  Set-Item Env:NODE_ENV 'test'
  Set-Item Env:PORT '8080'
  $staticOut = Join-Path $tempRoot 'damoon.stdout.log'
  $staticErr = Join-Path $tempRoot 'damoon.stderr.log'
  $staticEntry = (Resolve-Path 'sites/damoon/server.mjs').Path
  $staticProcess = Start-Process -FilePath $nodePath -ArgumentList @($staticEntry) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $staticOut -RedirectStandardError $staticErr
  Wait-Http 'http://127.0.0.1:8080/healthz' @{ Host = $env:DAMOON_PUBLIC_HOST } $staticProcess 'Standalone Damoon server'
  $staticListenerPid = Get-TaskListenerPid 8080 'sites\damoon\server.mjs'

  Assert-DiskSpace
  if ($Grep) { Invoke-Pnpm @('exec', 'playwright', 'test', '--config=playwright.damoon.config.mjs', '--grep', $Grep) }
  else { Invoke-Pnpm @('exec', 'playwright', 'test', '--config=playwright.damoon.config.mjs') }
  $testFailed = $false
  Write-Output "Damoon request-to-reception acceptance passed on disposable PostgreSQL 17 at loopback port $port (database $databaseName)."
}
catch {
  if ($script:taskExitCode -eq 0) { $script:taskExitCode = 1 }
  [Console]::Error.WriteLine('Damoon acceptance failed; see the preceding test result.')
}
finally {
  try {
    if (-not $staticListenerPid -and $staticProcess) { $staticListenerPid = Get-TaskListenerPid 8080 'sites\damoon\server.mjs' }
    Stop-TaskProcess $staticListenerPid 'sites\damoon\server.mjs'
  } catch { [Console]::Error.WriteLine("Warning: could not fully stop the task-owned Damoon process: $($_.Exception.Message)") }
  try {
    if (-not $nextListenerPid -and $nextProcess) { $nextListenerPid = Get-TaskListenerPid 3000 'next dev' }
    Stop-TaskProcess $nextListenerPid 'next dev'
  } catch { [Console]::Error.WriteLine("Warning: could not fully stop the task-owned Next.js process: $($_.Exception.Message)") }
  try { Stop-TaskContainer $containerId } catch { [Console]::Error.WriteLine("Warning: could not stop the task-owned PostgreSQL container: $($_.Exception.Message)") }
  Remove-Item Env:POSTGRES_USER,Env:POSTGRES_PASSWORD,Env:POSTGRES_DB,Env:DAMOON_LOCAL_E2E_ENV_FILE -ErrorAction SilentlyContinue
  $script:taskExitCode = Invoke-DamoonTempCleanup -TempRoot $tempRoot -TempBase $env:TEMP -Suffix $suffix -ExitCode $script:taskExitCode
  if ($testFailed) { Write-Output 'Task-owned cleanup was attempted.' }
}

exit $script:taskExitCode
