import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { deriveWatchFingerprint } from './watch-peer-identity.mjs'

test('deriveWatchFingerprint builds bundle_Base64(04||X||Y) for P-256 and rejects non-P256 or overlong identities', () => {
  const { publicKey: ec } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const fp = deriveWatchFingerprint('host.msknet.opengym.fit', ec)
  assert.match(fp, /^host\.msknet\.opengym\.fit_B[A-P][A-Za-z0-9+/]{84}[AEIMQUYcgkosw048]=$/)
  assert.ok(fp.length <= 127)

  const { publicKey: p384 } = generateKeyPairSync('ec', { namedCurve: 'P-384' })
  assert.throws(() => deriveWatchFingerprint('host.msknet.opengym.fit', p384), /P-256/)

  const { publicKey: rsa } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  assert.throws(() => deriveWatchFingerprint('host.msknet.opengym.fit', rsa), /P-256/)

  assert.throws(() => deriveWatchFingerprint('com.' + 'a'.repeat(50) + '.fit', ec), /127/)
})
