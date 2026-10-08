// base64 helpers (no Buffer / atob dependency, so they work in Hermes)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64[i]] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean[i]];
    const b = B64_LOOKUP[clean[i + 1]];
    const c = i + 2 < clean.length ? B64_LOOKUP[clean[i + 2]] : 0;
    const d = i + 3 < clean.length ? B64_LOOKUP[clean[i + 3]] : 0;
    if (o < outLen) out[o++] = (a << 2) | (b >> 4);
    if (o < outLen) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < outLen) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const CHUNK = 3 * 16384;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    let s = '';
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i < end) {
      const rem = end - i;
      const n = (bytes[i] << 16) | ((rem > 1 ? bytes[i + 1] : 0) << 8);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (rem > 1 ? B64[(n >> 6) & 63] : '=') + '=';
    }
    parts.push(s);
  }
  return parts.join('');
}

