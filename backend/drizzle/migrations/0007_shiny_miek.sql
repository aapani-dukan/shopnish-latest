ALTER TYPE "public"."sub_order_status" ADD VALUE 'delivered_by_seller';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "sub_order_id" integer;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "updated_by_role" text;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE cascade ON UPDATE no action;