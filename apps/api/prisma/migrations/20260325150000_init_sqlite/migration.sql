-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "selected_network" TEXT NOT NULL DEFAULT 'testnet',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "saved_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_contracts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saved_interactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "function_name" TEXT NOT NULL,
    "name" TEXT,
    "network" TEXT NOT NULL,
    "arguments_json" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_interactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT,
    "hash" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_artifacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "expires_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "share_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "workspaces_owner_key_idx" ON "workspaces"("owner_key");

-- CreateIndex
CREATE INDEX "workspaces_updated_at_idx" ON "workspaces"("updated_at");

-- CreateIndex
CREATE INDEX "saved_contracts_workspace_id_idx" ON "saved_contracts"("workspace_id");

-- CreateIndex
CREATE INDEX "saved_contracts_contract_id_network_idx" ON "saved_contracts"("contract_id", "network");

-- CreateIndex
CREATE INDEX "saved_interactions_workspace_id_idx" ON "saved_interactions"("workspace_id");

-- CreateIndex
CREATE INDEX "saved_interactions_contract_id_network_idx" ON "saved_interactions"("contract_id", "network");

-- CreateIndex
CREATE INDEX "saved_interactions_function_name_network_idx" ON "saved_interactions"("function_name", "network");

-- CreateIndex
CREATE INDEX "workspace_artifacts_workspace_id_kind_idx" ON "workspace_artifacts"("workspace_id", "kind");

-- CreateIndex
CREATE INDEX "workspace_artifacts_hash_idx" ON "workspace_artifacts"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_workspace_id_created_at_idx" ON "share_links"("workspace_id", "created_at");

