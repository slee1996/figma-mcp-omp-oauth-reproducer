#!/usr/bin/env node

/**
 * Live, non-OMP Figma MCP DCR comparison.
 *
 * Sends two registration probes and prints only status/error metadata. Any
 * client_id/client_secret returned by Figma is discarded immediately.
 */

const endpoint = 'https://api.figma.com/v1/oauth/mcp/register'
const redirectUri = 'http://127.0.0.1:59991/oauth/callback'

async function register(clientName) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    })
  })

  const text = await response.text()
  let body = {}
  try {
    body = JSON.parse(text)
  } catch {
    // Figma commonly returns plain-text Forbidden for rejected DCR.
  }

  return {
    client_name: clientName,
    status: response.status,
    ok: response.ok,
    error: body.error ?? null,
    error_description: body.error_description ?? null,
    response_keys: Object.keys(body).sort(),
    credentials_discarded: Boolean(body.client_id || body.client_secret)
  }
}

console.log(JSON.stringify({
  endpoint,
  redirect_uri: redirectUri,
  probes: [await register('Hermes Agent'), await register('Codex')]
}, null, 2))
