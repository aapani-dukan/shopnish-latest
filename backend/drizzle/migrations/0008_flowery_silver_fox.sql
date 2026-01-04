ALTER TYPE "public"."sub_order_status" ADD VALUE 'delivered_by_delivery_boy';--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."delivery_status_enum";--> statement-breakpoint
CREATE TYPE "public"."delivery_status_enum" AS ENUM('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'exepted', 'cancelled');--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DATA TYPE "public"."delivery_status_enum" USING "status"::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_status" SET DEFAULT 'pending'::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_status" SET DATA TYPE "public"."delivery_status_enum" USING "delivery_status"::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "seller_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "delivery_boys" ALTER COLUMN "rating" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_price" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "item_total" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_charge" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sub_orders" ALTER COLUMN "seller_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sub_orders" ALTER COLUMN "delivery_charge" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");