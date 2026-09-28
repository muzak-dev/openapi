// The snippet generators write text from a loaded OpenAPI document into source
// code a person then copies and runs. Whatever a document holds has to stay
// inside the literal it was written into. Run with `pnpm test`.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generators, LANGUAGES, type BuiltRequest } from '../app/utils/codegen.ts'

type Lexer = (code: string) => { outside: string, open: boolean }

/**
 * Returns what a language's compiler would read as code, with the contents of
 * every string literal taken out, and whether a literal was left open at the
 * end. A value that broke out of its literal shows up in the first, or leaves
 * the second true.
 */
function lexer(rules: { raw?: 'go' | 'rust', textBlock?: boolean, verbatim?: boolean, single?: boolean }): Lexer {
  return (code) => {
    let outside = ''
    let i = 0
    while (i < code.length) {
      const c = code[i]!
      if (rules.raw === 'go' && c === '`') {
        const end = code.indexOf('`', i + 1)
        if (end < 0) return { outside, open: true }
        i = end + 1
        continue
      }
      if (rules.raw === 'rust' && c === 'r' && /^r#*"/.test(code.slice(i, i + 40)) && !/[A-Za-z0-9_]/.test(code[i - 1] ?? ' ')) {
        const hashes = /^r(#*)"/.exec(code.slice(i))![1]!
        const end = code.indexOf(`"${hashes}`, i + 2 + hashes.length)
        if (end < 0) return { outside, open: true }
        i = end + 1 + hashes.length
        continue
      }
      if (rules.textBlock && code.startsWith('"""', i)) {
        i += 3
        for (;;) {
          if (i >= code.length) return { outside, open: true }
          if (code[i] === '\\') i += 2
          else if (code.startsWith('"""', i)) { i += 3; break }
          else i++
        }
        continue
      }
      if (rules.verbatim && c === '@' && code[i + 1] === '"') {
        i += 2
        for (;;) {
          if (i >= code.length) return { outside, open: true }
          if (code[i] === '"' && code[i + 1] === '"') i += 2
          else if (code[i] === '"') { i++; break }
          else i++
        }
        continue
      }
      const quote = rules.single ? '\'' : '"'
      if (c === quote) {
        i++
        for (;;) {
          // A PHP string may span lines. In the others a raw line break inside
          // a literal is an error, and the generators write it as \n.
          if (i >= code.length || (code[i] === '\n' && !rules.single)) return { outside, open: true }
          if (code[i] === '\\') i += 2
          else if (code[i] === quote) { i++; break }
          else i++
        }
        continue
      }
      outside += c
      i++
    }
    return { outside, open: false }
  }
}

const lexers: Record<string, Lexer> = {
  go: lexer({ raw: 'go' }),
  java: lexer({ textBlock: true }),
  csharp: lexer({ verbatim: true }),
  dotnet: lexer({ verbatim: true }),
  php: lexer({ single: true }),
  rust: lexer({ raw: 'rust' }),
}

// Text that ends a literal in some language, and then runs.
const payloads = [
  '"); os.Exit(1) //',
  '\'); system(\'id\'); //',
  '`; os.Exit(1); `',
  '"""); Runtime.exec("x"); //',
  '"#); std::process::exit(1); //',
  '"##); std::process::exit(1); //',
  '\\"); os.Exit(1); //',
  '\\\\"); os.Exit(1); //',
  '"; Process.Start("x"); //',
  '\n"); os.Exit(1); //',
  '\r\n\'); system(\'id\'); //',
  '  \ud800 \u0000 \b\f',
]

const hostile = (payload: string): BuiltRequest => ({
  method: 'POST',
  url: `https://api.example.com/x${payload}?q=${payload}`,
  headers: { [`X-${payload}`]: payload, 'Content-Type': `application/json${payload}` },
  body: JSON.stringify({ a: payload, [payload]: [payload, { nested: payload }] }, null, 2),
})

const markers = ['os.Exit', 'system(', 'Runtime.exec', 'process::exit', 'Process.Start']

for (const [language, lex] of Object.entries(lexers)) {
  test(`${language}: a hostile document stays inside its string literals`, () => {
    for (const payload of payloads) {
      const code = generators[language]!(hostile(payload))
      const { outside, open } = lex(code)
      assert.equal(open, false, `${language}: a literal is left open for ${JSON.stringify(payload)}\n${code}`)
      for (const marker of markers) {
        assert.ok(!outside.includes(marker), `${language}: ${marker} runs as code for ${JSON.stringify(payload)}\n${code}`)
      }
    }
  })
}

test('every language has a generator, and every generator survives a hostile request', () => {
  for (const { id } of LANGUAGES) {
    assert.equal(typeof generators[id], 'function', id)
    for (const payload of payloads) assert.doesNotThrow(() => generators[id]!(hostile(payload)), id)
  }
})

test('python, httpx and curl keep quoting their values', () => {
  const r: BuiltRequest = {
    method: 'POST',
    url: 'https://api.example.com/x',
    headers: { 'Content-Type': 'application/json"); os.Exit(1) //', 'X-A': '\'; system(\'id\'); //' },
    body: '{"a":"b"}',
  }
  assert.ok(generators.python!(r).includes('"Content-Type": "application/json\\"); os.Exit(1) //"'))
  assert.ok(generators.httpx!(r).includes('"Content-Type": "application/json\\"); os.Exit(1) //"'))
  assert.ok(generators.curl!(r).includes('-H \'X-A: \'\\\'\'; system(\'\\\'\'id\'\\\'\'); //\''))
})

const plain: BuiltRequest = {
  method: 'POST',
  url: 'https://api.example.com/users',
  headers: { 'Content-Type': 'application/json', 'X-Key': 'abc' },
  body: '{\n  "name": "Ada"\n}',
}

test('an ordinary request still reads as it did', () => {
  const go = generators.go!(plain)
  assert.ok(go.includes('payload := strings.NewReader(`{\n  "name": "Ada"\n}`)'), 'a Go body stays a raw string')
  assert.ok(go.includes('req, _ := http.NewRequest("POST", "https://api.example.com/users", payload)'))
  assert.ok(go.includes('req.Header.Set("Content-Type", "application/json")'))

  const rust = generators.rust!(plain)
  assert.ok(rust.includes('.body(r#"{"name": "Ada"}"#)'), 'a Rust body stays a raw string')
  assert.ok(rust.includes('.header("X-Key", "abc")'))

  const php = generators.php!(plain)
  assert.ok(php.includes('CURLOPT_URL => \'https://api.example.com/users\','))
  assert.ok(php.includes('\'X-Key: abc\','))

  const java = generators.java!(plain)
  assert.ok(java.includes('.uri(URI.create("https://api.example.com/users"))'))
  assert.ok(java.includes('.header("X-Key", "abc")'))
  assert.ok(java.includes('        {\n          "name": "Ada"\n        }\n        """))'), 'a Java body stays a text block')

  const csharp = generators.csharp!(plain)
  assert.ok(csharp.includes('new HttpRequestMessage(HttpMethod.Post, "https://api.example.com/users")'))
  assert.ok(csharp.includes('request.Headers.Add("X-Key", "abc");'))
})

test('a Go body a raw string cannot carry becomes a quoted one', () => {
  const go = generators.go!({ ...plain, body: '{"a":"`; os.Exit(1); `"}' })
  assert.ok(go.includes('strings.NewReader("{\\"a\\":\\"`; os.Exit(1); `\\"}")'), go)
})

test('a Rust raw string is delimited by more hashes than the body holds', () => {
  const rust = generators.rust!({ ...plain, body: '{"a":"\\"##x"}' })
  assert.ok(rust.includes('.body(r###"{"a":"\\"##x"}"###)'), rust)
})
