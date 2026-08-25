import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseIps, isIpAddress, SERVERS } from '../server/vps/servers.ts'

// The addresses shown on the server cards come from the environment, so the
// parser is the only thing standing between a typo'd .env and an ops dashboard
// asserting the wrong IP. These are all fake documentation-range addresses.

describe('parseIps', () => {
  test('unset or blank yields no addresses', () => {
    assert.deepEqual(parseIps(undefined), [])
    assert.deepEqual(parseIps(''), [])
    assert.deepEqual(parseIps('   '), [])
  })

  test('accepts a single IPv4', () => {
    assert.deepEqual(parseIps('203.0.113.7'), ['203.0.113.7'])
  })

  test('splits on commas, whitespace, or both', () => {
    const expected = ['203.0.113.7', '198.51.100.9']
    assert.deepEqual(parseIps('203.0.113.7,198.51.100.9'), expected)
    assert.deepEqual(parseIps('203.0.113.7, 198.51.100.9'), expected)
    assert.deepEqual(parseIps('203.0.113.7 198.51.100.9'), expected)
    assert.deepEqual(parseIps('  203.0.113.7 ,  198.51.100.9  '), expected)
  })

  test('keeps IPv6 alongside IPv4, in the order written', () => {
    assert.deepEqual(parseIps('2001:db8::1, 203.0.113.7'), ['2001:db8::1', '203.0.113.7'])
  })

  test('removes duplicates', () => {
    assert.deepEqual(parseIps('203.0.113.7, 203.0.113.7'), ['203.0.113.7'])
  })

  // The point of validating at all: a malformed address rendered as fact is
  // worse than a blank, because someone would "fix" a DNS record to match it.
  test('drops malformed entries and keeps the valid ones', () => {
    assert.deepEqual(parseIps('999.1.1.1'), [])
    assert.deepEqual(parseIps('203.0.113'), [])
    assert.deepEqual(parseIps('not-an-ip'), [])
    assert.deepEqual(parseIps('example.com'), [])
    assert.deepEqual(parseIps('203.0.113.7.8'), [])
    assert.deepEqual(parseIps('999.1.1.1, 203.0.113.7'), ['203.0.113.7'])
  })

  test('rejects an IPv4 with an out-of-range octet', () => {
    assert.equal(isIpAddress('256.0.0.1'), false)
    assert.equal(isIpAddress('255.255.255.255'), true)
  })

  test('does not accept a bare hex word as IPv6 — a colon is required', () => {
    assert.equal(isIpAddress('deadbeef'), false)
    assert.equal(isIpAddress('::1'), true)
  })
})

describe('SERVERS registry', () => {
  test('every server exposes an ips array', () => {
    assert.ok(SERVERS.length > 0)
    for (const s of SERVERS) {
      assert.ok(Array.isArray(s.ips), `${s.id} has no ips array`)
    }
  })

  // The repo is public: an address must never be a literal in the registry,
  // only ever an environment lookup. Checked against EVERY VPS*_PUBLIC_IP in
  // the environment rather than a fixed pair, so adding a server does not
  // quietly opt it out of this guard.
  test('no address is hard-coded — unset env means empty', () => {
    const configured = Object.entries(process.env)
      .filter(([k]) => /^VPS\d*_PUBLIC_IP$/.test(k))
      .map(([, v]) => v || '')
      .join(' ')
    for (const s of SERVERS) {
      for (const ip of s.ips) {
        assert.ok(
          configured.includes(ip),
          `${s.id} exposes ${ip}, which came from no VPS*_PUBLIC_IP env var`
        )
      }
    }
  })

  test('server ids are unique', () => {
    const ids = SERVERS.map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`)
  })

  // A retired box's snapshots stay keyed by its serverId, so reusing that id
  // silently grafts the dead server's history onto the new card's charts.
  test('retired server ids are never reused', () => {
    const retired = ['secondary', 'tertiary']
    for (const id of SERVERS.map((s) => s.id)) {
      assert.ok(!retired.includes(id), `${id} was retired — pick a fresh id, not a recycled one`)
    }
  })

  // 'local' is collected in-process; only 'remote' entries are accepted by the
  // agent ingest route, which rejects any serverId that is not in this list.
  test('exactly one server is the local host', () => {
    assert.equal(SERVERS.filter((s) => s.mode === 'local').length, 1)
    for (const s of SERVERS) {
      assert.ok(['local', 'remote'].includes(s.mode), `${s.id} has an invalid mode`)
    }
  })
})
