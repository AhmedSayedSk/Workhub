// Caddyfile hostname parsing for the TLS panel.
//
// Split out of certs.ts so it can be unit-tested: certs.ts touches the
// filesystem and opens TLS sockets, this file is pure string work. Kept as a
// LEAF module — no local runtime imports — which is what `node --test` needs.

/**
 * Hostname portion of a Caddyfile site address: strips any scheme, port and
 * path, so `https://shop.example.com/api` and `example.com:8443` both
 * reduce to their host. Returns null for anything that cannot be probed.
 */
export function hostOf(address: string): string | null {
  let a = address.trim().replace(/^https?:\/\//, '')
  a = a.split('/')[0]
  // Strip a :port suffix, but never mangle a bare ":80"-style address.
  const colon = a.lastIndexOf(':')
  if (colon > 0) a = a.slice(0, colon)
  if (!a || !a.includes('.')) return null
  // Wildcards cannot be probed - there is no host to connect to.
  if (a.includes('*')) return null
  if (!/^[a-z0-9.-]+$/i.test(a)) return null
  return a.toLowerCase()
}

/**
 * Hostnames declared by one Caddyfile's text.
 *
 * A site block opens with its addresses at column 0, comma-separated, ending
 * in `{`:  `api.example.com, api2.example.com {`. Indented lines are
 * directives inside a block and must not be treated as addresses, which is why
 * the leading-whitespace test matters.
 *
 * This handles both layouts in use: server 1 splits sites across
 * `sites/*.caddy` fragments, server 2 keeps every block in one `Caddyfile`
 * alongside a global options block (`{` on its own line) and `import`
 * directives — neither of which declares a site.
 */
export function parseCaddyfile(text: string): string[] {
  const hosts = new Set<string>()
  for (const raw of text.split('\n')) {
    if (/^\s/.test(raw)) continue // inside a block
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.endsWith('{')) continue
    const addresses = line.slice(0, -1).trim()
    // `{` alone opens the global options block; `(name) {` defines a snippet.
    if (!addresses || addresses.includes('(')) continue
    for (const part of addresses.split(',')) {
      const host = hostOf(part)
      if (host) hosts.add(host)
    }
  }
  return [...hosts]
}
