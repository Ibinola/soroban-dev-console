-- BE-006: Add revision field for optimistic concurrency control
-- AlterTable
ALTER TABLE workspaces ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
