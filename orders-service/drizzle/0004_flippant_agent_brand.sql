CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"item_price" numeric NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "order_items" ("order_id", "menu_item_id", "item_name", "item_price", "quantity") SELECT "id", "menu_item_id"::uuid, "item_name", "item_price", "quantity" FROM "orders";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "menu_item_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "item_name";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "item_price";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "quantity";