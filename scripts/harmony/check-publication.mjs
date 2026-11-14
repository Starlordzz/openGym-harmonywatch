#!/usr/bin/env node
// Inspect the staged change, reporting locations rather than secret values.
import { execFileSync } from 'node:child_process'
const git = (args, input) => execFileSync('git', args, { input, maxBuffer: 128 * 1024 * 1024 })
const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).toString().split('\0').filter(Boolean)
const blocked = /(^|\/)(signing|artifacts|node_modules|build|file_system|\.hvigor)\/|(^|\/)\.env$|(^|\/)(phone|watch)-debug-identity\.json$|\.(p12|p7b|jks|keystore|apk|hap|bin)$/i
const patterns = [ /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/, /\bAKIA[A-Z0-9]{16}\b/ ]
const index = new Map(git(['ls-files', '--stage', '-z']).toString().split('\0').flatMap(row => {
  const m = row.match(/^[0-7]+ ([a-f0-9]+) 0\t([\s\S]+)$/)
  return m ? [[m[2], m[1]]] : []
}))
let bad = 0, scanned = 0
const selected = names.filter(name => {
  if (blocked.test(name)) { console.error('Local-only path staged: ' + name); bad++; return false }
  return !/\.(png|jpe?g|gif|webp|mp4|woff2?|ttf|ico|jar|pdf|zip)$/i.test(name)
})
const blobs = git(['cat-file', '--batch'], selected.map(name => index.get(name)).join('\n') + '\n')
let offset = 0
for (const name of selected) {
  const end = blobs.indexOf(10, offset), header = blobs.subarray(offset, end).toString()
  const match = header.match(/^[a-f0-9]+ blob (\d+)$/)
  if (!match) throw Error('Cannot inspect staged file: ' + name)
  const size = Number(match[1]), bytes = blobs.subarray(end + 1, end + 1 + size)
  offset = end + 1 + size + 1
  if (bytes.includes(0)) continue
  scanned++
  bytes.toString().split('\n').forEach((line, i) => { if (patterns.some(p => p.test(line))) { console.error('Credential pattern: ' + name + ':' + (i + 1)); bad++ } })
}
console.log('Publication scan: ' + names.length + ' staged files, ' + scanned + ' text files, ' + bad + ' findings')
if (bad) process.exitCode = 1
