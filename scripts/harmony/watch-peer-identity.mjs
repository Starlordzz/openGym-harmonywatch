import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// HarmonyOS 5+ Lite Wearable identity; Android peers still use certificate SHA-256.
export function deriveWatchFingerprint(bundleName, publicKey) {
  const key = publicKey.export({ format: 'jwk' })
  if (key.kty !== 'EC' || key.crv !== 'P-256') throw Error('Watch signing certificate must use a P-256 EC public key')
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(key.x, 'base64url'), Buffer.from(key.y, 'base64url')])
  if (point.length !== 65) throw Error('Expected a 65-byte uncompressed public key')
  const fingerprint = `${bundleName}_${point.toString('base64')}`
  if (fingerprint.length > 127) throw Error('Lite Wearable peer fingerprint exceeds 127 characters')
  return fingerprint
}

export function readWatchIdentity(root = new URL('../../', import.meta.url)) {
  const base = root instanceof URL ? root : pathToFileURL(resolve(root) + '/')
  const identity = JSON.parse(readFileSync(new URL('harmonywatch/watch-debug-identity.json', base), 'utf8'))
  const cert = new X509Certificate(readFileSync(new URL('harmonywatch/signing/opengym-fit-leaf.cer', base)))
  const sha256 = cert.fingerprint256.replaceAll(':', '')
  if (sha256 !== identity.watchCertificateSha256.replaceAll(':', '').toUpperCase()) throw Error('Watch identity certificate SHA-256 differs from the signing leaf certificate')
  return { ...identity, watchCertificateSha256: sha256, watchPeerFingerprint: deriveWatchFingerprint(identity.watchBundleName, cert.publicKey) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const identity = readWatchIdentity()
  const field = process.argv[2]
  if (!['watchBundleName', 'watchCertificateSha256', 'watchPeerFingerprint'].includes(field)) throw Error('Choose a public watch identity field')
  console.log(identity[field])
}
