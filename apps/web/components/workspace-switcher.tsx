"use client";

import {
  Briefcase,
  PlusCircle,
  Cloud,
  CloudOff,
  Loader2,
  LayoutTemplate,
  MoreVertical,
  Copy,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@devconsole/ui";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useContractStore } from "@/store/useContractStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import { useWorkspaceActivityStore } from "@/store/useWorkspaceActivityStore";
import { WORKSPACE_TEMPLATES } from "@/lib/fixture-manifest";
import { toast } from "sonner";

// ── FE-030: Recent workspace tracking ────────────────────────────────────────

const RECENT_WS_KEY = "soroban-recent-workspaces";
const MAX_RECENT_WS = 3;

function loadRecentWorkspaceIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_WS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function pushRecentWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  const ids = loadRecentWorkspaceIds().filter((x) => x !== id);
  ids.unshift(id);
  localStorage.setItem(RECENT_WS_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_WS)));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    createWorkspace,
    createWorkspaceFromTemplate,
    getActiveWorkspace,
    syncToCloud,
    syncState,
    cloudId,
    duplicateWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
  } = useWorkspaceStore();

  const { currentNetwork } = useNetworkStore();
  const { contracts } = useContractStore();
  const { savedCalls } = useSavedCallsStore();
  const { record } = useWorkspaceActivityStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateNameInput, setDuplicateNameInput] = useState("");

  const activeWorkspaces = workspaces.filter((w) => !w.archived);
  const archivedWorkspaces = workspaces.filter((w) => Boolean(w.archived));

  // FE-030: Recent workspaces (only active ones)
  const recentIds = loadRecentWorkspaceIds();
  const recentWorkspaces = recentIds
    .map((id) => activeWorkspaces.find((w) => w.id === id))
    .filter(Boolean) as typeof activeWorkspaces;

  const handleCreate = () => {
    if (newName.trim()) {
      createWorkspace(newName, currentNetwork);
      const created = useWorkspaceStore.getState().workspaces.at(-1);
      if (created) record(created.id, "workspace_created", `Workspace "${newName}" created`);
      setNewName("");
      setIsCreating(false);
    }
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspace(id);
    pushRecentWorkspaceId(id);
  };

  const handleCreateFromTemplate = (templateKey: string) => {
    const template = WORKSPACE_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) return;
    createWorkspaceFromTemplate(template, currentNetwork);
    setShowTemplates(false);
    toast.success(`Workspace created from template: ${template.name}`);
  };

  const handleDuplicate = (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    setDuplicatingId(id);
    setDuplicateNameInput(`Copy of ${ws.name}`);
  };

  const confirmDuplicate = () => {
    if (!duplicatingId) return;
    const cloned = duplicateWorkspace(duplicatingId, duplicateNameInput);
    if (cloned) {
      toast.success(`Workspace "${cloned.name}" duplicated`, {
        action: {
          label: "Switch",
          onClick: () => handleSelectWorkspace(cloned.id),
        },
      });
    }
    setDuplicatingId(null);
    setDuplicateNameInput("");
  };

  const handleArchive = (id: string) => {
    archiveWorkspace(id);
    toast.success("Workspace archived");
  };

  const handleUnarchive = (id: string) => {
    unarchiveWorkspace(id);
    toast.success("Workspace restored");
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
      record(ws.id, "workspace_synced", `Workspace "${ws.name}" synced to cloud`, shareId);
      toast.success("Workspace synced to cloud");
    } else {
      toast.error("Sync failed — check API connection");
    }
  };

  const syncIcon =
    syncState === "syncing" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : cloudId ? (
      <Cloud className="h-4 w-4" />
    ) : (
      <CloudOff className="h-4 w-4" />
    );

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-medium">
          <Briefcase className="h-4 w-4" /> Workspaces
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleSync} title="Sync to cloud">
            {syncIcon}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTemplates(!showTemplates)}
            title="Create from template"
          >
            <LayoutTemplate className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreating(!isCreating)}
            title="New workspace"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showTemplates && (
        <div className="rounded-md border bg-muted/40 p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Starter templates</p>
          {WORKSPACE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => handleCreateFromTemplate(t.key)}
              className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
            </button>
          ))}
        </div>
      )}

      {duplicatingId && (
        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
          <p className="text-xs font-medium text-muted-foreground">Duplicate Workspace</p>
          <Input
            autoFocus
            value={duplicateNameInput}
            onChange={(e) => setDuplicateNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmDuplicate()}
            className="h-8 text-sm"
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDuplicatingId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmDuplicate}>
              Duplicate
            </Button>
          </div>
        </div>
      )}

      {isCreating ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            placeholder="Workspace name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreate}>
            Add
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {recentWorkspaces.length > 0 && (
            <>
              <p className="px-1 text-xs text-muted-foreground">Recent</p>
              {recentWorkspaces.map((w) => (
                <div
                  key={`recent-${w.id}`}
                  className={`group flex items-center justify-between rounded px-2 py-1 text-sm ${
                    activeWorkspaceId === w.id
                      ? "bg-accent font-medium"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <button
                    onClick={() => handleSelectWorkspace(w.id)}
                    className="flex flex-1 items-center gap-2 text-left truncate min-w-0"
                  >
                    <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{w.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {w.selectedNetwork}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicate(w.id)}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleArchive(w.id)}>
                        <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <div className="my-1 border-t" />
            </>
          )}

          {activeWorkspaces.map((w) => (
            <div
              key={w.id}
              className={`group flex items-center justify-between rounded px-2 py-1 text-sm ${
                activeWorkspaceId === w.id
                  ? "bg-accent font-medium"
                  : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => handleSelectWorkspace(w.id)}
                className="flex flex-1 items-center gap-2 text-left truncate min-w-0"
              >
                <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{w.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {w.selectedNetwork}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDuplicate(w.id)}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleArchive(w.id)}>
                    <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {archivedWorkspaces.length > 0 && (
            <div className="mt-2 border-t pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between px-2 text-xs text-muted-foreground"
                onClick={() => setShowArchived(!showArchived)}
              >
                <span className="flex items-center gap-1">
                  {showArchived ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  Show archived ({archivedWorkspaces.length})
                </span>
              </Button>

              {showArchived && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {archivedWorkspaces.map((w) => (
                    <div
                      key={w.id}
                      className="group flex items-center justify-between rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent/40"
                    >
                      <span className="truncate">{w.name} (archived)</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleUnarchive(w.id)}>
                            <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Unarchive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
