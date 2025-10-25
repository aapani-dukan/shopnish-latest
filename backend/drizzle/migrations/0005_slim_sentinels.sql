ALTER TYPE "public"."delivery_status_enum" ADD VALUE 'exepted' BEFORE 'cancelled';--> statement-breakpoint
ALTER TABLE "playing_with_neon" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "playing_with_neon" CASCADE;--> statement-breakpoint
ALTER TABLE "service_bookings" DROP CONSTRAINT "service_bookings_booking_number_unique";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_delivery_boy_id_delivery_boys_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_seller_id_sellers_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_delivery_boy_id_delivery_boys_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_delivery_address_id_delivery_addresses_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "seller_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "min_order_value" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "min_order_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "usage_limit" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "is_active" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "city" SET DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "delivery_areas" ALTER COLUMN "city" SET DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "seller_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_name" SET DEFAULT 'Unknown Product';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_price" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_unit" SET DEFAULT 'piece';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "item_total" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_city" SET DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lat" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lng" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "seller_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "promo_codes" ALTER COLUMN "discount_type" SET DATA TYPE "public"."discount_type" USING "discount_type"::"public"."discount_type";--> statement-breakpoint
ALTER TABLE "promo_codes" ALTER COLUMN "discount_value" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "promo_codes" ALTER COLUMN "usage_limit" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ALTER COLUMN "service_provider_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ALTER COLUMN "service_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_providers" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_providers" ALTER COLUMN "rating" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "sub_orders" ALTER COLUMN "seller_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "sub_orders" ALTER COLUMN "delivery_charge" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "seller_id" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "max_discount_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "used_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "scope" "coupon_scope" DEFAULT 'all_orders' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_areas" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "timestamp" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "min_order_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "max_discount_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "booking_date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "total_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "service_providers" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "service_providers" ADD COLUMN "experience_years" integer;--> statement-breakpoint
ALTER TABLE "service_providers" ADD COLUMN "approval_status" "approval_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "service_providers" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sub_orders" ADD COLUMN "delivery_batch_id" integer;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_delivery_batch_id_delivery_batches_id_fk" FOREIGN KEY ("delivery_batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "max_discount_amount";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "end_date";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "usage_count";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "per_user_limit";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "coupon_scope";--> statement-breakpoint
ALTER TABLE "order_tracking" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "order_tracking" DROP COLUMN "message_hindi";--> statement-breakpoint
ALTER TABLE "order_tracking" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_boy_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "seller_id";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP COLUMN "min_order_amount";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP COLUMN "max_discount";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP COLUMN "valid_from";--> statement-breakpoint
ALTER TABLE "promo_codes" DROP COLUMN "valid_until";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "delivery_boy_id";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "delivery_address_id";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "booking_number";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "scheduled_date";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "scheduled_time";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "payment_method";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "payment_status";--> statement-breakpoint
ALTER TABLE "service_bookings" DROP COLUMN "customer_notes";--> statement-breakpoint
ALTER TABLE "service_categories" DROP COLUMN "name_hindi";--> statement-breakpoint
ALTER TABLE "service_categories" DROP COLUMN "icon";--> statement-breakpoint
ALTER TABLE "service_providers" DROP COLUMN "experience";--> statement-breakpoint
ALTER TABLE "service_providers" DROP COLUMN "total_jobs";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "name_hindi";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "base_price";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "duration";--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_user_id_unique" UNIQUE("user_id");