import test from 'node:test'
import assert from 'node:assert/strict'

import { runCompatibilityFlow, STATES } from '../src/reproducer.mjs'

test('models Figma rejecting OMP then issuing a client under the Codex identity', async () => {
  const calls = []
  const provider = {
    async registerClient(body) {
      calls.push(['register', body])
      if (body.client_name === 'oh-my-pi') return { status: 403, error: 'unapproved_client' }
      return { status: 200, client_id: 'REDACTED' }
    },
    async authorize(params) {
      calls.push(['authorize', params])
      return { status: 200 }
    }
  }

  const result = await runCompatibilityFlow({ provider })

  assert.equal(result.state, STATES.AUTHORIZED)
  assert.equal(result.clientIdSource, 'figma-dcr-codex')
  assert.deepEqual(calls.map(([name]) => name), ['register', 'register', 'authorize'])
  assert.equal(calls[1][1].client_name, 'Codex')
  assert.equal(calls[1][1].token_endpoint_auth_method, 'client_secret_post')
  assert.equal(calls[2][1].codeChallengeMethod, 'S256')
})

test('prefers an explicitly configured client identity', async () => {
  const calls = []
  const provider = {
    async registerClient() {
      calls.push('register')
      return { status: 403 }
    },
    async authorize(params) {
      calls.push(['authorize', params])
      return { status: 200 }
    }
  }

  const result = await runCompatibilityFlow({
    provider,
    configuredClientId: 'REDACTED'
  })

  assert.equal(result.state, STATES.AUTHORIZED)
  assert.equal(result.clientIdSource, 'config')
  assert.deepEqual(calls, [
    'register',
    ['authorize', { clientId: 'REDACTED', codeChallengeMethod: 'S256' }]
  ])
})
