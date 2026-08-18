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

## Hermes configuration shape

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
