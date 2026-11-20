# Release rollback, local wallet setup, and contract storage inspection

## Release rollback runbook
1. **Decide**: roll back when the release causes errors above the agreed threshold or breaks a core flow.
2. **Freeze** further deploys.
3. **Redeploy** the previous release image/tag for web and API.
4. **Database**: if the release ran a migration, check it is backward compatible; otherwise apply the down migration or restore from backup (see the backup restore checklist).
5. **Verify**: health checks pass, a contract invocation works end to end.
6. **Communicate** status, then open a follow-up for the root cause.

## Local wallet setup and troubleshooting
1. Install a supported Stellar wallet browser extension and create or import a **test** account.
2. Switch the wallet to Testnet and fund the account with Friendbot.
3. In the console, select the matching network profile and connect the wallet.

Troubleshooting:
- *Wallet not detected*: reload the page, confirm the extension is enabled for the site.
- *Network mismatch*: set wallet and profile to the same network.
- *Signing request never appears*: unlock the wallet and check for a pending popup.
- *Insufficient balance*: refund via Friendbot (testnet only).

## Contract storage inspection guide
1. Open the contract in the console and choose the storage browser.
2. Pick the storage type: `instance`, `persistent` or `temporary`.
3. Enter or select the key; keys are decoded from XDR `ScVal`.
4. Check the entry's TTL; entries near expiry should be extended.
5. Compare values before and after a transaction using the transaction state diff.
