ALTER TABLE "collection" ADD COLUMN "number" TEXT;
CREATE INDEX "collection_number_idx" ON "collection"("number");
