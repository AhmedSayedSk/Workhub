/**
 * Vault passkey hashing and verification utilities using Web Crypto API (SHA-256).
 */

export async function hashPasskey(passkey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(passkey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPasskey(input: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPasskey(input)
  return inputHash === storedHash
}
