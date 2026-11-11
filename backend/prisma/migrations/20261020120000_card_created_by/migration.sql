-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "created_by" TEXT;

-- CreateIndex
CREATE INDEX "cards_created_by_idx" ON "cards"("created_by");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
