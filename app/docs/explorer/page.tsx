import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function AddingContractPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Adding a Contract</h1>
        <p className="text-lg text-muted-foreground">
          Load an existing Soroban smart contract by its Contract ID to explore its interface, invoke functions, view state, and monitor events.
        </p>
      </div>

      <div className="space-y-8">
        {/* Step 1 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            1. Open the Contract Explorer
          </h2>
          <p className="text-muted-foreground">
            In the main application navigation, click the <strong>Explorer</strong> tab (or the section where you can search for contracts).
          </p>
        </section>

        {/* Step 2 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            2. Enter the Contract ID
          </h2>
          <p className="text-muted-foreground">
            Paste the full 56-character Contract ID (starts with "C") into the input field.
          </p>

          <Alert className="mt-4 bg-muted/50">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Example: Hello World Contract (Testnet)</AlertTitle>
            <AlertDescription>
              Try this popular pre-deployed example contract:<br />
              <code className="break-all bg-muted px-2 py-1 rounded text-sm">
                CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN
              </code>
              <br />
              <span className="text-sm mt-2 block">
                After loading, you can invoke its <code>hello</code> function (e.g., pass {"{world}"} as a Symbol parameter).
              </span>
            </AlertDescription>
          </Alert>
        </section>

        {/* Step 3 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            3. Load the Contract
          </h2>
          <p className="text-muted-foreground">
            Click the <strong>Load Contract</strong> (or similar) button. The DevConsole will fetch the contract metadata, interface, and current state from the network.
          </p>
          <p className="text-muted-foreground">Once loaded, you’ll see:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Contract details and network info</li>
            <li>Auto-generated forms for all public functions</li>
            <li>Storage/state viewer</li>
            <li>Recent events and transaction history</li>
          </ul>
        </section>

        {/* Step 4 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            4. Next Steps
          </h2>
          <p className="text-muted-foreground">
            Start invoking functions using the generated forms. For advanced interaction patterns (simulation, auth, etc.), see the{" "}
            <Link href="/docs/interacting" className="text-primary hover:underline font-medium">
              Interacting
            </Link>{" "}
            guide.
          </p>
          <p className="text-muted-foreground">
            To deploy your own contracts instead of loading existing ones, see the{" "}
            <Link href="/docs/deploying" className="text-primary hover:underline font-medium">
              Deploying
            </Link>{" "}
            guide.
          </p>
        </section>

        {/* Troubleshooting */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            Troubleshooting
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Ensure your wallet is connected and set to <strong>Testnet</strong>.</li>
            <li>Double-check the Contract ID — it must match the current network.</li>
            <li>If the contract fails to load, it may not exist or may have been upgraded.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}