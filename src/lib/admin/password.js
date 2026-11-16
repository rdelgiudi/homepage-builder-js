/**
 * Admin password hashing (scrypt, Node's built-in crypto).
 *
 * Plain CommonJS on purpose: this one file is shared by the Next.js app
 * (src/lib/admin/auth.ts), the custom server (websocket-server.js) and the
 * hash generator (scripts/admin-hash.js), so the format can't drift between them.
 *
 * Stored format:  scrypt:<N>:<r>:<p>:<salt>:<hash>   (salt and hash base64url)
 * No "$" or "=" characters, so the value is safe to paste into .env and
 * docker-compose files without escaping.
 */
const crypto = require('crypto');

const N = 32768; // CPU/memory cost (2^15)
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const FORMAT = /^scrypt:(\d+):(\d+):(\d+):([A-Za-z0-9_-]{16,}):([A-Za-z0-9_-]{32,})$/;

/** @returns {Promise<Buffer>} */
function derive(password, salt, n, r, p, length) {
  return new Promise((resolve, reject) => {
    // scrypt needs 128 * N * r bytes; Node's default limit (32 MB) is just below that for N = 2^15.
    crypto.scrypt(password, salt, length, { N: n, r, p, maxmem: 256 * n * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * @param {string} password
 * @returns {Promise<string>} the value for ADMIN_PASSWORD_HASH
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

/**
 * @param {string | undefined} stored
 * @returns {boolean} whether `stored` looks like a value produced by hashPassword
 */
function isValidHash(stored) {
  const m = typeof stored === 'string' ? FORMAT.exec(stored.trim()) : null;
  if (!m) return false;
  const n = Number(m[1]);
  // N must be a power of two; cap the cost so a bogus value can't stall the server.
  return n >= 1024 && n <= 1048576 && (n & (n - 1)) === 0 && Number(m[2]) <= 32 && Number(m[3]) <= 16;
}

/**
 * @param {string} password candidate
 * @param {string} stored value of ADMIN_PASSWORD_HASH
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (!isValidHash(stored)) return false;
  const [, n, r, p, salt, hash] = FORMAT.exec(stored.trim());
  const expected = Buffer.from(hash, 'base64url');
  try {
    const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, isValidHash };
