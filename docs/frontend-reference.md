# Frontend error codes and environment profile configuration

## Frontend error code reference
> Codes below are the documented convention; confirm against the error constants in the web app when reviewing.

| Code | Meaning | Suggested action |
|---|---|---|
| `NETWORK_MISMATCH` | Wallet network differs from selected profile | Switch wallet or profile |
| `WALLET_REJECTED` | User rejected the signature request | Retry and approve |
| `WALLET_TIMEOUT` | Signing request timed out | Retry |
| `RPC_UNAVAILABLE` | RPC request failed or timed out | Check RPC URL or failover |
| `SIMULATION_FAILED` | Pre-flight simulation returned an error | Review arguments and contract state |
| `INVALID_ARGUMENT` | Argument failed validation | Fix the highlighted field |
| `WORKSPACE_NOT_FOUND` | Workspace missing or deleted | Reload or restore from export |

## Environment profile configuration reference
A profile defines one network target.

| Field | Description |
|---|---|
| `name` | Display name |
| `rpcUrl` | Soroban RPC endpoint |
| `horizonUrl` | Horizon endpoint (optional) |
| `networkPassphrase` | Must match the target network exactly |
| `friendbotUrl` | Optional faucet, testnet/futurenet only |

The wallet network must match `networkPassphrase` before signing.
