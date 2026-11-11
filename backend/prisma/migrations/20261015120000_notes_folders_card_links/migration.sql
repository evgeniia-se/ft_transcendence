-- DropIndex
DROP INDEX "notes_project_id_key";

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Sans titre',
ADD COLUMN     "yjs_state" BYTEA;

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "folder_id" TEXT;

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_notes" (
    "card_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,

    CONSTRAINT "card_notes_pkey" PRIMARY KEY ("card_id","note_id")
);

-- CreateTable
CREATE TABLE "card_attachments" (
    "card_id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,

    CONSTRAINT "card_attachments_pkey" PRIMARY KEY ("card_id","attachment_id")
);

-- CreateIndex
CREATE INDEX "folders_project_id_parent_id_idx" ON "folders"("project_id", "parent_id");

-- CreateIndex
CREATE INDEX "notes_project_id_idx" ON "notes"("project_id");

-- CreateIndex
CREATE INDEX "attachments_project_id_folder_id_idx" ON "attachments"("project_id", "folder_id");

-- CreateIndex
CREATE INDEX "card_notes_note_id_idx" ON "card_notes"("note_id");

-- CreateIndex
CREATE INDEX "card_attachments_attachment_id_idx" ON "card_attachments"("attachment_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_notes" ADD CONSTRAINT "card_notes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_notes" ADD CONSTRAINT "card_notes_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attachments" ADD CONSTRAINT "card_attachments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attachments" ADD CONSTRAINT "card_attachments_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- keep the existing file to card links
INSERT INTO "card_attachments" ("card_id", "attachment_id")
SELECT "card_id", "id" FROM "attachments" WHERE "card_id" IS NOT NULL;

-- the single note each project had becomes its first note
UPDATE "notes" SET "title" = 'Notes';

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_card_id_fkey";

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "card_id";
