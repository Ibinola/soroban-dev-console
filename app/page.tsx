import { ConnectWalletButton } from "@/components/wallet-connect";
import { Button } from "@/components/ui/button";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            <div className="space-y-4 text-center">
                <h1 className="text-4xl font-bold">Soroban DevConsole</h1>
                <p className="text-muted-foreground">
                    Build, test, and monitor Soroban smart contracts without the CLI.
                </p>
                <div className="flex gap-2 justify-center">
                    <ConnectWalletButton />
                    <Button variant="secondary">View Docs</Button>
                </div>
            </div>
        </main>
    );
}