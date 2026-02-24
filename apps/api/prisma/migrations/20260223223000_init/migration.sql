-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_contracts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_interactions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "function_name" TEXT NOT NULL,
    "arguments_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_share_id_key" ON "workspaces"("share_id");

-- CreateIndex
CREATE INDEX "saved_contracts_workspace_id_idx" ON "saved_contracts"("workspace_id");

-- CreateIndex
CREATE INDEX "saved_contracts_contract_id_network_idx" ON "saved_contracts"("contract_id", "network");

-- CreateIndex
CREATE INDEX "saved_interactions_workspace_id_idx" ON "saved_interactions"("workspace_id");

-- CreateIndex
CREATE INDEX "saved_interactions_function_name_idx" ON "saved_interactions"("function_name");

-- AddForeignKey
ALTER TABLE "saved_contracts" ADD CONSTRAINT "saved_contracts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_interactions" ADD CONSTRAINT "saved_interactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
