function Invoke-DamoonTempCleanup {
  param([string]$TempRoot, [string]$TempBase, [string]$Suffix, [int]$ExitCode, [scriptblock]$Delete = { param($Path) Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop })
  try {
    if ($Suffix -notmatch '^[a-f0-9]{16}$') { throw 'Invalid task identifier.' }
    $base = (Resolve-Path -LiteralPath $TempBase -ErrorAction Stop).Path
    $expected = Join-Path $base "damoon-local-e2e-$Suffix"
    if ([IO.Path]::GetFullPath($TempRoot) -ne $expected) { throw 'Unexpected task directory.' }
    if (Test-Path -LiteralPath $expected) {
      $item = Get-Item -LiteralPath $expected -Force -ErrorAction Stop
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Task directory is a reparse point.' }
      & $Delete $expected
      if (Test-Path -LiteralPath $expected) { throw 'Task directory remains after cleanup.' }
    }
  } catch {
    [Console]::Error.WriteLine('Task temporary directory cleanup failed; credentials may remain.')
    if ($ExitCode -eq 0) { return 1 }
  }
  return $ExitCode
}
