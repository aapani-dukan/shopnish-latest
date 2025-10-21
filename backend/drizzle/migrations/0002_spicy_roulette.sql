CREATE TYPE "public"."coupon_scope" AS ENUM('all_orders', 'specific_seller', 'specific_product', 'category');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('COD', 'ONLINE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('Electronics', 'Fashion', 'Home & Kitchen', 'Books', 'Groceries', 'Health & Beauty', 'Sports & Outdoors', 'Toys & Games', 'Automotive', 'Jewelry', 'Pet Supplies', 'Other');--> statement-breakpoint
CREATE TYPE "public"."sub_order_status" AS ENUM('pending', 'accepted', 'preparing', 'ready_for_pickup', 'cancelled', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."order_status" RENAME TO "master_order_status";--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"description" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_value" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"max_discount_amount" numeric(10, 2),
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"coupon_scope" "coupon_scope" DEFAULT 'all_orders' NOT NULL,
	"seller_id" integer,
	"product_id" integer,
	"category_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "delivery_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_order_id" integer NOT NULL,
	"delivery_boy_id" integer,
	"customer_delivery_address_id" integer NOT NULL,
	"status" "delivery_status_enum" DEFAULT 'pending' NOT NULL,
	"estimated_delivery_time" timestamp,
	"actual_delivery_time" timestamp,
	"delivery_otp" text,
	"delivery_otp_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sub_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_order_id" integer NOT NULL,
	"sub_order_number" text NOT NULL,
	"seller_id" integer NOT NULL,
	"store_id" integer,
	"status" "sub_order_status" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"delivery_charge" numeric(10, 2) DEFAULT 0 NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"estimated_preparation_time" text,
	"is_self_delivery_by_seller" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sub_orders_sub_order_number_unique" UNIQUE("sub_order_number"),
	CONSTRAINT "sub_order_number_unique" UNIQUE("sub_order_number")
);
--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_seller_id_sellers_id_fk";
--> statement-breakpoint
ALTER TABLE "order_tracking" DROP CONSTRAINT "order_tracking_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_seller_id_sellers_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_delivery_boy_id_delivery_boys_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."delivery_status_enum";--> statement-breakpoint
CREATE TYPE "public"."delivery_status_enum" AS ENUM('pending', 'assigned', 'out_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "delivery_batches" ALTER COLUMN "status" SET DATA TYPE "public"."delivery_status_enum" USING "status"::"public"."delivery_status_enum";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."master_order_status";--> statement-breakpoint
CREATE TYPE "public"."master_order_status" AS ENUM('pending', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled', 'failed');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."master_order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."master_order_status" USING "status"::"public"."master_order_status";--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "latitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "latitude" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "longitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "longitude" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_tracking" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_tracking" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_tracking" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE "public"."payment_status" USING "payment_status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lat" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lat" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lng" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_lng" SET DEFAULT '0.0';--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "seller_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "price_at_added" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "total_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "delivery_addresses" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sub_order_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_image" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_total" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "master_order_id" integer;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "delivery_batch_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_state" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_pincode" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "transaction_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "delivery_scope" text DEFAULT 'LOCAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_delivery_pincodes" text[];--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_delivery_radius_km" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "estimated_delivery_time" text DEFAULT '1-2 hours';--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "delivery_pincodes" text[];--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "is_distance_based_delivery" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_master_order_id_orders_id_fk" FOREIGN KEY ("master_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_delivery_boy_id_delivery_boys_id_fk" FOREIGN KEY ("delivery_boy_id") REFERENCES "public"."delivery_boys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_customer_delivery_address_id_delivery_addresses_id_fk" FOREIGN KEY ("customer_delivery_address_id") REFERENCES "public"."delivery_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_master_order_id_orders_id_fk" FOREIGN KEY ("master_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_master_order_id_orders_id_fk" FOREIGN KEY ("master_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_delivery_batch_id_delivery_batches_id_fk" FOREIGN KEY ("delivery_batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "order_id";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "seller_id";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "unit_price";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "order_tracking" DROP COLUMN "order_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "seller_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_boy_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_status";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_charge";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "estimated_delivery_time";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "actual_delivery_time";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_otp";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_otp_sent_at";--> statement-breakpoint
ALTER TABLE "sellers" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "sellers" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "sellers" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "unq_user_product" UNIQUE("user_id","product_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_number_unique" UNIQUE("order_number");