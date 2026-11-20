# Operations runbooks

## RPC failover operations guide
1. **Detect**: alert on RPC health check failures or elevated proxy error/timeout rates.
2. **Confirm**: query the primary RPC `getHealth` and compare `getLatestLedger` against a secondary provider.
3. **Fail over**: switch the configured RPC URL to the secondary and restart or reload the API.
4. **Verify**: run a read call (`getLatestLedger`) and a simulation through the console.
5. **Fail back**: once the primary is healthy and caught up for 15 minutes, restore the original URL.
6. **Record** the incident and the ledger gap, if any.

## Audit integrity verification runbook
1. Export the audit log for the period under review.
2. Recompute the hash chain from the first entry: each entry hash must equal the hash of its content plus the previous entry hash.
3. Any mismatch marks the earliest tampered or missing entry; stop and escalate.
4. Compare the final hash with the last value stored out-of-band.
5. Document the result with date, reviewer and range checked.

## Backup restore preflight checklist
- [ ] Backup file identified; checksum matches the recorded value.
- [ ] Backup timestamp meets the required recovery point.
- [ ] Target database is empty or snapshotted first.
- [ ] Schema/migration version of the backup is compatible with the running API.
- [ ] Enough free disk space for the restore.
- [ ] Writes paused and stakeholders notified.
- [ ] Rollback plan agreed if verification fails.
