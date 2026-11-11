-- CreateTable
CREATE TABLE "whiteboard_files" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whiteboard_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whiteboard_files_project_id_file_id_key" ON "whiteboard_files"("project_id", "file_id");

-- AddForeignKey
ALTER TABLE "whiteboard_files" ADD CONSTRAINT "whiteboard_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
