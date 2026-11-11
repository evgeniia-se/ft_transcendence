-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_user_id_fkey";

-- CreateTable
CREATE TABLE "whiteboards" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "scene_json" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whiteboards_project_id_key" ON "whiteboards"("project_id");

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
