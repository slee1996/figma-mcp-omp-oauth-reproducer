# Figma MCP OAuth compatibility repro

A concise, sanitized record of the Figma MCP OAuth behavior observed with oh-my-pi (OMP) and Hermes.

## Finding

Figma's remote MCP endpoint is:

```text
https://mcp.figma.com/mcp
```

Live DCR results:

```text
client_name: Hermes Agent  → HTTP 403 Forbidden
client_name: Codex         → HTTP 200 + OAuth client credentials
```

OMP then connected successfully using a statically configured client identity. Hermes' native OAuth flow behaved the same way: dynamic registration was rejected, while a static client configuration advanced to the PKCE authorization URL.

This points to a Figma registration-policy issue, not an MCP transport issue. MCP/OAuth supports both dynamic registration and pre-registered clients. `client_name` is client metadata, not cryptographic proof of the calling application.

## OMP configuration shape

OMP stores MCP configuration at:

```text
~/.omp/agent/mcp.json
```

Sanitized shape:

```json
{
  "mcpServers": {
    "figma-readonly": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "oauth": {
        "clientId": "[PROVIDER_ISSUED_CLIENT_ID]",
        "clientSecret": "[PROVIDER_ISSUED_CLIENT_SECRET]",
        "redirectUri": "http://127.0.0.1:[PORT]/callback/[PATH]",
        "callbackPort": 58028,
        "callbackPath": "/callback/[PATH]"
      }
    }
  }
}
```

The client ID and secret must come from a legitimate provider-approved registration. Do not copy credentials from another application or commit them.

## Authenticate Figma MCP with OMP

The working OMP method was **static-client OAuth**, not automatic extraction from the `403` response.

### 1. Obtain an approved client registration

OMP first attempts dynamic registration as `oh-my-pi`. Figma rejects that with `403 Forbidden`. In the recorded demonstration, that approved identity was `Codex`; it must not be reused by another application without explicit provider authorization.

The registration request shape was:

```json
{
  "client_name": "[PROVIDER_APPROVED_CLIENT_NAME]",
  "redirect_uris": ["http://127.0.0.1:[PORT]/callback/[PATH]"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post"
}
```

The provider returned a client ID and secret. Keep both private. Do not use another application's identity unless the provider explicitly authorizes that arrangement.

### 2. Put the returned values in OMP's config

Edit:

```text
~/.omp/agent/mcp.json
```

Use the exact redirect URI registered with the provider:

```json
{
  "mcpServers": {
    "figma-readonly": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "oauth": {
        "clientId": "[RETURNED_CLIENT_ID]",
        "clientSecret": "[RETURNED_CLIENT_SECRET]",
        "redirectUri": "http://127.0.0.1:[PORT]/callback/[PATH]",
        "callbackPort": 58028,
        "callbackPath": "/callback/[PATH]"
      }
    }
  }
}
```

Keep `clientId`, `clientSecret`, `redirectUri`, `callbackPort`, and `callbackPath` consistent. A redirect mismatch produces an OAuth error even when the client credentials are valid.

### 3. Run OMP and complete normal OAuth

Start OMP from the project directory:

```sh
omp
```

When the Figma server initializes, OMP builds a standard Authorization Code + PKCE flow with:

- `response_type=code`
- the configured `client_id`
- the registered loopback `redirect_uri`
- CSRF `state`
- `code_challenge_method=S256`
- the Figma MCP resource URL

Complete Figma login and consent in the browser. OMP receives the loopback callback, exchanges the code using the configured client secret and PKCE verifier, stores its OAuth state locally, and connects `figma-readonly`.

Verify with a read-only Figma MCP call. Do not print the authorization URL, code, access token, refresh token, or client secret in logs.

This is the complete method represented by the extracted seam in `src/omp-figma-compat.ts`. The code documents resolution and PKCE construction; it intentionally does not contain a live registration response or credentials.


Hermes stores MCP configuration at:

```text
~/.hermes/config.yaml
```

Its native static-client shape is:

```yaml
mcp_servers:
  figma:
    url: https://mcp.figma.com/mcp
    auth: oauth
    oauth:
      client_id: "[PROVIDER_ISSUED_CLIENT_ID]"
      client_secret: "[PROVIDER_ISSUED_CLIENT_SECRET]"
      client_name: "[APPROVED_CLIENT_NAME]"
      redirect_port: 0
```

Add and test the native server with:

```sh
hermes mcp add figma --url https://mcp.figma.com/mcp --auth oauth
hermes mcp login figma
hermes mcp test figma
```

The login step requires an interactive browser session. Never paste credentials or authorization codes into logs, tickets, or repositories.

## Run the sanitized live DCR comparison

This is a standalone, non-OMP probe. It sends only registration requests and discards any credential-shaped response fields:

```sh
node scripts/live-dcr-repro.mjs
```

Expected evidence is a provider-policy difference, not a successful bypass:

```text
Hermes Agent → 403 Forbidden
Codex         → provider-dependent; redirect URI must also be accepted
```

## Repository layers

- `scripts/live-dcr-repro.mjs` — live DCR comparison; no credentials persisted.
- `src/reproducer.mjs` — offline model of rejected OMP registration followed by an approved static-client registration and PKCE.
- `src/omp-figma-compat.ts` — extracted OMP compatibility seam from oh-my-pi 17.3.4.
- `LIVE-REPRO.md` — detailed evidence and exact boundary of the safe reproduction.
- `test/reproducer.test.mjs` — offline tests.

## Security boundary

This repository does **not** implement credential replay or claim that Codex credentials are transferable to Hermes. A complete cross-application transfer test requires explicit provider authorization. The reportable facts are:

1. Hermes registration was rejected.
2. An approved Codex registration returned credentials.
3. Static OAuth configuration bypassed dynamic registration and reached normal PKCE authorization.

Run tests with:

```sh
npm test
```
