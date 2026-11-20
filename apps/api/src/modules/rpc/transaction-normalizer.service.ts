import { Injectable } from "@nestjs/common";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import {
  NormalizedTransactionResult,
  NormalizedSimulationPayload,
} from "@devconsole/api-contracts";

@Injectable()
export class TransactionNormalizerService {
  private toBase64Xdr(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (
      value &&
      typeof value === "object" &&
      "toXDR" in value &&
      typeof value.toXDR === "function"
    ) {
      return value.toXDR("base64");
    }
    return undefined;
  }

  /**
   * Normalize simulation transaction responses to a stable shape
   */
  normalizeSimulation(
    response: SorobanRpc.Api.SimulateTransactionResponse,
  ): NormalizedSimulationPayload {
    if (SorobanRpc.Api.isSimulationError(response)) {
      return {
        auth: [],
      };
    }

    const success = response as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    
    return {
      resultXdr: success.result?.retval?.toXDR("base64"),
      minResourceFee: success.minResourceFee ? String(success.minResourceFee) : undefined,
      auth: this.normalizeAuth(success),
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
    const hash = "hash" in response ? response.hash : undefined;

    return {
      status: this.mapSendTransactionStatus(response.status),
      hash,
      errorMessage:
        response.status === "ERROR"
          ? "Transaction submission failed"
          : undefined,
    };
  }

  /**
   * Normalize get transaction responses to a stable shape
   */
  normalizeGetTransaction(
    response: SorobanRpc.Api.GetTransactionResponse,
  ): NormalizedTransactionResult {
    const status = this.mapGetTransactionStatus(response.status);

    const normalized: NormalizedTransactionResult = {
      status,
      errorMessage: status === "error" ? this.extractTransactionError(response) : undefined,
    };

    if ("hash" in response && typeof response.hash === "string") {
      normalized.hash = response.hash;
    }
    if ("ledger" in response && typeof response.ledger === "number") {
      normalized.ledger = response.ledger;
    }
    if ("resultXdr" in response) {
      normalized.resultXdr = this.toBase64Xdr(response.resultXdr);
    }
    if ("resultMetaXdr" in response) {
      normalized.resultXdr = this.toBase64Xdr(response.resultMetaXdr);
    }

    return normalized;
  }

  private normalizeAuth(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): Array<{ address: string; kind: "account" | "contract" }> {
    return (
      simulation.result?.auth?.flatMap((entry) => {
        try {
          const credentials = entry.credentials();
          if (credentials.switch().name !== "sorobanCredentialsAddress") {
            return [];
          }

          const authAddress = credentials.address().address();
          const kind: "account" | "contract" =
            authAddress.switch().name === "scAddressTypeContract"
              ? "contract"
              : "account";

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

  private extractCpuInstructions(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): string | undefined {
    const maybePayload = simulation as any;
    const maybeCost = maybePayload["cost"] as
      | {
          cpuInsns?: string | number;
          cpuInstructions?: string | number;
          cpu_insns?: string | number;
        }
      | undefined;

    const cpuInsns = maybeCost?.cpuInsns ?? maybeCost?.cpuInstructions ?? maybeCost?.cpu_insns;

    return cpuInsns !== undefined ? String(cpuInsns) : undefined;
  }

  private extractMemoryBytes(
    simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse,
  ): string | undefined {
    const maybePayload = simulation as any;
    const maybeCost = maybePayload["cost"] as
      | {
          memBytes?: string | number;
          mem_bytes?: string | number;
        }
      | undefined;

    const memBytes = maybeCost?.memBytes ?? maybeCost?.mem_bytes;

    return memBytes !== undefined ? String(memBytes) : undefined;
  }

  private mapSendTransactionStatus(
    status: SorobanRpc.Api.SendTransactionStatus,
  ): "success" | "error" | "pending" {
    switch (status) {
      case "PENDING":
        return "pending";
      case "ERROR":
        return "error";
      default:
        return "error";
    }
  }

  private mapGetTransactionStatus(
    status: SorobanRpc.Api.GetTransactionStatus,
  ): "success" | "error" | "pending" {
    const rawStatus = String(status);
    if (rawStatus === "SUCCESS") return "success";
    if (rawStatus === "FAILED") return "error";
    return "pending";
  }

  private extractTransactionError(
    _response: SorobanRpc.Api.GetTransactionResponse,
  ): string | undefined {
    return "Transaction failed";
  }
}
