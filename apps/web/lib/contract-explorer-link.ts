/** Issue #1094: link target for the "Open in Explorer" action on the deploy success card. */
export function buildContractExplorerHref(contractId: string): string {
  return `/contracts/${contractId}`;
}

/** Issue #1094: copy handler for the success card's contract ID widget. */
export async function copyContractId(contractId: string): Promise<void> {
  await navigator.clipboard.writeText(contractId);
}
