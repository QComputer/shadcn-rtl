$ErrorActionPreference = 'Stop'
$containerName = "damoon-d4-sandbox-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$databaseName = 'bazarbaaz_h3d3p1_tx_verify'
$password = [guid]::NewGuid().ToString('N')
$databaseUrl = $null

try {
  docker run --detach --rm --name $containerName --env "POSTGRES_PASSWORD=$password" --env "POSTGRES_DB=$databaseName" --publish '127.0.0.1::5432' postgres:17 | Out-Null
  $mappedPort = (docker port $containerName '5432/tcp' | Select-Object -First 1).Split(':')[-1]
  if (-not $mappedPort) { throw 'PostgreSQL did not expose its loopback port.' }

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    docker exec $containerName pg_isready -U postgres -d $databaseName *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready.' }

  $databaseUrl = "postgresql://postgres:$password@127.0.0.1:$mappedPort/${databaseName}?schema=public"
  Set-Item Env:DATABASE_URL $databaseUrl
  Set-Item Env:DIRECT_URL $databaseUrl
  Set-Item Env:DATABASE_RUNTIME_ADAPTER 'postgresql'
  Set-Item Env:AI_MEDIA_APPLICATION_STORAGE_ADAPTER 'local-test'
  Set-Item Env:NODE_ENV 'test'

  pnpm exec prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Disposable database migration failed.' }
  pnpm exec prisma generate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed.' }
  pnpm exec tsx --require=./scripts/e2e/register-server-only.cjs --test tests/integration/hotel-anonymous-hold-http-response-loss.local.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'Damoon D4 disposable PostgreSQL demo failed.' }
}
finally {
  foreach ($name in @('DATABASE_URL', 'DIRECT_URL', 'DATABASE_RUNTIME_ADAPTER', 'AI_MEDIA_APPLICATION_STORAGE_ADAPTER', 'NODE_ENV')) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
  if ($containerName) { docker rm --force $containerName *> $null }
}
