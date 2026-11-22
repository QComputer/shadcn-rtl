$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\..\scripts\hotel\damoon-local-cleanup.ps1')

foreach ($original in @(0, 23)) {
  $suffix = [guid]::NewGuid().ToString('N').Substring(0, 16)
  $path = Join-Path $env:TEMP "damoon-local-e2e-$suffix"
  New-Item -ItemType Directory -Path $path | Out-Null
  Set-Content -LiteralPath (Join-Path $path 'fixture.env') -Value 'synthetic fixture'
  $result = Invoke-DamoonTempCleanup -TempRoot $path -TempBase $env:TEMP -Suffix $suffix -ExitCode $original
  if ($result -ne $original -or (Test-Path -LiteralPath $path)) { throw 'Cleanup did not preserve exit status or remove credentials.' }
}

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 16)
$path = Join-Path $env:TEMP "damoon-local-e2e-$suffix"
New-Item -ItemType Directory -Path $path | Out-Null
Set-Content -LiteralPath (Join-Path $path 'fixture.env') -Value 'synthetic fixture'
try {
  foreach ($original in @(0, 23)) {
    $result = Invoke-DamoonTempCleanup -TempRoot $path -TempBase $env:TEMP -Suffix $suffix -ExitCode $original -Delete { param($Path) throw 'Simulated deletion failure' }
    $expected = if ($original -eq 0) { 1 } else { $original }
    if ($result -ne $expected -or -not (Test-Path -LiteralPath (Join-Path $path 'fixture.env'))) { throw 'Deletion failure status was incorrect.' }
  }
} finally {
  $result = Invoke-DamoonTempCleanup -TempRoot $path -TempBase $env:TEMP -Suffix $suffix -ExitCode 0
  if ($result -ne 0) { throw 'Test fixture cleanup failed.' }
}
Write-Output 'Damoon cleanup tests passed.'
