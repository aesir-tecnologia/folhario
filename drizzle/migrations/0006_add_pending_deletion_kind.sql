CREATE TYPE "public"."pending_deletion_kind" AS ENUM('prefix', 'object');--> statement-breakpoint
ALTER TABLE "pending_storage_deletions" ADD COLUMN "kind" "pending_deletion_kind" DEFAULT 'prefix' NOT NULL;
