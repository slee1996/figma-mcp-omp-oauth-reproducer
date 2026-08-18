# Figma MCP / OMP OAuth compatibility reproducer

This is a **sanitized, offline reproducer** of the OAuth compatibility path observed while connecting oh-my-pi (OMP) to Figma MCP.

It does not contact Figma and contains no client IDs, client secrets, access tokens, refresh tokens, or redirect credentials.

## Observed / modeled flow

The repository contains two related layers:

- `src/omp-figma-compat.ts` is the extracted OMP compatibility seam.
- `src/reproducer.mjs` is a small offline model of the historical setup hypothesis.

The modeled sequence is:

1. OMP discovers Figma's OAuth authorization and registration endpoints.
2. OMP attempts RFC 7591 dynamic client registration as `oh-my-pi`.
3. Figma rejects registration for an unapproved client (`403`).
4. A valid static/public client identity is obtained from provider metadata or an earlier configuration step.
5. OMP authorizes with that configured client identity and PKCE.

Current OMP 17.3.4 does not automatically continue from a definitive `403 unapproved_client`: it records the rejection and asks the operator to configure `oauth.clientId`. The offline model intentionally demonstrates the separate historical fallback hypothesis without making a live request.

The important policy question is whether Figma binds that client identity tightly enough to the actual application, or only blocks dynamic registration.

## OMP source provenance

The extracted compatibility seam in `src/omp-figma-compat.ts` comes from the installed `@oh-my-pi/pi-coding-agent` **17.3.4** sources:

- `src/mcp/oauth-flow.ts`
- `src/mcp/oauth-discovery.ts`

One correction to the earlier reconstruction: the current OMP source does **not** parse a client ID out of the Figma `403` body. It records the `403 unapproved_client` result and emits a manual `oauth.clientId` configuration hint. Separately, its OAuth discovery code accepts provider metadata fields such as `public_client_id` and `default_client_id`.

## Confirmed provenance of the configured client

The original setup was reconstructed from the OMP session recorded on 2026-08-08.

The client identity was **not** extracted from the `403` response and was not copied from Codex's static config. The setup session did this:

1. Attempted `codex mcp login figma`.
2. Attempted an OMP authorization using a Codex-issued identity, but token exchange failed because the matching secret was not available.
3. Called Figma's dynamic registration endpoint:

   ```text
   POST https://api.figma.com/v1/oauth/mcp/register
   ```

   using the approved provider identity:

   ```json
   {
     "client_name": "Codex",
     "grant_types": ["authorization_code", "refresh_token"],
     "response_types": ["code"],
     "token_endpoint_auth_method": "client_secret_post"
   }
   ```

4. Figma returned HTTP `200` with a fresh client ID and matching client secret.
5. The session wrote those returned values into `~/.omp/agent/mcp.json` under `figma-readonly`.
6. OMP completed authorization and connected successfully.

The configured client ID matches the client ID recorded in that session. The values are intentionally omitted here.

The technical provenance is therefore clear: **Figma issued the client credentials during DCR under the `Codex` client identity, and OMP subsequently used them.** That is different from Codex's local config supplying the credentials, and different from OMP having its own Figma-approved client registration.

## Run

```sh
node --test
```

## Scope

This repository intentionally models the protocol behavior without implementing a live bypass. To test a real integration, use a client registration and redirect URI explicitly authorized by the provider.
