# push-vercel-env.ps1
$ErrorActionPreference = "Continue"
$VERCEL_SCOPE = "ahmads-projects-1b4ce1dc"
$ENVIRONMENT = "production"

# Clear proxy for Vercel CLI
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:NO_PROXY = ""
$env:http_proxy = ""
$env:https_proxy = ""
$env:no_proxy = ""

$localEnv = @{}
Get-Content ".env" | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -le 0) { return }
  $key = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if (-not $key -or $key -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") { return }
  $localEnv[$key] = $value
}

Write-Host "Fetching existing Vercel env list..."
$lsOutput = cmd /c "vercel env ls $ENVIRONMENT --scope $VERCEL_SCOPE 2>&1" | Out-String
$existingKeys = @{}
$lsOutput -split "`n" | ForEach-Object {
  $line = $_.Trim()
  if ($line -and $line -notmatch "^(Name|Retrieving|Environment Variables found|>|\s*$)" -and $line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s") {
    $name = $Matches[1]
    $existingKeys[$name] = $true
  }
}

Write-Host "Found $($existingKeys.Count) existing vars"
Write-Host "Pushing $($localEnv.Count) local vars..."

$added = 0
$updated = 0
$failed = 0

foreach ($kv in $localEnv.GetEnumerator()) {
  $key = $kv.Key
  $value = $kv.Value

  try {
    if ($existingKeys.ContainsKey($key)) {
      Write-Host "UPDATE $key"
      $value | cmd /c "vercel env update $key $ENVIRONMENT --scope $VERCEL_SCOPE -y 2>&1" | Out-Null
      $updated++
    } else {
      Write-Host "ADD $key"
      $value | cmd /c "vercel env add $key $ENVIRONMENT --scope $VERCEL_SCOPE -y 2>&1" | Out-Null
      $added++
    }
  } catch {
    Write-Host "FAIL $key : $_"
    $failed++
  }
}

Write-Host ""
Write-Host "Done. Added: $added, Updated: $updated, Failed: $failed"
Write-Host "Trigger a new Vercel deploy to apply."
