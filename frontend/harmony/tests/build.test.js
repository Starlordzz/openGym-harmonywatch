import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkBundles } from '../../../scripts/harmony/check-bundles.mjs'

test('the device JS size guard accepts the limit and rejects one extra byte', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-bundle-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(join(dir, 'app.js'), Buffer.alloc(49152, 32))
  assert.equal((await checkBundles(dir))[0].bytes, 49152)
  await writeFile(join(dir, 'app.js'), Buffer.alloc(49153, 32))
  await assert.rejects(checkBundles(dir), /app.js \(49153\)/)
})
