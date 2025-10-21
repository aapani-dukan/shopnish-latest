CREATE TYPE "public"."order_item_status_enum" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "order_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "seller_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "status" "order_item_status_enum" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_boy_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_status" "delivery_status_enum" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_otp" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_otp_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_delivery_time" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "actual_delivery_time" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_charge" numeric(10, 2) DEFAULT '0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_boy_id_delivery_boys_id_fk" FOREIGN KEY ("delivery_boy_id") REFERENCES "public"."delivery_boys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;