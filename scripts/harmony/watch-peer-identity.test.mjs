import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, X509Certificate } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { deriveWatchFingerprint, readWatchIdentity } from './watch-peer-identity.mjs'

test('encodes the uncompressed P-256 point, retaining Base64 case and padding', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
  const point = key.export({ type: 'spki', format: 'der' }).subarray(-65)
  assert.equal(point[0], 4)
  assert.equal(deriveWatchFingerprint('ch.example.fit', key), `ch.example.fit_${point.toString('base64')}`)
  assert.throws(() => deriveWatchFingerprint('ch.example.fit', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey), /P-256/)
  assert.throws(() => deriveWatchFingerprint('a'.repeat(40), key), /127/)
})

test('readWatchIdentity verifies certificate SHA-256 and derives the peer fingerprint', t => {
  const dir = mkdtempSync(join(tmpdir(), 'opengym-watch-id-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const signingDir = join(dir, 'harmonywatch/signing')
  mkdirSync(signingDir, { recursive: true })
  const keyPath = join(dir, 'leaf.key')
  const certPath = join(signingDir, 'opengym-fit-leaf.cer')
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
    '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=opengym-test'
  ], { stdio: 'ignore' })
  const cert = new X509Certificate(readFileSync(certPath))
  const sha256 = cert.fingerprint256.replaceAll(':', '')
  const idPath = join(dir, 'harmonywatch/watch-debug-identity.json')
  writeFileSync(idPath, JSON.stringify({ watchBundleName: 'ch.example.fit', watchCertificateSha256: sha256.toLowerCase() }))

  const identity = readWatchIdentity(dir)
  assert.equal(identity.watchCertificateSha256, sha256)
  assert.equal(identity.watchPeerFingerprint, `ch.example.fit_${cert.publicKey.export({ type: 'spki', format: 'der' }).subarray(-65).toString('base64')}`)

  writeFileSync(idPath, JSON.stringify({ watchBundleName: 'ch.example.fit', watchCertificateSha256: '0'.repeat(64) }))
  assert.throws(() => readWatchIdentity(dir), /differs/)

  rmSync(idPath)
  assert.throws(() => readWatchIdentity(dir), /watch-debug-identity\.example\.json/)

  const root = new URL('../../', import.meta.url)
  if (existsSync(new URL('harmonywatch/watch-debug-identity.json', root)) && existsSync(new URL('harmonywatch/signing/opengym-fit-leaf.cer', root))) {
    const localIdentity = readWatchIdentity(root)
    const localCert = new X509Certificate(readFileSync(new URL('harmonywatch/signing/opengym-fit-leaf.cer', root)))
    assert.equal(localIdentity.watchCertificateSha256, localCert.fingerprint256.replaceAll(':', ''))
    assert.equal(localIdentity.watchPeerFingerprint, `${localIdentity.watchBundleName}_${localCert.publicKey.export({ type: 'spki', format: 'der' }).subarray(-65).toString('base64')}`)
  }
})
