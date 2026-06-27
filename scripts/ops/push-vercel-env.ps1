param(
  [string]$EnvFile = ".env",
  [ValidateSet("production", "preview", "development")]
  [string[]]$Targets = @("production"),
  [string]$Branch = "",
  [switch]$Link,
  [switch]$DryRun,
  [switch]$Redeploy,
  [switch]$Plain
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Warning $Message
}

function Assert-CommandExists {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw ("Command '{0}' was not found. Install Vercel CLI first: npm install -g vercel; then run: vercel login" -f $Name)
  }
}

function Quote-CmdArg {
  param([string]$Value)

  if ($null -eq $Value) {
    return '""'
  }

  $escaped = $Value.Replace('"', '\"')
  return ('"{0}"' -f $escaped)
}

function Join-CmdArgs {
  param([string[]]$Arguments)

  $quoted = @()
  foreach ($argument in $Arguments) {
    $quoted += (Quote-CmdArg -Value $argument)
  }

  return ($quoted -join " ")
}

function Remove-Ansi {
  param([string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  return ($Text -replace "`e\[[0-9;?]*[ -/]*[@-~]", "")
}

function Invoke-VercelCommand {
  param(
    [string[]]$Arguments,
    [string]$StandardInputFile = ""
  )

  # Windows PowerShell 5.1 can surface native stderr as NativeCommandError when
  # $ErrorActionPreference is Stop. Vercel CLI prints its banner/status on stderr,
  # so we temporarily relax the preference and return a structured result instead.
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    if ($StandardInputFile) {
      $commandLine = "vercel " + (Join-CmdArgs -Arguments $Arguments) + " < " + (Quote-CmdArg -Value $StandardInputFile)
      $output = & cmd.exe /d /s /c $commandLine 2>&1
      $exitCode = $LASTEXITCODE
    }
    else {
      $output = & vercel @Arguments 2>&1
      $exitCode = $LASTEXITCODE
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $lines = @()
  foreach ($item in $output) {
    $lines += (Remove-Ansi -Text ([string]$item))
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = $lines
  }
}

function Normalize-EnvValue {
  param([string]$Value)

  $result = $Value

  if ($null -eq $result) {
    return ""
  }

  $result = $result.Trim()

  if ($result.Length -ge 2) {
    $first = $result.Substring(0, 1)
    $last = $result.Substring($result.Length - 1, 1)

    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $result = $result.Substring(1, $result.Length - 2)
    }
  }

  return $result
}

function Parse-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw ("Env file not found: {0}" -f $Path)
  }

  $items = New-Object 'System.Collections.Generic.Dictionary[string,string]'
  $lineNumber = 0

  Get-Content -LiteralPath $Path | ForEach-Object {
    $lineNumber += 1
    $raw = [string]$_
    $line = $raw.Trim()

    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }

    if ($line.StartsWith("export ")) {
      $line = $line.Substring(7).Trim()
    }

    $eqIndex = $line.IndexOf("=")
    if ($eqIndex -lt 1) {
      Write-Warn ("Skipping line {0}: missing KEY=VALUE format" -f $lineNumber)
      return
    }

    $key = $line.Substring(0, $eqIndex).Trim()
    $value = $line.Substring($eqIndex + 1)

    if (-not ($key -match '^[A-Za-z_][A-Za-z0-9_]*$')) {
      Write-Warn ("Skipping invalid env key on line {0}: {1}" -f $lineNumber, $key)
      return
    }

    $items[$key] = Normalize-EnvValue -Value $value
  }

  return $items
}

function Get-ExistingVercelEnvKeys {
  param(
    [string]$Target,
    [string]$BranchName
  )

  $commandArgs = @("env", "ls", $Target)

  if ($BranchName -and $Target -eq "preview") {
    $commandArgs += @("--git-branch", $BranchName)
  }

  $result = Invoke-VercelCommand -Arguments $commandArgs

  if ($result.ExitCode -ne 0) {
    $joined = ($result.Output -join "`n").Trim()
    throw ("Failed to list Vercel env vars for {0}. {1}" -f $Target, $joined)
  }

  $keys = New-Object 'System.Collections.Generic.HashSet[string]'

  foreach ($lineObject in $result.Output) {
    $line = ([string]$lineObject).Trim()
    if (-not $line) { continue }

    if ($line.StartsWith("Vercel CLI")) { continue }
    if ($line.StartsWith("Retrieving")) { continue }
    if ($line.StartsWith("Environment Variables")) { continue }
    if ($line.StartsWith("No Environment Variables")) { continue }
    if ($line.StartsWith("Error:")) { continue }
    if ($line -match '^[-─\s]+$') { continue }

    $parts = $line -split '\s+'
    if ($parts.Count -lt 1) { continue }

    $candidate = $parts[0].Trim()

    if ($candidate -match '^[A-Za-z_][A-Za-z0-9_]*$') {
      $lower = $candidate.ToLowerInvariant()
      if ($lower -ne "name" -and $lower -ne "key" -and $lower -ne "created" -and $lower -ne "value" -and $lower -ne "environments") {
        [void]$keys.Add($candidate)
      }
    }
  }

  return $keys
}

