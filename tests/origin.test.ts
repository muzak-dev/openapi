// Where the dashboard reads its document from, and where Try It may send a
// request that carries a saved credential. Run with `pnpm test`.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSameOrigin, requestUrl, resolveSpecUrl, specResponseTrusted } from '../app/utils/origin.ts'

const page = 'https://api.example.com'
const fallback = '/openapi.json'

test('?spec= is honoured for the page\'s own origin only', () => {
  assert.equal(resolveSpecUrl('/v2/openapi.json', fallback, page), '/v2/openapi.json')
  assert.equal(resolveSpecUrl('https://api.example.com/x.json', fallback, page), 'https://api.example.com/x.json')
  for (const evil of [
    'https://attacker.example/x.json',
    '//attacker.example/x.json',
    '/\\attacker.example/x.json',
    '\\\\attacker.example\\x.json',
    'https://api.example.com@attacker.example/x.json',
    'https://api.example.com.attacker.example/x.json',
    'http://api.example.com/x.json',
    'javascript:alert(1)',
    'data:application/json,{}',
    'blob:https://api.example.com/1',
    'https://',
    '',
  ]) {
    assert.equal(resolveSpecUrl(evil, fallback, page), fallback, evil)
  }
  // Vue Router hands a repeated key over as an array, and a bare key as null.
  assert.equal(resolveSpecUrl(['https://attacker.example/x.json'], fallback, page), fallback)
  assert.equal(resolveSpecUrl(null, fallback, page), fallback)
  assert.equal(resolveSpecUrl(undefined, fallback, page), fallback)
})

test('a document that a same-origin URL redirected off the origin is not trusted', () => {
  // The address checked before the request says nothing about where a redirect
  // sends it. A same-origin path that redirects (an open redirect anywhere on
  // the host is enough) would otherwise load a document the attacker chose.
  assert.equal(specResponseTrusted({ redirected: false, url: 'https://api.example.com/openapi.json' }, page), true)
  assert.equal(specResponseTrusted({ redirected: true, url: 'https://api.example.com/openapi.json/' }, page), true)
  assert.equal(specResponseTrusted({ redirected: true, url: 'https://attacker.example/evil.json' }, page), false)
  assert.equal(specResponseTrusted({ redirected: true, url: 'http://api.example.com/openapi.json' }, page), false)
  assert.equal(specResponseTrusted({ redirected: true, url: '' }, page), false)
})

test('isSameOrigin refuses what does not parse', () => {
  assert.equal(isSameOrigin('http://[', page), false)
})

test('a request goes to the server it was built for, whatever the path holds', () => {
  const ok = requestUrl('https://api.example.com/v1/', '/users/42', page)
  assert.equal(ok?.toString(), 'https://api.example.com/v1/users/42')

  // Concatenated as it used to be, these paths change the host, and the saved
  // credential goes with them.
  assert.equal(new URL('https://api.example.com' + '@attacker.example/x').host, 'attacker.example')
  assert.equal(new URL('https://api.example.com' + '.attacker.example/x').host, 'api.example.com.attacker.example')
  for (const path of ['@attacker.example/x', '.attacker.example/x', ':8443/x', '\\\\attacker.example\\x', '//attacker.example/x', '/\\attacker.example/x']) {
    const got = requestUrl('https://api.example.com', path, page)
    assert.equal(got?.origin, 'https://api.example.com', path)
  }
})

test('a relative server is resolved against the page, and only http(s) is a server', () => {
  assert.equal(requestUrl('/v1', '/users', page)?.toString(), 'https://api.example.com/v1/users')
  for (const server of ['javascript:alert(1)//', 'data:text/plain,x', 'file:///etc/passwd', 'ftp://api.example.com', '', 'http://[']) {
    assert.equal(requestUrl(server, '/users', page), null, server)
  }
})
