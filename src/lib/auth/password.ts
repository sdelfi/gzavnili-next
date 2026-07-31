import { argon2id, argon2Verify } from 'hash-wasm';

// argon2id, via `hash-wasm` — a pure-WebAssembly implementation with no native bindings and
// no runtime-specific globals.
//
// This used to call `Bun.password`. That was a real bug, not just a portability preference:
// `next dev`/`next start` execute route handlers under **Node**, even when the server is
// launched with `bun`, so `Bun` is simply not defined there. Every login attempt 500'd with
// `ReferenceError: Bun is not defined` — bema auth did not work at all outside a Bun-native
// server. Anything reached from a route handler has to hold up under Node.
//
// Why WASM rather than a native addon (`@node-rs/argon2`, `argon2`): a `.node` binary has to
// be marked external to the bundler, has to exist prebuilt for every platform this deploys
// to, and breaks the same way `Bun.password` did the moment the runtime changes underneath
// it. `hash-wasm` ships the WASM inlined as base64 inside plain JS, so bundlers treat it as
// ordinary code and it behaves identically under Node, Bun and the edge runtime.
//
// `passwordAlgo` on `User` distinguishes these from the `legacy-sha1` rows a future MSSQL
// import would create — see prisma/schema.prisma's comment on that field and
// docs/migrations/07-risks-and-open-questions.md ("Password hash migration"). There is no
// legacy-sha1 verification path implemented yet since no legacy accounts have been imported
// into this schema — add one (SHA-1(password + salt), see the legacy-research notes this
// schema is based on) alongside the ETL import work, not before it's needed.
const ARGON2ID = 'argon2id';

// Deliberately the same cost as `Bun.password`'s argon2id defaults, which is what every
// existing hash in the database was created with: m=65536 KiB, t=2, p=1, 32-byte output.
// Keeping them identical means this swap is invisible — hashes written before it and after
// it are indistinguishable, and no re-hash-on-login migration is needed. (They also sit
// above OWASP's argon2id floor of 19 MiB / t=2 / p=1.)
const MEMORY_SIZE_KIB = 65536;
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<{ hash: string; algo: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await argon2id({
    password,
    salt,
    memorySize: MEMORY_SIZE_KIB,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    hashLength: HASH_LENGTH,
    // PHC string (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`) — self-describing, so `verify`
    // reads the parameters back out of the stored value rather than assuming the constants
    // above. Existing hashes keep verifying if these are ever raised.
    outputType: 'encoded',
  });
  return { hash, algo: ARGON2ID };
}

export async function verifyPassword(password: string, hash: string, algo: string | null): Promise<boolean> {
  if (algo !== ARGON2ID) {
    throw new Error(`Unsupported password algorithm: ${algo ?? '(none)'}`);
  }
  return argon2Verify({ password, hash });
}
