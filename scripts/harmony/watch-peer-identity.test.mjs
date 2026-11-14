import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { deriveWatchFingerprint, readWatchIdentity } from './watch-peer-identity.mjs'

test('encodes the uncompressed P-256 point, retaining Base64 case and padding', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
  const point = key.export({ type: 'spki', format: 'der' }).subarray(-65)
  assert.equal(point[0], 4)
  assert.equal(deriveWatchFingerprint('ch.example.fit', key), `ch.example.fit_${point.toString('base64')}`)
  assert.throws(() => deriveWatchFingerprint('ch.example.fit', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey), /P-256/)
  assert.throws(() => deriveWatchFingerprint('a'.repeat(40), key), /127/)
})

test('build defaults come from the actual public signing certificate', () => {
  const root = new URL('../../', import.meta.url)
  const identity = readWatchIdentity(root)
  const cert = new X509Certificate(readFileSync(new URL('harmonywatch/signing/opengym-fit-leaf.cer', root)))
  assert.equal(identity.watchCertificateSha256, cert.fingerprint256.replaceAll(':', ''))
  assert.equal(identity.watchPeerFingerprint, `${identity.watchBundleName}_${cert.publicKey.export({ type: 'spki', format: 'der' }).subarray(-65).toString('base64')}`)
})
