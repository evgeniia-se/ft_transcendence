/*
  Warnings:

  - You are about to drop the column `oauth_id` on the `users` table. All the data in that column
    will be lost. This is intentional: OAuthAccount.(provider, provider_id) replaces it as the
    lookup key for OAuth identities (see schema.prisma comment on OAuthAccount).
  - You are about to drop the column `oauth_provider` on the `users` table. All the data in that
    column will be lost, for the same reason as above.

*/
-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "scopes" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_id_key" ON "oauth_accounts"("provider", "provider_id");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (drop now-redundant columns, superseded by oauth_accounts)
ALTER TABLE "users" DROP COLUMN "oauth_id";
ALTER TABLE "users" DROP COLUMN "oauth_provider";
