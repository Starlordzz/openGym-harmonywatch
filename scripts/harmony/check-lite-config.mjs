#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { checkPermissions, readBinConfig } from './lite-config.mjs'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node check-lite-config.mjs [--bin] <config.json or Lite BIN>')
  process.exit(1)
}
try {
  const binary = args[0] === '--bin'
  const file = args[binary ? 1 : 0]
  if (!file) throw Error('Missing configuration/BIN path')
  const bytes = readFileSync(file)
  const config = binary ? readBinConfig(bytes) : JSON.parse(bytes.toString('utf8'))
  checkPermissions(config)
  console.log('Lite permission metadata OK: ' + (config.module.reqPermissions || []).length + ' entries')
} catch (error) {
  console.error('Lite config check failed: ' + error.message)
  process.exitCode = 1
}
