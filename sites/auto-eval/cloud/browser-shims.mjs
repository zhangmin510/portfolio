import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// Keep the exact Node engine and dataset fingerprint in the browser build.
export function createHash(algorithm) {
  if (algorithm !== 'sha256') throw new Error('Unsupported digest');
  const hash = sha256.create();
  return {
    update(value) { hash.update(new TextEncoder().encode(value)); return this; },
    digest(encoding) { if (encoding !== 'hex') throw new Error('Unsupported encoding'); return bytesToHex(hash.digest()); },
  };
}
export const performance = globalThis.performance;
export const setImmediate = () => new Promise(resolve => setTimeout(resolve, 0));
