import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { hostOf, parseCaddyfile } from '../server/vps/certDomains.ts'

// The TLS panel probes whatever this parser returns. A junk entry does not fail
// quietly — it renders as a red row that reads like a broken certificate when it
// only ever meant "that was not a domain".

describe('hostOf', () => {
  test('passes a plain hostname through, lowercased', () => {
    assert.equal(hostOf('  Example.COM '), 'example.com')
  })

  test('reduces a full address to its host', () => {
    assert.equal(hostOf('https://shop.example.com/api'), 'shop.example.com')
    assert.equal(hostOf('http://example.com'), 'example.com')
    assert.equal(hostOf('example.com:8443'), 'example.com')
  })

  test('rejects what cannot hold or answer for a public certificate', () => {
    for (const bad of [
      '',
      '   ',
      'localhost',        // no dot
      'some-web',        // container name
      '*.example.com',    // a cert subject, not a connectable host
      ':443',             // bare port address
      'two words.com',
      'exa_mple.com',     // underscore is not a legal hostname char
    ]) {
      assert.equal(hostOf(bad), null, `expected ${JSON.stringify(bad)} to be rejected`)
    }
  })
})

describe('parseCaddyfile', () => {
  // Server 1's layout: one fragment per project under sites/*.caddy.
  test('reads a site fragment, ignoring directives inside the block', () => {
    const text = `# === app === one project per fragment
app.example.com {
  encode gzip zstd
  reverse_proxy app-web:3000 {
    header_up X-Real-IP {remote_host}
  }
}
`
    assert.deepEqual(parseCaddyfile(text), ['app.example.com'])
  })

  // Server 2's layout: every block in one file, with a global options block.
  test('reads a single multi-site Caddyfile and skips the global options block', () => {
    const text = `# Shared edge reverse proxy: every site in one file.
{
  email hello@example.com
  servers {
    protocols h1 h2 h3
  }
}

one.example.com {
    reverse_proxy one-gateway:8080
}

two.example.com {
    encode zstd gzip
    @api path /api/*
    reverse_proxy @api two-api:4000
    reverse_proxy two-web:3000
}

three.example.com {
	reverse_proxy three-gateway:8790
}
`
    assert.deepEqual(parseCaddyfile(text), [
      'one.example.com',
      'two.example.com',
      'three.example.com',
    ])
  })

  test('splits a comma-separated address list', () => {
    assert.deepEqual(
      parseCaddyfile('api.example.com, api2.example.com {\n  respond "ok"\n}\n'),
      ['api.example.com', 'api2.example.com']
    )
  })

  test('ignores snippet definitions, imports and comments', () => {
    const text = `# a comment.example.com {
(logging) {
  log
}
import /etc/caddy/sites/*.caddy
real.example.com {
  respond "ok"
}
`
    assert.deepEqual(parseCaddyfile(text), ['real.example.com'])
  })

  // An indented address would be a directive, never a site — the leading
  // whitespace test is the only thing separating the two.
  test('never treats an indented line as a site address', () => {
    const text = `outer.example.com {
  handle {
    reverse_proxy inner.example.com:8080
  }
}
`
    assert.deepEqual(parseCaddyfile(text), ['outer.example.com'])
  })

  // A half-removed block leaves an unindented bare hostname with no `{`. That
  // is not a site any more, and probing it would report a certificate for
  // something this server has stopped serving.
  test('ignores an unindented hostname that does not open a block', () => {
    const text = `# leftover from a removed site
old.example.com
real.example.com {
  respond "ok"
}
`
    assert.deepEqual(parseCaddyfile(text), ['real.example.com'])
  })

  test('de-duplicates a host declared twice', () => {
    assert.deepEqual(
      parseCaddyfile('x.example.com {\n  respond "a"\n}\nx.example.com {\n  respond "b"\n}\n'),
      ['x.example.com']
    )
  })

  test('an empty or directive-only file yields nothing', () => {
    assert.deepEqual(parseCaddyfile(''), [])
    assert.deepEqual(parseCaddyfile('import /etc/caddy/sites/*.caddy\n'), [])
  })
})
