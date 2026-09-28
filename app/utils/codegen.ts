// Per-language request snippet generators. Pure functions over a built
// {method, url, headers, body} request — no knowledge of the OpenAPI doc.

export interface BuiltRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

export interface CodeLanguage {
  id: string
  label: string
  icon: string
}

export const LANGUAGES: CodeLanguage[] = [
  { id: 'curl', label: 'cURL', icon: 'material-icon-theme:http' },
  { id: 'python', label: 'Python', icon: 'material-icon-theme:python' },
  { id: 'httpx', label: 'Python (Async)', icon: 'material-icon-theme:python' },
  { id: 'go', label: 'Go', icon: 'material-icon-theme:go' },
  { id: 'csharp', label: 'C#', icon: 'material-icon-theme:csharp' },
  { id: 'dotnet', label: '.NET', icon: 'material-icon-theme:csharp' },
  { id: 'java', label: 'Java', icon: 'material-icon-theme:java' },
  { id: 'php', label: 'PHP', icon: 'material-icon-theme:php' },
  { id: 'rust', label: 'Rust', icon: 'material-icon-theme:rust' },
]

const pyDict = (obj: Record<string, string>, indent: number) => {
  const pad = ' '.repeat(indent)
  const entries = Object.entries(obj).map(([k, v]) => `${pad}    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  return `{\n${entries.join('\n')}\n${pad}}`
}

const jsObj = (obj: Record<string, string>, indent: number) => {
  const pad = ' '.repeat(indent)
  const entries = Object.entries(obj).map(([k, v]) => `${pad}  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  return `{\n${entries.join('\n')}\n${pad}}`
}

const reindent = (text: string, spaces: number) =>
  String(text).split('\n').map((l, i) => (i === 0 ? l : ' '.repeat(spaces) + l)).join('\n')

// Every value below — url, method, header names/values, body — comes from the
// loaded OpenAPI document or a live response, none of which this app wrote.
// Interpolating it into a snippet raw is never safe: every value that lands in
// a string literal goes through the quoting helper for that language's own
// literal syntax. Most
// double-quoted languages take JSON.stringify's escaping as it is (\, ",
// control characters); Go and Rust differ in a few escapes and have their own
// wrappers below. A single-quoted target (the shell, PHP, Ruby) needs its own
// helper, because JSON's escaping never touches the one character — a bare
// "'" — those contexts actually break on.

/** A double-quoted string literal for JS/TS/Go/C#/Java/Rust — languages whose escaping for \, " and control characters matches JSON's. */
const strLit = (s: string) => JSON.stringify(s)

/** A single-quoted, shell-safe token for a POSIX sh/bash command line (what a curl snippet is pasted into). */
const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** A single-quoted string literal for PHP/Ruby, which only treat \ and ' as special inside one. */
const singleQuote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

/**
 * JSON.stringify's escapes, matched one at a time so that an escaped backslash
 * followed by a "u" is never mistaken for the start of a \uXXXX escape.
 */
const JSON_ESCAPE = /\\(?:u([0-9a-fA-F]{4})|([\s\S]))/g
const isSurrogate = (hex: string) => /^d[89a-f]/i.test(hex)

/**
 * A double-quoted Go string literal. JSON's escapes are Go's, except that Go
 * refuses a \u escape for a lone surrogate (which JSON.stringify writes out
 * for one), so that one is replaced with the replacement character.
 */
const goLit = (s: string) => strLit(s).replace(JSON_ESCAPE, (m, hex) => (hex && isSurrogate(hex) ? '\\ufffd' : m))

/**
 * A double-quoted Rust string literal. Rust has no \b, \f or \uXXXX: it spells
 * a code point \u{X}, so those three are rewritten, and a lone surrogate, which
 * Rust cannot represent, becomes the replacement character.
 */
const rustLit = (s: string) => strLit(s).replace(JSON_ESCAPE, (m, hex, other) => {
  if (hex) return `\\u{${isSurrogate(hex) ? 'fffd' : hex}}`
  if (other === 'b') return '\\u{8}'
  if (other === 'f') return '\\u{c}'
  return m
})

/** A Rust raw string, delimited by enough # that nothing inside it can end it early. */
const rustRaw = (s: string) => {
  let hashes = ''
  while (s.includes(`"${hashes}`)) hashes += '#'
  return `r${hashes}"${s}"${hashes}`
}

/**
 * A Go value for a request body: a raw string, which keeps the JSON readable,
 * unless the text holds something a raw string cannot carry (a backtick ends
 * it, and a carriage return, a NUL or a byte order mark is dropped or refused).
 */
const goBody = (s: string) => (/[`\r\u0000﻿]/.test(s) ? goLit(s) : `\`${s}\``)

/**
 * The body of a Java text block. Text blocks take escapes like any string, so a
 * backslash is doubled, and three quotes in a row would close it, so the third
 * is escaped.
 */
const javaTextBlock = (s: string) => s.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"')

/** A C# verbatim string literal, where the only escape is a doubled quote. */
const csVerbatim = (s: string) => `@"${s.replace(/"/g, '""')}"`

/** A C# HttpMethod for a verb, by its named member when it is a plain word and by constructor otherwise. */
const csMethod = (m: string) =>
  /^[A-Za-z]+$/.test(m) ? `HttpMethod.${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()}` : `new HttpMethod(${strLit(m)})`

type Generator = (r: BuiltRequest) => string

export const generators: Record<string, Generator> = {
  curl(r) {
    const lines = [`curl -X ${shQuote(r.method)} ${shQuote(r.url)}`]
    for (const [k, v] of Object.entries(r.headers)) lines.push(`  -H ${shQuote(`${k}: ${v}`)}`)
    if (r.body) lines.push(`  -d ${shQuote(r.body.replace(/\n\s*/g, ' '))}`)
    return lines.join(' \\\n')
  },
  python(r) {
    const out = ['import requests', '', `url = ${strLit(r.url)}`, `headers = ${pyDict(r.headers, 0)}`]
    if (r.body) out.push(`payload = ${reindent(r.body.replace(/: true/g, ': True').replace(/: false/g, ': False').replace(/: null/g, ': None'), 0)}`)
    out.push('', `response = requests.${r.method.toLowerCase()}(${r.body ? '\n    url,\n    headers=headers,\n    json=payload,\n' : '\n    url,\n    headers=headers,\n'})`, '',
      'response.raise_for_status()', 'print(response.json())')
    return out.join('\n')
  },
  httpx(r) {
    // async — httpx's sync client is fine for a script, but AsyncClient is
    // the idiomatic choice once this is called from inside an application.
    const out = [
      'import asyncio', 'import httpx', '', '',
      'async def main() -> None:',
      '    async with httpx.AsyncClient() as client:',
      `        response = await client.${r.method.toLowerCase()}(`,
      `            ${strLit(r.url)},`,
      `            headers=${pyDict(r.headers, 12)},`,
    ]
    if (r.body) out.push(`            json=${reindent(r.body.replace(/: true/g, ': True').replace(/: false/g, ': False').replace(/: null/g, ': None'), 12)},`)
    out.push(
      '        )', '',
      '        print(response.status_code)', '        print(response.json())', '', '',
      'asyncio.run(main())',
    )
    return out.join('\n')
  },
  go(r) {
    const out = ['package main', '', 'import (', '\t"fmt"', '\t"io"', '\t"net/http"']
    if (r.body) out.push('\t"strings"')
    out.push(')', '', 'func main() {')
    if (r.body) out.push(`\tpayload := strings.NewReader(${goBody(r.body)})`, '')
    out.push(`\treq, _ := http.NewRequest(${goLit(r.method)}, ${goLit(r.url)}, ${r.body ? 'payload' : 'nil'})`, '')
    for (const [k, v] of Object.entries(r.headers)) out.push(`\treq.Header.Set(${goLit(k)}, ${goLit(v)})`)
    out.push('', '\tresp, err := http.DefaultClient.Do(req)', '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tdefer resp.Body.Close()', '',
      '\tbody, _ := io.ReadAll(resp.Body)', '\tfmt.Println(resp.StatusCode, string(body))', '}')
    return out.join('\n')
  },
  csharp(r) {
    const out = ['using System.Net.Http;', 'using System.Net.Http.Headers;', 'using System.Text;', '', 'var client = new HttpClient();',
      `var request = new HttpRequestMessage(${csMethod(r.method)}, ${strLit(r.url)});`, '']
    for (const [k, v] of Object.entries(r.headers)) {
      if (k.toLowerCase() === 'content-type') continue
      out.push(`request.Headers.Add(${strLit(k)}, ${strLit(v)});`)
    }
    if (r.body) out.push('', 'request.Content = new StringContent(', `    ${csVerbatim(r.body)},`, '    Encoding.UTF8,', '    "application/json");')
    out.push('', 'var response = await client.SendAsync(request);', 'var body = await response.Content.ReadAsStringAsync();', 'Console.WriteLine(body);')
    return out.join('\n')
  },
  dotnet(r) {
    let origin = r.url
    let pathAndQuery = r.url
    try {
      const u = new URL(r.url)
      origin = `${u.protocol}//${u.host}/`
      pathAndQuery = u.pathname.replace(/^\//, '') + u.search
    } catch { /* leave as-is */ }
    const out = ['using System.Text;', '', 'var client = new HttpClient', '{', `    BaseAddress = new Uri(${strLit(origin)})`, '};', '']
    for (const [k, v] of Object.entries(r.headers)) {
      if (k.toLowerCase() === 'content-type') continue
      out.push(`client.DefaultRequestHeaders.Add(${strLit(k)}, ${strLit(v)});`)
    }
    out.push('')
    // The body is text handed to the request as it is. It used to be written
    // out as if it were a C# expression, which a JSON document is not.
    if (r.body) out.push(`var payload = ${csVerbatim(r.body)};`, `var response = await client.PostAsync(${strLit(pathAndQuery)}, new StringContent(payload, Encoding.UTF8, "application/json"));`)
    else out.push(`var response = await client.GetAsync(${strLit(pathAndQuery)});`)
    out.push('', 'response.EnsureSuccessStatusCode();', 'Console.WriteLine(await response.Content.ReadAsStringAsync());')
    return out.join('\n')
  },
  java(r) {
    const out = ['import java.net.URI;', 'import java.net.http.*;', '', 'HttpClient client = HttpClient.newHttpClient();', '',
      'HttpRequest request = HttpRequest.newBuilder()', `    .uri(URI.create(${strLit(r.url)}))`]
    for (const [k, v] of Object.entries(r.headers)) out.push(`    .header(${strLit(k)}, ${strLit(v)})`)
    out.push(r.body
      ? `    .method(${strLit(r.method)}, HttpRequest.BodyPublishers.ofString("""\n${javaTextBlock(r.body).split('\n').map(l => `        ${l}`).join('\n')}\n        """))`
      : `    .method(${strLit(r.method)}, HttpRequest.BodyPublishers.noBody())`)
    out.push('    .build();', '', 'HttpResponse<String> response = client.send(', '    request, HttpResponse.BodyHandlers.ofString());', '',
      'System.out.println(response.statusCode());', 'System.out.println(response.body());')
    return out.join('\n')
  },
  php(r) {
    const headers = Object.entries(r.headers).map(([k, v]) => `    ${singleQuote(`${k}: ${v}`)},`).join('\n')
    const out = ['<?php', '', '$ch = curl_init();', '', 'curl_setopt_array($ch, [',
      `    CURLOPT_URL => ${singleQuote(r.url)},`, '    CURLOPT_RETURNTRANSFER => true,',
      `    CURLOPT_CUSTOMREQUEST => ${singleQuote(r.method)},`, '    CURLOPT_HTTPHEADER => [', headers.replace(/^ {4}/gm, '        '), '    ],']
    if (r.body) out.push(`    CURLOPT_POSTFIELDS => ${singleQuote(r.body.replace(/\n\s*/g, ''))},`)
    out.push(']);', '', '$response = curl_exec($ch);', 'curl_close($ch);', '', 'echo $response;')
    return out.join('\n')
  },
  rust(r) {
    const out = ['use reqwest::blocking::Client;', '', 'fn main() -> Result<(), Box<dyn std::error::Error>> {',
      '    let client = Client::new();', '', '    let response = client', `        .${r.method.toLowerCase()}(${rustLit(r.url)})`]
    for (const [k, v] of Object.entries(r.headers)) out.push(`        .header(${rustLit(k)}, ${rustLit(v)})`)
    if (r.body) out.push(`        .body(${rustRaw(r.body.replace(/\n\s*/g, ''))})`)
    out.push('        .send()?;', '', '    println!("{}", response.status());', '    println!("{}", response.text()?);', '', '    Ok(())', '}')
    return out.join('\n')
  },
}
