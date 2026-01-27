// app/contracts/page.tsx
"use client";

import { useState } from "react";
import { useContractStore } from "@/store/useContractStore";
import { Trash2, Plus, Search, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";


export default function ContractsPage() {
  const { contracts, addContract, removeContract } = useContractStore();
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState("");

  // Basic validation for Stellar Contract IDs (starts with C, 56 chars)
  const handleAdd = () => {
    const id = inputVal.trim();

    if (!id.startsWith("C") || id.length !== 56) {
      toast.error('Invalid Contract ID. Must start with "C" and be 56 characters.');
      setError(
        'Invalid Contract ID. Must start with "C" and be 56 characters.',
      );
      return;
    }

    addContract(id, "testnet"); // Defaulting to testnet for now
    setInputVal("");
    setError("");
    toast.success("Contract added successfully!");
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Contract Explorer
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and interact with your Soroban smart contracts.
          </p>
        </div>
      </div>

      {/* Add Contract Card */}
      <Card>
        <CardHeader>
          <CardTitle>Track New Contract</CardTitle>
          <CardDescription>
            Paste a Contract ID to add it to your watchlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="C..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setError("");
                }}
                className={error ? "border-red-500" : ""}
              />
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Contract
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">Contract ID</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No contracts added yet. Add one above to get started.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-mono text-sm font-medium flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-blue-500" />
                    {contract.id}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      {contract.network}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(contract.addedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        removeContract(contract.id);
                        toast.success("Contract removed");
                      }}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
