-- CreateTable
CREATE TABLE "feedback_tag_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "item_count" INTEGER NOT NULL,
    "tagged_items" JSONB NOT NULL,
    "tag_summary" JSONB NOT NULL,
    "needs_review_count" INTEGER NOT NULL DEFAULT 0,
    "model_version" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_tag_batches_batch_id_key" ON "feedback_tag_batches"("batch_id");
