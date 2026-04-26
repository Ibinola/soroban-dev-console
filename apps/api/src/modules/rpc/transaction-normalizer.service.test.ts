import { Test, TestingModule } from "@nestjs/testing";
import { TransactionNormalizerService } from "./transaction-normalizer.service";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";

describe("TransactionNormalizerService", () => {
  let service: TransactionNormalizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionNormalizerService],
    }).compile();

    service = module.get<TransactionNormalizerService>(TransactionNormalizerService);
  });

  describe("normalizeSimulation", () => {
    it("should normalize successful simulation", () => {
      const mockSuccess: SorobanRpc.Api.SimulateTransactionSuccessResponse = {
        id: 1,
        jsonrpc: "2.0",
        result: {
          retval: { _attributes: { type: "void" } },
          auth: [],
        },
        minResourceFee: "1000",
        stateChanges: [],
        transactionData: {
          build: () => ({
            resources: () => ({
              instructions: () => BigInt(1000),
              diskReadBytes: () => BigInt(500),
              writeBytes: () => BigInt(200),
            }),
          }),
        },
      };

      const result = service.normalizeSimulation(mockSuccess);

      expect(result).toEqual({
        ok: true,
        resultXdr: undefined,
        minResourceFee: "1000",
        auth: [],
        requiredAuthKeys: [],
        stateChangesCount: 0,
        cpuInsns: 1000,
        memBytes: 700,
      });
    });

    it("should normalize failed simulation", () => {
      const mockError: SorobanRpc.Api.SimulateTransactionErrorResponse = {
        id: 1,
        jsonrpc: "2.0",
        error: "Simulation failed",
      };

      const result = service.normalizeSimulation(mockError);

      expect(result).toEqual({
        ok: false,
        error: "Simulation failed",
        auth: [],
        requiredAuthKeys: [],
        stateChangesCount: 0,
      });
    });
  });

  describe("normalizeSendTransaction", () => {
    it("should normalize pending send transaction", () => {
      const mockPending: SorobanRpc.Api.SendTransactionResponse = {
        id: 1,
        jsonrpc: "2.0",
        status: "PENDING",
        hash: "test-hash",
      };

      const result = service.normalizeSendTransaction(mockPending);

      expect(result).toEqual({
        status: "pending",
        hash: "test-hash",
      });
    });

    it("should normalize error send transaction", () => {
      const mockError: SorobanRpc.Api.SendTransactionResponse = {
        id: 1,
        jsonrpc: "2.0",
        status: "ERROR",
        error: "Transaction failed",
        hash: "test-hash",
      };

      const result = service.normalizeSendTransaction(mockError);

      expect(result).toEqual({
        status: "failed",
        hash: "test-hash",
        error: "Transaction failed",
      });
    });
  });

  describe("normalizeGetTransaction", () => {
    it("should normalize successful get transaction", () => {
      const mockSuccess: SorobanRpc.Api.GetTransactionResponse = {
        id: 1,
        jsonrpc: "2.0",
        status: "SUCCESS",
        hash: "test-hash",
        ledger: 12345,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        resultMetaXdr: "meta-xdr",
      };

      const result = service.normalizeGetTransaction(mockSuccess);

      expect(result).toEqual({
        status: "success",
        hash: "test-hash",
        ledger: 12345,
        createdAt: "2023-01-01T00:00:00.000Z",
        resultMetaXdr: "meta-xdr",
      });
    });

    it("should normalize failed get transaction", () => {
      const mockFailed: SorobanRpc.Api.GetTransactionResponse = {
        id: 1,
        jsonrpc: "2.0",
        status: "FAILED",
        hash: "test-hash",
        ledger: 12345,
        resultXdr: "result-xdr",
      };

      const result = service.normalizeGetTransaction(mockFailed);

      expect(result).toEqual({
        status: "failed",
        hash: "test-hash",
        ledger: 12345,
        resultXdr: "result-xdr",
        error: "Transaction failed",
      });
    });

    it("should normalize pending get transaction", () => {
      const mockPending: SorobanRpc.Api.GetTransactionResponse = {
        id: 1,
        jsonrpc: "2.0",
        status: "PENDING",
        hash: "test-hash",
      };

      const result = service.normalizeGetTransaction(mockPending);

      expect(result).toEqual({
        status: "pending",
        hash: "test-hash",
      });
    });
  });
});
