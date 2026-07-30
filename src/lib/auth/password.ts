// New accounts always hash with argon2id via Bun's built-in `Bun.password` (no external KDF
// dependency needed). `passwordAlgo` on `User` distinguishes this from `legacy-sha1` rows a
// future MSSQL import would create — see prisma/schema.prisma's comment on that field and
// docs/migrations/07-risks-and-open-questions.md ("Password hash migration"). There is no
// legacy-sha1 verification path implemented yet since no legacy accounts have been
// imported into this schema — add one (SHA-1(password + salt), see the legacy-research
// notes this schema is based on) alongside the ETL import work, not before it's needed.
const ARGON2ID = 'argon2id';

export async function hashPassword(password: string): Promise<{ hash: string; algo: string }> {
  const hash = await Bun.password.hash(password, { algorithm: ARGON2ID });
  return { hash, algo: ARGON2ID };
}

export async function verifyPassword(password: string, hash: string, algo: string | null): Promise<boolean> {
  if (algo !== ARGON2ID) {
    throw new Error(`Unsupported password algorithm: ${algo ?? '(none)'}`);
  }
  return Bun.password.verify(password, hash);
}
