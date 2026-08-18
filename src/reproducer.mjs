export const STATES = Object.freeze({
  START: 'start',
  REGISTRATION_REJECTED: 'registration_rejected',
  STATIC_CLIENT_RESOLVED: 'static_client_resolved',
  AUTHORIZED: 'authorized'
})

/**
 * Offline model of the compatibility path. The provider is injected so this
 * file never contacts a real service and never contains credentials.
 */
export async function runCompatibilityFlow({ provider, configuredClientId }) {
  let state = STATES.START
  let clientId = configuredClientId

  const registration = await provider.registerClient({
    client_name: 'oh-my-pi',
    redirect_uris: ['http://127.0.0.1:0/callback'],
    token_endpoint_auth_method: 'none'
  })

  if (registration.status !== 200) {
    state = STATES.REGISTRATION_REJECTED
  } else if (registration.client_id) {
    clientId = registration.client_id
  }

  if (!clientId) {
    const metadata = await provider.getOAuthMetadata()
    clientId = metadata.client_id ?? metadata.public_client_id
  }

  if (!clientId) {
    throw new Error('No authorized client identity available')
  }

  state = STATES.STATIC_CLIENT_RESOLVED
  const authorization = await provider.authorize({
    clientId,
    codeChallengeMethod: 'S256'
  })

  if (authorization.status !== 200) {
    throw new Error(`Authorization failed: HTTP ${authorization.status}`)
  }

  state = STATES.AUTHORIZED
  return { state, clientIdSource: configuredClientId ? 'config' : 'provider-metadata' }
}
