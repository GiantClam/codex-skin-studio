const encoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null
  const bytes = new Uint8Array(32)
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

export function canonicalMetadata(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalMetadata).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalMetadata(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function sha256Hex(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)))
}

export function skillUploadMessage(pathname: string, timestamp: string, requestId: string, packageHash: string, metadataHash: string) {
  return ['POST', pathname, timestamp, requestId, packageHash, metadataHash].join('\n')
}

export async function verifySkillUploadSignature(secret: string, message: string, signature: string) {
  const signatureBytes = hexToBytes(signature)
  if (!signatureBytes) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, signatureBytes as unknown as BufferSource, encoder.encode(message))
}
