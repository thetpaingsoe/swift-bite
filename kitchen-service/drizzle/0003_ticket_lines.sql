ALTER TABLE "tickets" ADD COLUMN "items" jsonb NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE "tickets" SET "items" = jsonb_build_array(jsonb_build_object('itemName', "item_name", 'quantity', "quantity"));--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "items" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "item_name";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "quantity";
