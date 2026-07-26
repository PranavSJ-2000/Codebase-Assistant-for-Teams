// Deterministic id for a (repo, file, chunk index) triple, used as the
// FAISS row id and the Chunk document's vectorId. Deterministic on purpose:
// re-processing the same job (a BullMQ retry, or re-ingesting the same repo)
// overwrites the same vector/row instead of accumulating duplicates.
export function computeVectorId(repoId: string, filePath: string, chunkIndex: number): number {
  const key = `${repoId}:${filePath}:${chunkIndex}`;

  // FNV-1a 64-bit, done in BigInt so the multiply/xor steps don't lose
  // precision the way plain JS numbers would.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask64 = 0xffffffffffffffffn;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= BigInt(key.charCodeAt(i));
    hash = (hash * prime) & mask64;
  }

  // Fold down to 52 bits so the id survives as a plain JS number / JSON
  // number without precision loss (Number.MAX_SAFE_INTEGER is 2^53 - 1).
  const folded = hash & 0xfffffffffffffn;
  return Number(folded);
}
