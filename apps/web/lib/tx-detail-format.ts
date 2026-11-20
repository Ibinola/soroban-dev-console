export function formatUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function formatRelativeTimestamp(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Math.max(0, nowMs - t);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} sec${sec === 1 ? "" : "s"} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export function getLedgerExplorerUrl(network: string, ledger: number): string {
  const base =
    network === "mainnet"
      ? "https://stellar.expert/explorer/public/ledger"
      : `https://stellar.expert/explorer/${network}/ledger`;
  return `${base}/${ledger}`;
}
