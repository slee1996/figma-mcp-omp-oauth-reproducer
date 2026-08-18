import test from 'node:test'
import assert from 'node:assert/strict'

import { runCompatibilityFlow, STATES } from '../src/reproducer.mjs'

test('models Figma rejecting dynamic registration then accepting provider metadata client identity', async () => {
  const calls = []
  const provider = {
    async registerClient(body) {
      calls.push(['register', body])
      return { status: 403, error: 'unapproved_client' }
    },
    async getOAuthMetadata() {
      calls.push(['metadata'])
      return { authorization_endpoint: 'mock://authorize', public_client_id: 'REDACTED' }
    },
    async authorize(params) {
      calls.push(['authorize', params])
      return { status: 200 }
    }
  }

  const result = await runCompatibilityFlow({ provider })

  assert.equal(result.state, STATES.AUTHORIZED)
  assert.equal(result.clientIdSource, 'provider-metadata')
  assert.deepEqual(calls.map(([name]) => name), ['register', 'metadata', 'authorize'])
  assert.equal(calls[2][1].codeChallengeMethod, 'S256')
})

test('prefers an explicitly configured client identity', async () => {
  const calls = []
  const provider = {
    async registerClient() {
      calls.push('register')
      return { status: 403 }
    },
    async getOAuthMetadata() {
      calls.push('metadata')
      return { public_client_id: 'SHOULD_NOT_BE_USED' }
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