function Invoke-VercelEnvWrite {
  param(
    [string]$Action,
    [string]$Key,
    [string]$Value,
    [string]$Target,
    [string]$BranchName,
    [bool]$UseSensitive
  )

  $tempFile = [System.IO.Path]::GetTempFileName()
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

  try {
    [System.IO.File]::WriteAllText($tempFile, $Value, $utf8NoBom)

    if ($Action -eq "update") {
      $commandArgs = @("env", "update", $Key, $Target, "--yes")
    }
    elseif ($Action -eq "add") {
      $commandArgs = @("env", "add", $Key, $Target)
      if ($UseSensitive) {
        $commandArgs += "--sensitive"
      }
    }
    else {
      throw ("Unsupported env action: {0}" -f $Action)
    }

    if ($BranchName -and $Target -eq "preview") {
      $commandArgs += @("--git-branch", $BranchName)
    }

    $result = Invoke-VercelCommand -Arguments $commandArgs -StandardInputFile $tempFile

    if ($result.ExitCode -ne 0) {
      $joined = ($result.Output -join "`n").Trim()
      throw ("vercel env {0} failed for {1} in {2}. {3}" -f $Action, $Key, $Target, $joined)
    }
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

Assert-CommandExists "vercel"

if ($Link) {
  Write-Step "Linking project to Vercel..."
  $linkResult = Invoke-VercelCommand -Arguments @("link")
  if ($linkResult.ExitCode -ne 0) {
    throw ("vercel link failed. {0}" -f (($linkResult.Output -join "`n").Trim()))
  }
}

if (-not (Test-Path -LiteralPath ".vercel")) {
  Write-Warn "Project is not linked to Vercel yet. Running vercel link..."
  $autoLinkResult = Invoke-VercelCommand -Arguments @("link")
  if ($autoLinkResult.ExitCode -ne 0) {
    throw ("vercel link failed. {0}" -f (($autoLinkResult.Output -join "`n").Trim()))
  }
}

$envVars = Parse-DotEnv -Path $EnvFile

if ($envVars.Count -eq 0) {
  throw ("No variables found in {0}" -f $EnvFile)
}

foreach ($target in $Targets) {
  $targetLabel = $target
  if ($Branch -and $target -eq "preview") {
    $targetLabel = ("{0} [{1}]" -f $target, $Branch)
  }

  Write-Host ""
  Write-Step ("Checking existing Vercel env vars for {0}..." -f $targetLabel)

  $existingKeys = Get-ExistingVercelEnvKeys -Target $target -BranchName $Branch

  Write-Step ("Pushing {0} env vars from {1} to Vercel target: {2}" -f $envVars.Count, $EnvFile, $targetLabel)

  foreach ($key in $envVars.Keys) {
    $value = [string]$envVars[$key]
    $exists = $existingKeys.Contains($key)

    if ($exists) {
      $action = "update"
    }
    else {
      $action = "add"
    }

    $displayAction = $action.ToUpperInvariant()

    if ($DryRun) {
      Write-Host ("DRY-RUN {0}: {1}" -f $displayAction, $key)
      continue
    }

    Write-Host ("{0}: {1}" -f $displayAction, $key)

    $useSensitive = $false
    if (-not $Plain -and ($target -eq "production" -or $target -eq "preview")) {
      $useSensitive = $true
    }

    Invoke-VercelEnvWrite -Action $action -Key $key -Value $value -Target $target -BranchName $Branch -UseSensitive $useSensitive
  }
}

Write-Host ""
Write-Ok "Done. Current Vercel env lists:"

foreach ($target in $Targets) {
  $targetLabel = $target
  if ($Branch -and $target -eq "preview") {
    $targetLabel = ("{0} [{1}]" -f $target, $Branch)
  }

  Write-Host ""
  Write-Step ("=== {0} ===" -f $targetLabel)

  $listArgs = @("env", "ls", $target)
  if ($Branch -and $target -eq "preview") {
    $listArgs += @("--git-branch", $Branch)
  }

  $listResult = Invoke-VercelCommand -Arguments $listArgs
  foreach ($line in $listResult.Output) {
    Write-Host $line
  }

  if ($listResult.ExitCode -ne 0) {
    throw ("vercel env ls failed for {0}" -f $target)
  }
}

if ($Redeploy) {
  if ($DryRun) {
    Write-Host "DRY-RUN REDEPLOY: vercel --prod"
  }
  else {
    Write-Step "Redeploying production..."
    $deployResult = Invoke-VercelCommand -Arguments @("--prod")
    foreach ($line in $deployResult.Output) {
      Write-Host $line
    }

    if ($deployResult.ExitCode -ne 0) {
      throw "vercel --prod failed"
    }
  }
}
