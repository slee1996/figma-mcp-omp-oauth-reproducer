# Agent Prompt: Implement the Figma MCP OAuth fallback

Copy the prompt below into a coding agent working in this repository.

```text
You are working in a sanitized repository that documents Figma MCP OAuth compatibility with oh-my-pi (OMP) and Hermes.

## Goal

Implement and test the provider-specific OAuth compatibility seam needed when Figma rejects dynamic client registration but permits a provider-approved pre-registered client.

Do not build a credential-replay tool. Do not add real OAuth values. Do not make live Figma authorization requests from tests or source code.

## Observed provider behavior

Figma's remote MCP endpoint is:

  https://mcp.figma.com/mcp

Observed DCR behavior:

  client_name: "Hermes Agent" -> HTTP 403 Forbidden
  provider-approved client identity -> HTTP 200 with OAuth client credentials

OMP's actual behavior is:

1. Discover the OAuth authorization server and registration endpoints.
2. Attempt RFC 7591 dynamic client registration as `oh-my-pi`.
3. Receive a provider rejection (`403`, often with `unapproved_client`).
4. Stop dynamic registration and require a statically configured client ID and, if needed, client secret.
5. Build normal Authorization Code + PKCE authorization.
6. Use a loopback redirect, CSRF state, S256 code challenge, and optional scope.

The client identity must come from a legitimate provider-approved registration. In the historical demonstration the approved identity was `Codex`; do not reuse another application's credentials unless the provider explicitly authorizes that arrangement.

## Repository scope

Keep the implementation offline and sanitized. The relevant files are:

- `src/omp-figma-compat.ts` — extracted TypeScript compatibility seam.
- `src/reproducer.mjs` — offline model of the confirmed fallback sequence.
- `test/reproducer.test.mjs` — Node tests.
- `scripts/live-dcr-repro.mjs` — live DCR comparison probe; credentials must be discarded.
- `LIVE-REPRO.md` — evidence and safety boundary.

Do not add `~/.omp/agent/mcp.json`, client secrets, access tokens, refresh tokens, authorization codes, callback secrets, or browser artifacts to this repository.

## Required implementation

### 1. Resolve a static client ID

Prefer, in order:

1. Explicit `oauth.clientId` configuration.
2. A `client_id` already present in the authorization URL.

Return `undefined` when neither is available.

### 2. Parse provider metadata defensively

Accept these metadata field variants:

- `client_id`
- `clientId`
- `default_client_id`
- `public_client_id`

This is a separate compatibility path. Do not claim that the client ID came from a Figma `403` body unless the response actually contains one.

### 3. Classify registration failure

Record the registration endpoint, HTTP status, and sanitized detail.

Treat the rejection as the definitive Figma unapproved-client case only when:

- status is `403`, and
- the detail contains the token `unapproved_client`.

A bare `403` is not enough.

### 4. Produce a manual configuration hint

The hint should tell the operator to configure:

```text
oauth.clientId
```

and, if required:

```text
oauth.clientSecret
```

in OMP's MCP configuration.

Never include credential values in the hint.

### 5. Build the PKCE authorization URL

Set or preserve:

- `response_type=code`
- `client_id`
- `redirect_uri`
- `state`
- `code_challenge`
- `code_challenge_method=S256`
- optional `scope`

Use URL APIs, not string concatenation. Preserve unrelated query parameters.

### 6. Model the confirmed fallback offline

The mock flow should model:

1. Dynamic registration as `oh-my-pi` returning `403 unapproved_client`.
2. A provider-approved static registration returning a placeholder client ID.
3. Authorization using that client ID and PKCE.
4. Terminal `AUTHORIZED` state.

Use placeholders such as `REDACTED`; never use a real ID or secret.

## Tests

Add or update tests for:

1. Explicit configured client ID takes precedence.
2. Authorization URL client ID is used when configuration is absent.
3. Metadata field variants resolve correctly.
4. `403 unapproved_client` is classified correctly.
5. Bare `403` is not classified as definitive.
6. PKCE URL contains `code_challenge_method=S256` and the expected redirect/state values.
7. The mocked fallback reaches `AUTHORIZED` without any network call.

Run:

```sh
npm test
git diff --check
```

## Security and reporting boundary

The repository may explain that a static client identity bypasses dynamic registration. It must not implement or recommend silently replaying credentials issued to Codex from an unapproved Hermes application.

Do not claim that client credentials are transferable unless a provider-authorized test proves it. Distinguish clearly between:

- MCP transport compatibility.
- OAuth dynamic registration.
- Static client configuration.
- PKCE authorization.
- User consent and token exchange.
- Provider policy about approved client identities.

When finished, report the files changed, test output, and any behavior that remains intentionally mocked.
```

## Current repository status

The extracted seam and offline reproducer already implement this prompt's behavior. The repository contains no live credentials and no operational credential-replay path.
