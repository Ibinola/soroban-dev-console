import { Injectable } from "@nestjs/common";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import {
  NormalizedTransactionResult,
  NormalizedSimulationPayload,
  NormalizedTransactionStatus,
} from "@devconsole/api-contracts";

@Injectable()
export class TransactionNormalizerService {
  /**
   * Normalize simulation transaction responses to a stable shape
   */
  normalizeSimulation(
    response: SorobanRpc.Api.SimulateTransactionResponse,
  ): NormalizedSimulationPayload {
    if (SorobanRpc.Api.isSimulationError(response)) {
      return {
        ok: false,
        error: response.error || "Unknown simulation error",
        auth: [],
        requiredAuthKeys: [],
        stateChangesCount: 0,
      };
    }

    const success = response as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    
    return {
      ok: true,
      resultXdr: success.result?.retval?.toXDR("base64"),
      minResourceFee: success.minResourceFee,
      auth: this.normalizeAuth(success),
      requiredAuthKeys: this.extractRequiredAuthKeys(success),
      stateChangesCount: success.stateChanges?.length ?? 0,
      cpuInsns: this.extractCpuInstructions(success),
      memBytes: this.extractMemoryBytes(success),
    };
  }

  /**
   * Normalize send transaction responses to a stable shape
   */
  normalizeSendTransaction(
    response: SorobanRpc.Api.SendTransactionResponse,
  ): NormalizedTransactionResult {
    return {
      status: this.mapSendTransactionStatus(response.status),
      hash: response.hash,
      error: response.error,
    };
  }

  /**
   * Normalize get transaction responses to a stable shape
   */
  normalizeGetTransaction(
    response: SorobanRpc.Api.GetTransactionResponse,
  ): NormalizedTransactionResult {
    const status = this.mapGetTransactionStatus(response.status);
    
    return {
      status,
      hash: response.hash,
      ledger: response.ledger,
      createdAt: response.createdAt?.toISOString(),
      resultXdr: response.resultXdr,
      resultMetaXdr: response.resultMetaXdr,
      error: status === "failed" ? this.extractTransactionError(response) : undefined,
    };
  }

  private normalizeAuth(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): Array<{ address: string; kind: "account" | "contract" | "unknown" }> {
    return (
      simulation.result?.auth?.flatMap((entry) => {
        try {
          const credentials = entry.credentials();
          if (credentials.switch().name !== "sorobanCredentialsAddress") {
            return [];
          }

          const authAddress = credentials.address().address();
          const kind =
            authAddress.switch().name === "scAddressTypeAccount"
              ? "account"
              : authAddress.switch().name === "scAddressTypeContract"
                ? "contract"
                : "unknown";

          return [
            {
              address: authAddress.toString(),
              kind,
            },
          ];
        } catch {
          return [];
        }
      }) ?? []
    );
  }

  private extractRequiredAuthKeys(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): string[] {
    return this.normalizeAuth(simulation)
      .filter((entry) => entry.kind === "account")
      .map((entry) => entry.address);
  }

  private extractCpuInstructions(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): number | undefined {
    const maybePayload = simulation as any;
    const maybeCost = maybePayload["cost"] as
      | {
          cpuInsns?: string | number;
          cpuInstructions?: string | number;
          cpu_insns?: string | number;
        }
      | undefined;

    const cpuInsns = Number(
      maybeCost?.cpuInsns ?? maybeCost?.cpuInstructions ?? maybeCost?.cpu_insns,
    );

    return Number.isFinite(cpuInsns) ? cpuInsns : undefined;
  }

  private extractMemoryBytes(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): number | undefined {
    const maybePayload = simulation as any;
    const maybeCost = maybePayload["cost"] as
      | {
          memBytes?: string | number;
          mem_bytes?: string | number;
        }
      | undefined;

    const memBytes = Number(maybeCost?.memBytes ?? maybeCost?.mem_bytes);

    return Number.isFinite(memBytes) ? memBytes : undefined;
  }

  private mapSendTransactionStatus(
    status: SorobanRpc.Api.SendTransactionStatus,
  ): NormalizedTransactionStatus {
    switch (status) {
      case "PENDING":
        return "pending";
      case "ERROR":
        return "failed";
      default:
        return "failed";
    }
  }

  private mapGetTransactionStatus(
    status: SorobanRpc.Api.GetTransactionStatus,
  ): NormalizedTransactionStatus {
    switch (status) {
      case "SUCCESS":
        return "success";
      case "FAILED":
        return "failed";
      case "NOT_FOUND":
      case "PENDING":
        return "pending";
      default:
        return "failed";
    }
  }

  private extractTransactionError(
    response: SorobanRpc.Api.GetTransactionResponse,
  ): string | undefined {
    if (response.resultXdr) {
      try {
        const result = SorobanRpc.xdr.TransactionResult.fromXDR(response.resultXdr, "base64");
        if (result.result().switch().name === "txFailed") {
          return "Transaction execution failed";
        }
      } catch {
        // Fall through to generic error
      }
    }
    return "Transaction failed";
  }
}
