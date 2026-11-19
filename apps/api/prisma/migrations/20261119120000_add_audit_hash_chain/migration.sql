-- AlterTable: per-stream hash chain for audit events (#1377). Existing rows keep NULL
-- hashes (they predate the chain and are reported as unchained, not as broken).
ALTER TABLE "audit_logs" ADD COLUMN "stream" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "hash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "prev_hash" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_stream_created_at_idx" ON "audit_logs"("stream", "created_at");
