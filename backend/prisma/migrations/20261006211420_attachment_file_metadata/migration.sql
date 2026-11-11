/*
  Warnings:

  - Added the required column `file_name` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_size` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_user_id_fkey";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "file_name" TEXT NOT NULL,
ADD COLUMN     "file_size" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
