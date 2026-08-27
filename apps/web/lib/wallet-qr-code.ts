/**
 * Build a QR code image URL for a connected wallet's public key, for
 * mobile funding flows. (#901)
 */
const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;

export function isValidPublicKey(publicKey: string): boolean {
  return STELLAR_PUBLIC_KEY_PATTERN.test(publicKey);
}

export function buildWalletQrCodeUrl(publicKey: string, sizePx = 256): string {
  if (!isValidPublicKey(publicKey)) {
    throw new Error("Invalid Stellar public key");
  }
  const encoded = encodeURIComponent(publicKey);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encoded}`;
}

export function truncatePublicKey(publicKey: string): string {
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}
