import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The Lite wearable engine builds its page bundle from these sources: one regex literal anywhere
// in the bundle fails the whole page eval in the API 26 previewer, which shows a black screen with
// only "TypeError: wrong type of argument" in the log.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../watch/entry/src/main/js/default')

function sources(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sources(path))
    else if (entry.name.endsWith('.js')) out.push(path)
  }
  return out
}

const keywords = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'instanceof', 'do', 'else', 'new', 'throw'])

// Returns the offsets of regular expression literals. Strings and comments are skipped, and a
// slash only starts a regex where an expression is expected, so division stays unrecognised.
export function regexLiterals(src) {
  const found = []
  let i = 0
  let last = ''
  let lastWord = ''
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    if (c === '\'' || c === '"' || c === '`') {
      const quote = c
      i++
      while (i < src.length && src[i] !== quote) { if (src[i] === '\\') i++; i++ }
      i++
      last = quote
      lastWord = ''
      continue
    }
    if (c === '/') {
      const expectExpression = last === '' || '(,=:[!&|?{};+-*%<>~^'.includes(last) || keywords.has(lastWord)
      if (expectExpression) {
        const start = i
        i++
        let inClass = false
        while (i < src.length && src[i] !== '\n') {
          const d = src[i]
          if (d === '\\') { i += 2; continue }
          if (d === '[') inClass = true
          else if (d === ']') inClass = false
          else if (d === '/' && !inClass) { i++; break }
          i++
        }
        while (i < src.length && 'gimsuy'.includes(src[i])) i++
        found.push(start)
        last = '/'
        lastWord = ''
        continue
      }
    }
    if (/[A-Za-z_$]/.test(c)) {
      let word = ''
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) { word += src[i]; i++ }
      lastWord = word
      last = word[word.length - 1]
      continue
    }
    if (!/\s/.test(c)) { last = c; lastWord = '' }
    i++
  }
  return found
}

test('the shipped watch sources contain no regular expression literals', () => {
  const bad = []
  for (const file of sources(root)) {
    const src = readFileSync(file, 'utf8')
    for (const offset of regexLiterals(src)) {
      const line = src.slice(0, offset).split('\n').length
      bad.push(relative(root, file) + ':' + line)
    }
  }
  assert.deepEqual(bad, [])
})

test('the page object keeps render free for the compiled template', () => {
  const page = readFileSync(join(root, 'pages/index/index.js'), 'utf8')
  assert.match(page, /^\s{2}sync\(\)/m)
  assert.doesNotMatch(page, /^\s{2}render\s*\(/m)
  assert.doesNotMatch(page, /this\.render\(/)
})

test('the scanner recognises a literal but not division, strings or comments', () => {
  assert.equal(regexLiterals('var a = /ab+c/g;').length, 1)
  assert.equal(regexLiterals('var a = b / c;').length, 0)
  assert.equal(regexLiterals('var a = "/not a regex/";').length, 0)
  assert.equal(regexLiterals('// /comment/\nvar a = 1').length, 0)
  assert.equal(regexLiterals('return /x/.test(v)').length, 1)
  assert.equal(regexLiterals("var a = 'x'.replace(/y/g, 'z')").length, 1)
})
