/**
 * Wallet connection status indicators and auto-reconnect manager for Freighter.
 */

export type WalletConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface WalletStatus {
  state: WalletConnectionState;
  publicKey: string | null;
  network: string | null;
  lastConnectedAt?: number;
}

export class WalletConnectionHelper {
  private status: WalletStatus = {
    state: 'DISCONNECTED',
    publicKey: null,
    network: null,
  };

  public getStatus(): WalletStatus {
    return { ...this.status };
  }

  public setStatus(newStatus: Partial<WalletStatus>): WalletStatus {
    this.status = { ...this.status, ...newStatus };
    return this.getStatus();
  }

  public async autoReconnect(providerCheck: () => Promise<boolean>): Promise<boolean> {
    this.status.state = 'RECONNECTING';
    try {
      const isAvailable = await providerCheck();
      if (isAvailable) {
        this.status.state = 'CONNECTED';
        return true;
      }
    } catch {
      this.status.state = 'ERROR';
    }
    this.status.state = 'DISCONNECTED';
    return false;
  }
}
