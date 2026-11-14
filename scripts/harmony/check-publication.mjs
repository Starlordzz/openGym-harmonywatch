#!/usr/bin/env node
// Inspect the staged change, reporting locations rather than secret values.
import { execFileSync } from 'node:child_process'
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 })
const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).toString().split('\0').filter(Boolean)
const blocked = /(^|\/)(signing|artifacts|node_modules|build|file_system|\.hvigor)\/|(^|\/)\.env$|(^|\/)(phone|watch)-debug-identity\.json$|\.(p12|p7b|jks|keystore|apk|hap|bin)$/i
const patterns = [ /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/, /\bAKIA[A-Z0-9]{16}\b/ ]
let bad = 0, scanned = 0
for (const name of names) {
  if (blocked.test(name)) { console.error('Local-only path staged: ' + name); bad++; continue }
  const bytes = git(['show', ':' + name]); if (bytes.includes(0)) continue
  scanned++
  bytes.toString().split('\n').forEach((line, i) => { if (patterns.some(p => p.test(line))) { console.error('Credential pattern: ' + name + ':' + (i + 1)); bad++ } })
}
console.log('Publication scan: ' + names.length + ' staged files, ' + scanned + ' text files, ' + bad + ' findings')
if (bad) process.exitCode = 1
