// components/wallet-connect.tsx
"use client";

import { useState } from "react";
import { useWallet } from "@/store/useWallet";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner"; // Assuming you have a toast library, or standard alert

export function ConnectWalletButton() {
    const {
        isConnected,
        address,
        walletType,
        connectFreighter,
        connectAlbedo,
        disconnect,
    } = useWallet();
    const [isOpen, setIsOpen] = useState(false);

    // Helper to shorten address (e.g., GASX...1234)
    const shortAddress = address
        ? `${address.slice(0, 4)}...${address.slice(-4)}`
        : "";

    const handleConnect = async (type: "freighter" | "albedo") => {
        try {
            if (type === "freighter") await connectFreighter();
            if (type === "albedo") await connectAlbedo();
            setIsOpen(false);
        } catch (error) {
            alert("Failed to connect wallet. Check console for details.");
        }
    };

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            // Optional: Toast notification here
        }
    };

    if (isConnected && address) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="font-mono gap-2">
                        <div
                            className={`h-2 w-2 rounded-full ${walletType === "freighter" ? "bg-purple-500" : "bg-orange-500"}`}
                        />
                        {shortAddress}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Address
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" asChild>
                        <a
                            href={`https://stellar.expert/explorer/testnet/account/${address}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View on Explorer
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={disconnect}
                        className="text-red-600 cursor-pointer"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Disconnect
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>Connect Wallet</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Connect your wallet</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Button
                        variant="outline"
                        className="h-16 justify-start px-6 gap-4 border-2 hover:border-primary/50"
                        onClick={() => handleConnect("freighter")}
                    >
                        <Wallet className="h-6 w-6 text-purple-600" />
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">Freighter</span>
                            <span className="text-xs text-muted-foreground">
                                Stellar's primary extension wallet
                            </span>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="h-16 justify-start px-6 gap-4 border-2 hover:border-primary/50"
                        onClick={() => handleConnect("albedo")}
                    >
                        <Wallet className="h-6 w-6 text-orange-600" />
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">Albedo</span>
                            <span className="text-xs text-muted-foreground">
                                Web-based wallet, no extension required
                            </span>
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
