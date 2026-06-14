/**
 * Whether the sikagit (Repos stage) integration is available.
 *
 * The sikagit data is a LOCAL SQLite DB read via better-sqlite3, so it only
 * exists on the dev machine — never in a cloud/production deploy. WorkHub also
 * shares one Firestore backend across local+prod, so this gate cannot be a
 * stored setting; it must come from the build environment.
 *
 * Default: enabled in development, disabled in production. Force-enable in a
 * prod build (only if sikagit is actually reachable there) with
 * NEXT_PUBLIC_SIKAGIT_ENABLED=true.
 *
 * Both NODE_ENV and NEXT_PUBLIC_* are statically inlined by Next at build time,
 * so this const works in client and server components and tree-shakes cleanly.
 */
export const SIKAGIT_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SIKAGIT_ENABLED === 'true'
