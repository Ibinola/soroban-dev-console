interface RawTransaction {
  id: string;
  hash?: string;
  txHash?: string;
  amount?: number | string;
  fee?: number | string;
  status?: string;
  state?: string;
}

interface NormalizedTransaction {
  id: string;
  hash: string;
  amount: number;
  fee: number;
  status: string;
}

export function normalizeTransaction(raw: RawTransaction): NormalizedTransaction {
  return {
    id: raw.id,
    hash: raw.hash ?? raw.txHash ?? "",
    amount: Number(raw.amount ?? 0),
    fee: Number(raw.fee ?? 0),
    status: raw.status ?? raw.state ?? "unknown",
  };
}

export function validateFixtures(fixtures: RawTransaction[]): void {
  let passed = 0;
  for (const f of fixtures) {
    const n = normalizeTransaction(f);
    const valid = n.id !== "" && !isNaN(n.amount) && !isNaN(n.fee);
    console.log(`  [${valid ? "OK  " : "FAIL"}] ${f.id} → hash=${n.hash || "(empty)"} status=${n.status}`);
    if (valid) passed++;
  }
  console.log(`Validation: ${passed}/${fixtures.length} passed.`);
  if (passed < fixtures.length) process.exit(1);
}
