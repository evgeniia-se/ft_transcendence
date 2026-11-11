/*
  Warnings:

  - A unique constraint covering the columns `[project_id]` on the table `notes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "notes_project_id_key" ON "notes"("project_id");
