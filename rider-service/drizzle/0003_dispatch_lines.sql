ALTER TABLE "dispatches" ADD COLUMN "items" jsonb NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE "dispatches" SET "items" = jsonb_build_array(jsonb_build_object('itemName', "item_name", 'quantity', "quantity"));--> statement-breakpoint
ALTER TABLE "dispatches" ALTER COLUMN "items" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dispatches" DROP COLUMN "item_name";--> statement-breakpoint
ALTER TABLE "dispatches" DROP COLUMN "quantity";
