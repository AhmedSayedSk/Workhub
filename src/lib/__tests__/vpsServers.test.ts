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
  // only ever an environment lookup.
  test('no address is hard-coded — unset env means empty', () => {
    for (const s of SERVERS) {
      for (const ip of s.ips) {
        assert.ok(
          process.env.VPS_PUBLIC_IP?.includes(ip) || process.env.VPS2_PUBLIC_IP?.includes(ip),
          `${s.id} exposes ${ip} which came from neither env var`
        )
      }
    }
  })
})
