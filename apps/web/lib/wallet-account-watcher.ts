/**
 * Poll the connected wallet for account switches and notify a callback. (#904)
 */
export type AddressGetter = () => Promise<string | null>;
export type AccountChangeHandler = (newAddress: string | null) => void;

export function watchAccountChange(
  getCurrentAddress: AddressGetter,
  onChange: AccountChangeHandler,
  intervalMs = 2000,
): () => void {
  let lastAddress: string | null = null;

  const timer = setInterval(async () => {
    const current = await getCurrentAddress();
    if (current !== lastAddress) {
      lastAddress = current;
      onChange(current);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
