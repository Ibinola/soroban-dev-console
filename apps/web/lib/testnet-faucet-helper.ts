/**
 * Offer a Friendbot funding claim for newly connected, zero-balance
 * Testnet accounts. (#905)
 */
export function shouldOfferFaucetClaim(balanceXlm: number, network: "testnet" | "public"): boolean {
  return network === "testnet" && balanceXlm === 0;
}

export function buildFriendbotUrl(publicKey: string): string {
  return `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`;
}

export async function claimFriendbotFunds(publicKey: string): Promise<boolean> {
  const response = await fetch(buildFriendbotUrl(publicKey));
  return response.ok;
}

export const FAUCET_CLAIM_MESSAGE =
  "Your testnet account needs XLM to pay transaction fees. Claim 10,000 XLM now.";
