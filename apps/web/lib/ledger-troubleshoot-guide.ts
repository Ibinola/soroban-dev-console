/**
 * Detect Ledger hardware wallet connection timeouts and provide a
 * step-by-step troubleshooting guide. (#902)
 */
export interface TroubleshootStep {
  order: number;
  instruction: string;
}

export function isLedgerTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ledger/i.test(message);
}

export function getLedgerTroubleshootingSteps(): TroubleshootStep[] {
  return [
    { order: 1, instruction: "Open the Stellar app on your Ledger device." },
    { order: 2, instruction: "Enable Blind Signing in the Stellar app settings." },
    { order: 3, instruction: "Check the USB cable and connection." },
    { order: 4, instruction: "Retry the connection." },
  ];
}
