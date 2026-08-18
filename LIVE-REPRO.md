# Figma MCP DCR repro — non-OMP evidence

This document records the live OAuth behavior observed against Figma MCP without publishing credentials or replaying credentials across client identities.

## Endpoint

```text
POST https://api.figma.com/v1/oauth/mcp/register
Content-Type: application/json
```

The probes used the same OAuth shape:

```json
{
  "redirect_uris": ["http://127.0.0.1:<loopback-port>/oauth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

All returned credentials were discarded. None are included here.

## Repro A — declared Hermes client

Request differs only in:

```json
{
  "client_name": "Hermes Agent"
}
```

Observed response:

```text
HTTP 403 Forbidden
```

The response was plain text and contained no JSON error fields or credentials.

This is independently reproducible with:

```sh
node scripts/live-dcr-repro.mjs
```

The script performs no authorization and discards any credential-shaped fields.

## Repro B — declared Codex client

A separate controlled setup session used:

```json
{
  "client_name": "Codex",
  "redirect_uris": ["http://127.0.0.1:58028/callback/<opaque-callback-token>"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

Observed response:

```text
HTTP 200
```

Figma returned a fresh client ID and matching client secret. The response was inspected only for field presence, then used in the historical setup and not copied into this repository.

Using the same `Codex` name with a redirect URI that was not accepted produced:

```text
HTTP 400
error: invalid_redirect_uri
```

That demonstrates that the redirect URI is also validated; the allowlist is not the only check.

## Historical OMP setup sequence

The OMP session then:

1. Attempted native Figma authorization.
2. Tried a Codex-issued identity without its matching secret; token exchange failed.
3. Performed the successful `Codex` DCR request above.
4. Wrote the returned client ID and secret to `~/.omp/agent/mcp.json` under `figma-readonly`.
5. Reauthorized OMP with PKCE.
6. Connected successfully.

The configured client ID was verified to match the client ID recorded in that session. Values are intentionally omitted.

## Boundary of the safe repro

The remaining experiment would be:

```text
Use the Codex-issued client ID + secret
from a separately declared Hermes/non-Codex client
and complete authorization.
```

That is credential replay across client identities and would actively bypass Figma's `Hermes Agent` rejection. It is not performed here.

The evidence already establishes the reportable behavior:

- Hermes declaration → `403 Forbidden`.
- Codex declaration with an accepted redirect → `200` and credential issuance.
- OMP subsequently used the Codex-issued credentials.

## Artifacts

- `scripts/live-dcr-repro.mjs` — live, non-OMP comparison probe.
- `src/reproducer.mjs` — offline model of the confirmed DCR sequence.
- `src/omp-figma-compat.ts` — extracted OMP compatibility seam.
