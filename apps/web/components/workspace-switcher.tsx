"use client";

import { Briefcase, PlusCircle, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useContractStore } from "@/store/useContractStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import { toast } from "sonner";

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    createWorkspace,
    getActiveWorkspace,
    syncToCloud,
    syncState,
    cloudId,
  } = useWorkspaceStore();
  const { currentNetwork } = useNetworkStore();
  const { contracts } = useContractStore();
  const { savedCalls } = useSavedCallsStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (newName.trim()) {
      createWorkspace(newName, currentNetwork);
      setNewName("");
      setIsCreating(false);
    }
  };

  const handleSync = async () => {
    const ws = getActiveWorkspace();
    if (!ws) return;

    const contractRefs = contracts
      .filter((c) => ws.contractIds.includes(c.id))
      .map((c) => ({ contractId: c.id, network: c.network }));

    const interactionRefs = savedCalls
      .filter((c) => ws.savedCallIds.includes(c.id))
      .map((c) => ({
        functionName: c.fnName,
        argumentsJson: c.args,
      }));

    const shareId = await syncToCloud({
      name: ws.name,
      contracts: contractRefs,
      interactions: interactionRefs,
    });

    if (shareId) {
      toast.success("Workspace synced to cloud");
    } else {
      toast.error("Sync failed — check API connection");
    }
  };

  const syncIcon =
    syncState === "syncing" ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : cloudId ? (
      <Cloud className="h-3 w-3 text-blue-500" />
    ) : (
      <CloudOff className="h-3 w-3 text-muted-foreground" />
    );

  return (
    <div className="space-y-2 px-3 py-2">
      <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase text-muted-foreground">
        <span>Workspaces</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSync}
            disabled={syncState === "syncing"}
            title={cloudId ? "Synced to cloud" : "Sync to cloud"}
          >
            {syncIcon}
          </button>
          <button onClick={() => setIsCreating(!isCreating)}>
            <PlusCircle className="h-3 w-3 transition-colors hover:text-primary" />
          </button>
        </div>
      </div>

      {isCreating ? (
        <div className="flex gap-1">
          <Input
            size={1}
            className="h-7 text-xs"
            placeholder="Project name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
      ) : (
        <Select value={activeWorkspaceId} onValueChange={setActiveWorkspace}>
          <SelectTrigger className="h-8 border-none bg-muted/50 text-xs font-medium hover:bg-muted">
            <Briefcase className="mr-2 h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
