import { test, expect } from '@playwright/test';

/**
 * Wallet connect flow coverage. A mock Freighter API is injected via
 * page.addInitScript so these tests never depend on a real browser extension.
 */

const MOCK_ADDRESS = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD';

async function injectMockFreighter(page: import('@playwright/test').Page, network = 'TESTNET') {
  await page.addInitScript(
    ({ address, net }) => {
      // Minimal Freighter API surface used by the app.
      (window as unknown as Record<string, unknown>).freighterApi = {
        isConnected: async () => true,
        getAddress: async () => ({ address }),
        getNetwork: async () => ({ network: net }),
        getNetworkDetails: async () => ({ network: net }),
        signTransaction: async (xdr: string) => ({ signedTxXdr: xdr }),
      };
    },
    { address: MOCK_ADDRESS, net: network },
  );
}

test.describe('Wallet connect & signing', () => {
  test('wallet connect entry point is visible on load', async ({ page }) => {
    await injectMockFreighter(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /connect/i }).first()).toBeVisible();
  });

  test('opening the connect modal shows provider options', async ({ page }) => {
    await injectMockFreighter(page);
    await page.goto('/');

    await page.getByRole('button', { name: /connect/i }).first().click();
    await expect(page.getByText(/freighter/i).first()).toBeVisible();
  });

  test('mock wallet reports the injected network', async ({ page }) => {
    await injectMockFreighter(page, 'TESTNET');
    await page.goto('/');

    const network = await page.evaluate(async () => {
      const api = (window as unknown as Record<string, any>).freighterApi;
      return (await api.getNetwork()).network;
    });
    expect(network).toBe('TESTNET');
  });
});
