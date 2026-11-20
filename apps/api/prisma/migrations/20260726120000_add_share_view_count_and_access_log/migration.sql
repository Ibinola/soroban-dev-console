-- AlterTable
ALTER TABLE "share_links" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "share_id" TEXT NOT NULL,
    "accessed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    CONSTRAINT "share_access_logs_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "share_links" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "share_access_logs_share_id_accessed_at_idx" ON "share_access_logs"("share_id", "accessed_at");
