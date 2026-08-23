// Minimal, dependency-free regex syntax highlighting for the code viewer —
// good enough for short request/response/snippet bodies, not a real lexer.

const escHtml = (str: unknown) => String(str).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

const CODE_RE = new RegExp([
  '(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
  '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)',
  '\\b(0x[\\da-fA-F]+|\\d+\\.?\\d*)\\b',
  '\\b(const|let|var|function|async|await|return|import|from|export|interface|type|if|else|new|class|def|print|public|private|static|void|string|int|package|func|use|fn|match|require|echo|puts|end|do|using|namespace|struct|nil|null|true|false|None|True|False|self|this|try|except|catch|throw|for|in|as|with|main|Response|String|var)\\b',
].join('|'), 'g')

function hiCode(code: string): string {
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  CODE_RE.lastIndex = 0
  while ((m = CODE_RE.exec(code)) !== null) {
    if (m.index < last) continue
    out += escHtml(code.slice(last, m.index))
    const cls = m[1] ? 'c-cmt' : m[2] ? 'c-str' : m[3] ? 'c-num' : 'c-kw'
    out += `<span class="${cls}">${escHtml(m[0])}</span>`
    last = m.index + m[0].length
  }
  return out + escHtml(code.slice(last))
}

const JSON_RE = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g

function hiJson(code: string): string {
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  JSON_RE.lastIndex = 0
  while ((m = JSON_RE.exec(code)) !== null) {
    out += escHtml(code.slice(last, m.index))
    if (m[1] && m[2]) out += `<span class="c-key">${escHtml(m[1])}</span><span class="c-pun">${escHtml(m[2])}</span>`
    else if (m[1]) out += `<span class="c-str">${escHtml(m[1])}</span>`
    else if (m[3]) out += `<span class="c-kw">${escHtml(m[3])}</span>`
    else out += `<span class="c-num">${escHtml(m[4])}</span>`
    last = m.index + m[0].length
  }
  return out + escHtml(code.slice(last))
}

export const hi = (code: unknown, lang?: string): string =>
  lang === 'json' ? hiJson(String(code ?? '')) : hiCode(String(code ?? ''))
