# CafeLeo /app Nginx Handoff

## Status: READY_FOR_OPERATOR

Bazarbaaz APP infrastructure is complete. The CafeLeo droplet nginx must be
configured to reverse-proxy `/app/*` traffic to the dedicated Bazarbaaz APP
Vercel deployment.

## Architecture

```
Browser                CafeLeo nginx              Vercel (Bazarbaaz APP)
─────────              ─────────────              ──────────────────────
https://iran.    ──▶   location ^~ /app/   ──▶   bazarbaaz-app.vercel.app
cafeleo.vip/app/       proxy_pass                 (APP_BASE_PATH=/app)
                       + proxy token
```

## Required nginx Configuration

Add to the CafeLeo server block (`iran.cafeleo.vip`):

```nginx
# Redirect /app to /app/ (trailing slash consistency)
location = /app {
    return 308 /app/;
}

# Proxy all /app/* traffic to Bazarbaaz APP deployment
location ^~ /app/ {
    proxy_pass https://bazarbaaz-app.vercel.app;

    proxy_http_version 1.1;

    # Standard proxy headers
    proxy_set_header Host bazarbaaz-app.vercel.app;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # Bazarbaaz APP proxy authentication token
    # This secret must match BAZARBAAZ_APP_PROXY_TOKEN in the Vercel environment
    proxy_set_header X-Bazarbaaz-Proxy-Token ${BAZARBAAZ_APP_PROXY_TOKEN};

    # Timeouts
    proxy_connect_timeout 10s;
    proxy_read_timeout 30s;
    proxy_send_timeout 30s;
}
```

## Secret Management

1. Generate a strong random token (32+ characters):
   ```bash
   openssl rand -hex 32
   ```

2. Store in Bazarbaaz APP Vercel environment:
   - Variable: `BAZARBAAZ_APP_PROXY_TOKEN`
   - Value: <generated token>

3. Configure in CafeLeo nginx:
   - Use `env` directive or include the token via a secure config snippet
   - Never commit the token to Git

## Deployment Steps

1. **Validate nginx configuration:**
   ```bash
   sudo nginx -t
   ```

2. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

3. **Smoke test:**
   ```bash
   curl -I https://iran.cafeleo.vip/app/
   # Expected: 200 OK (or 308 redirect to /app/)
   ```

4. **Verify tenant resolution:**
   ```bash
   curl -s https://iran.cafeleo.vip/app/ | head -20
   # Should return Bazarbaaz APP content for CafeLeo
   ```

## Rollback

If issues occur, remove the `/app` location blocks and reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Security Notes

- The `X-Bazarbaaz-Proxy-Token` header authenticates CafeLeo nginx to Bazarbaaz
- Without this token, Bazarbaaz will NOT trust `X-Forwarded-Host` headers
- Direct requests to `bazarbaaz-app.vercel.app` with spoofed `X-Forwarded-Host`
  will be rejected (fail-closed design)
- CafeLeo root (`/`) remains on CafeLeo's application — Bazarbaaz only owns `/app/*`

## Bazarbaaz APP Environment Variables Required

| Variable | Value | Purpose |
|----------|-------|---------|
| `APP_BASE_PATH` | `/app` | Build-time basePath for Next.js |
| `BAZARBAAZ_APP_PROXY_TOKEN` | <secret> | Proxy authentication token |
| `DATABASE_URL` | <neon-url> | Database connection |
| `DIRECT_URL` | <neon-url> | Direct database connection |
| `NEXTAUTH_SECRET` | <secret> | Auth.js secret |
| `NEXTAUTH_URL` | `https://iran.cafeleo.vip/app` | Auth callback base URL |
| `BLOB_READ_WRITE_TOKEN` | <token> | Vercel Blob storage |
| `INOTI_ALLOW_LIVE_PAYMENTS` | `false` | Payment gate (OFF) |
| `INOTI_RUNTIME_MUTATIONS_APPROVED` | `false` | Runtime mutation gate (OFF) |

## CafeLeo Coder Contract

The CafeLeo application must use the following for APP integration:

- **Public Catalog endpoint:** `/api/public/v1/organizations/{slug}/products`
- **Mapping source key:** `CAFELEO_PUBLIC_CATALOG_V1`
- **purchase.href format:** `https://iran.cafeleo.vip/app/purchase/product/{productId}`
- **APP base URL:** `https://iran.cafeleo.vip/app/`
- **Proxy upstream:** `https://bazarbaaz-app.vercel.app`
- **Proxy auth header:** `X-Bazarbaaz-Proxy-Token`
- **Feature flag:** `NEXT_PUBLIC_APP_ENABLED` must remain `false` until nginx is live
