CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "order_events_status_check" CHECK ("order_events"."status" in ('pending', 'cooking', 'ready', 'dispatched', 'cancelled', 'needs_review'))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fee" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_intent_id_idx" ON "orders" USING btree ("payment_intent_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_status_check" CHECK ("orders"."payment_status" in ('pending', 'paid', 'failed', 'refunded'));--> statement-breakpoint
UPDATE "orders" SET "subtotal" = "total_price", "fee" = '0', "tax" = '0', "payment_status" = 'paid', "payment_intent_id" = NULL;--> statement-breakpoint
INSERT INTO "order_events" ("order_id", "status", "created_at") SELECT "id", "status", "created_at" FROM "orders";