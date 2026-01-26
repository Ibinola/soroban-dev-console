import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function GettingStartedPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-lg text-muted-foreground">
          Set up your environment to start building with Soroban DevConsole.
        </p>
      </div>

      <div className="space-y-8">
        {/* Step 1 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            1. Install a Wallet
          </h2>
          <p className="text-muted-foreground">
            To interact with the Stellar network, you need a browser wallet. We
            recommend
            <strong> Freighter</strong>, the official wallet for Soroban.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>
              <a
                href="https://www.freighter.app/"
                target="_blank"
                className="text-primary hover:underline font-medium"
              >
                Download Freighter Extension
              </a>
            </li>
            <li>Follow the installation steps to create a new wallet.</li>
            <li>
              <strong>Important:</strong> Enable "Experimental Mode" in
              Freighter settings if using Futurenet.
            </li>
          </ul>
        </section>

        {/* Step 2 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            2. Connect to DevConsole
          </h2>
          <p className="text-muted-foreground">
            Once installed, click the <strong>Connect Wallet</strong> button in
            the top right corner of this app. Approve the connection request in
            the Freighter popup.
          </p>
        </section>

        {/* Step 3 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            3. Fund your Account
          </h2>
          <p className="text-muted-foreground">
            On the Testnet, you need free "Test XLM" to pay for gas fees.
          </p>

          <Alert className="mt-4 bg-muted/50">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Pro Tip</AlertTitle>
            <AlertDescription>
              Use the <strong>"Get Testnet XLM"</strong> button on the Dashboard
              to fund your account instantly via Friendbot.
            </AlertDescription>
          </Alert>
        </section>

        {/* Step 4 */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            4. Your First Contract Call
          </h2>
          <p className="text-muted-foreground">
            Navigate to the <strong>Contract Explorer</strong>, paste a Contract
            ID, and start testing!
          </p>
        </section>
      </div>
    </div>
  );
}