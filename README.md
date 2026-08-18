# Figma MCP / OMP OAuth compatibility reproducer

This is a **sanitized, offline reproducer** of the OAuth compatibility path observed while connecting oh-my-pi (OMP) to Figma MCP.

It does not contact Figma and contains no client IDs, client secrets, access tokens, refresh tokens, or redirect credentials.

## Observed flow

1. OMP discovers Figma's OAuth authorization and registration endpoints.
2. OMP attempts RFC 7591 dynamic client registration as `oh-my-pi`.
3. Figma rejects registration for an unapproved client (`403`).
4. A valid static/public client identity is obtained from provider metadata or the provider's authorization response path.
5. OMP retries authorization with that configured client identity and PKCE.

The important policy question is whether Figma binds that client identity tightly enough to the actual application, or only blocks dynamic registration.

## Run

```sh
node --test
```

## Scope

This repository intentionally models the protocol behavior without implementing a live bypass. To test a real integration, use a client registration and redirect URI explicitly authorized by the provider.
