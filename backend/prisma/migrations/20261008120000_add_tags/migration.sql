-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_tags" (
    "card_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "card_tags_pkey" PRIMARY KEY ("card_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_project_id_name_key" ON "tags"("project_id", "name");

-- CreateIndex
CREATE INDEX "card_tags_tag_id_idx" ON "card_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default tags for the projects that already exist (new projects get them from createProject)
INSERT INTO "tags" ("id", "project_id", "name", "color")
SELECT gen_random_uuid()::text, p."id", d."name", d."color"
FROM "projects" p
CROSS JOIN (VALUES
    ('WIP', '#d97706'),
    ('En cours', '#2563eb'),
    ('À relire', '#7c3aed'),
    ('Bloqué', '#dc2626'),
    ('Bug', '#be185d')
) AS d("name", "color");
