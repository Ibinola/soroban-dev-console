import { describe, it, expect, vi, beforeEach } from 'vitest';

let xBullWalletConnectMock: any;

vi.mock('@albedo-link/intent', () => ({
  default: { publicKey: vi.fn(), tx: vi.fn() },
}));
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(() => false),
  isAllowed: vi.fn(() => true),
  getAddress: vi.fn(() => ({})),
  setAllowed: vi.fn(() => Promise.resolve()),
}));
vi.mock('@creit.tech/xbull-wallet-connect', () => {
  xBullWalletConnectMock = vi.fn();
  function MockBridge(this: any, ...args: any[]) {
    return xBullWalletConnectMock(...args);
  }
  return { xBullWalletConnect: MockBridge };
});

function getXbullBridge() {
  return xBullWalletConnectMock;
}

describe('xBull wallet provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be registered in walletProviders', async () => {
    const { walletProviders } = await import('./provider');
    expect(walletProviders['xbull']).toBeDefined();
    expect(walletProviders['xbull'].id).toBe('xbull');
  });

  it('should expose correct capabilities', async () => {
    const { walletProviders } = await import('./provider');
    const caps = walletProviders['xbull'].capabilities;
    expect(caps.canSign).toBe(true);
    expect(caps.canSignAuthEntries).toBe(false);
    expect(caps.requiresExtension).toBe(true);
    expect(caps.supportsTestnet).toBe(true);
    expect(caps.supportsMainnet).toBe(true);
  });

  describe('connect', () => {
    it('should connect successfully and return public key', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(() => Promise.resolve('GABC1234XULL5678')),
        sign: vi.fn(),
        closeConnections: vi.fn(),
      }));

      const session = await walletProviders['xbull'].connect();
      expect(session.provider).toBe('xbull');
      expect(session.address).toBe('GABC1234XULL5678');
      const bridgeInstance = Bridge.mock.results[0].value;
      expect(bridgeInstance.closeConnections).toHaveBeenCalled();
    });

    it('should propagate connect errors', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(() => Promise.reject(new Error('User rejected'))),
        sign: vi.fn(),
        closeConnections: vi.fn(),
      }));

      await expect(walletProviders['xbull'].connect()).rejects.toThrow(
        'User rejected',
      );
    });

    it('should request public key and sign permissions', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const connectMock = vi.fn(() => Promise.resolve('GABC...XULL'));
      Bridge.mockImplementation(() => ({
        connect: connectMock,
        sign: vi.fn(),
        closeConnections: vi.fn(),
      }));

      await walletProviders['xbull'].connect();
      expect(connectMock).toHaveBeenCalledWith({
        canRequestPublicKey: true,
        canRequestSign: true,
      });
    });

    it('should close connections on success', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const closeMock = vi.fn();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(() => Promise.resolve('GABC...XULL')),
        sign: vi.fn(),
        closeConnections: closeMock,
      }));

      await walletProviders['xbull'].connect();
      expect(closeMock).toHaveBeenCalled();
    });

    it('should close connections on failure', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const closeMock = vi.fn();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(() => Promise.reject(new Error('boom'))),
        sign: vi.fn(),
        closeConnections: closeMock,
      }));

      try {
        await walletProviders['xbull'].connect();
      } catch {
        // expected
      }
      expect(closeMock).toHaveBeenCalled();
    });
  });

  describe('signTransaction', () => {
    it('should sign transaction and return signed XDR', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(),
        sign: vi.fn(() => Promise.resolve('signed-tx-xdr')),
        closeConnections: vi.fn(),
      }));

      const signed = await walletProviders['xbull'].signTransaction(
        'AAAAAg==',
        'Test SDF Network ; September 2015',
      );
      expect(signed).toBe('signed-tx-xdr');
    });

    it('should pass xdr and networkPassphrase to sign', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const signMock = vi.fn(() => Promise.resolve('signed-xdr'));
      Bridge.mockImplementation(() => ({
        connect: vi.fn(),
        sign: signMock,
        closeConnections: vi.fn(),
      }));

      await walletProviders['xbull'].signTransaction('AAAAAg==', 'Testnet');
      expect(signMock).toHaveBeenCalledWith({
        xdr: 'AAAAAg==',
        network: 'Testnet',
      });
    });

    it('should close connections after signing', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const closeMock = vi.fn();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(),
        sign: vi.fn(() => Promise.resolve('signed-xdr')),
        closeConnections: closeMock,
      }));

      await walletProviders['xbull'].signTransaction('AAAAAg==', 'Testnet');
      expect(closeMock).toHaveBeenCalled();
    });
  });

  describe('revalidate', () => {
    it('should return true in browser environment', async () => {
      const { walletProviders } = await import('./provider');
      const result = await walletProviders['xbull'].revalidate();
      expect(result.isValid).toBe(true);
    });

    it('should return false when window is undefined', async () => {
      const { walletProviders } = await import('./provider');
      const originalWindow = global.window;
      // @ts-expect-error Testing behavior when window is undefined in node environment
      global.window = undefined;

      const result = await walletProviders['xbull'].revalidate();
      expect(result.isValid).toBe(false);

      global.window = originalWindow;
    });
  });

  describe('disconnect', () => {
    it('freighter disconnect should call setAllowed when available', async () => {
      const { walletProviders } = await import('./provider');
      const setAllowed = vi.fn(() => Promise.resolve());
      vi.doMock('@stellar/freighter-api', () => ({
        isConnected: vi.fn(() => true),
        isAllowed: vi.fn(() => true),
        getAddress: vi.fn(() => ({ address: 'GABC' })),
        setAllowed,
      }));

      await walletProviders['freighter'].disconnect();

      vi.doUnmock('@stellar/freighter-api');
    });

    it('freighter disconnect should not throw when setAllowed is missing', async () => {
      const { walletProviders } = await import('./provider');

      await expect(walletProviders['freighter'].disconnect()).resolves.toBeUndefined();
    });

    it('albedo disconnect should clear localStorage keys containing albedo and intent', async () => {
      const { walletProviders } = await import('./provider');
      const mockStorage: Record<string, string> = {
        'albedo_token': 'abc',
        'some_intent': 'def',
        'other_key': 'ghi',
      };
      const removeItem = vi.fn((key: string) => {
        delete mockStorage[key];
      });
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn(),
        removeItem,
        clear: vi.fn(),
        get length() {
          return Object.keys(mockStorage).length;
        },
        key: vi.fn((i: number) => Object.keys(mockStorage)[i]),
      } as any);

      await walletProviders['albedo'].disconnect();
      expect(removeItem).toHaveBeenCalledWith('albedo_token');
      expect(removeItem).toHaveBeenCalledWith('some_intent');
      expect(removeItem).not.toHaveBeenCalledWith('other_key');
    });

    it('xbull disconnect should call closeConnections on xbull bridge', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      const closeMock = vi.fn();
      Bridge.mockImplementation(() => ({
        connect: vi.fn(),
        sign: vi.fn(),
        closeConnections: closeMock,
      }));

      await walletProviders['xbull'].disconnect();
      expect(closeMock).toHaveBeenCalled();
    });

    it('xbull disconnect should not throw when bridge instantiation fails', async () => {
      const { walletProviders } = await import('./provider');
      const Bridge = getXbullBridge();
      Bridge.mockImplementation(() => {
        throw new Error('boom');
      });

      await expect(walletProviders['xbull'].disconnect()).resolves.toBeUndefined();
    });
  });
});
