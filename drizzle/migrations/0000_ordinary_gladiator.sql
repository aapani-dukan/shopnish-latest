DO $$ BEGIN
    CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$
BEGIN
    -- delivery_status_enum
    BEGIN
        CREATE TYPE "public"."delivery_status_enum" AS ENUM(
            'pending', 'accepted', 'out_for_delivery', 'delivered'
        );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

    -- order_status
    BEGIN
        CREATE TYPE "public"."order_status" AS ENUM(
            'pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up',
            'out_for_delivery', 'delivered', 'cancelled', 'rejected', 'in_cart'
        );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

    -- user_role
    BEGIN
        CREATE TYPE "public"."user_role" AS ENUM(
            'customer', 'seller', 'admin', 'delivery-boy'
        );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

END $$;
CREATE TABLE  IF NOT EXISTS "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"product_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_hindi" text,
	"slug" text NOT NULL,
	"description" text,
	"image" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE  IF NOT EXISTS "delivery_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"full_name" text NOT NULL,
	"phone_number" text,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_name" text NOT NULL,
	"pincode" text NOT NULL,
	"city" text NOT NULL,
	"delivery_charge" numeric(10, 2) NOT NULL,
	"free_delivery_above" numeric(10, 2),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_boys" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"vehicle_type" text NOT NULL,
	"vehicle_number" text,
	"license_number" text,
	"aadhar_number" text,
	"is_available" boolean DEFAULT true,
	"current_lat" numeric(10, 8),
	"current_lng" numeric(11, 8),
	"rating" numeric(3, 2) DEFAULT '5.0',
	"total_deliveries" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "delivery_boys_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "delivery_boys_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "delivery_boys_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"order_id" integer,
	"product_id" integer,
	"seller_id" integer,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'in_cart'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"status" text NOT NULL,
	"message" text,
	"message_hindi" text,
	"location" text,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"delivery_boy_id" integer,
	"delivery_address_id" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"delivery_status" "delivery_status_enum" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"delivery_charge" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"delivery_address" text NOT NULL,
	"delivery_instructions" text,
	"estimated_delivery_time" timestamp,
	"actual_delivery_time" timestamp,
	"promo_code" text,
	"discount" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playing_with_neon" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer,
	"store_id" integer,
	"category_id" integer,
	"name" text NOT NULL,
	"name_hindi" text,
	"description" text,
	"description_hindi" text,
	"price" numeric(10, 2) NOT NULL,
	"original_price" numeric(10, 2),
	"image" text NOT NULL,
	"images" text[],
	"unit" text DEFAULT 'piece' NOT NULL,
	"brand" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_order_qty" integer DEFAULT 1,
	"max_order_qty" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2),
	"max_discount" numeric(10, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"product_id" integer,
	"order_id" integer,
	"delivery_boy_id" integer,
	"delivery_address_id" integer,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business_name" text NOT NULL,
	"business_type" text NOT NULL,
	"description" text,
	"business_address" text NOT NULL,
	"city" text NOT NULL,
	"pincode" text NOT NULL,
	"business_phone" text NOT NULL,
	"gst_number" text,
	"bank_account_number" text,
	"ifsc_code" text,
	"delivery_radius" integer,
	"email" text,
	"phone" text,
	"address" text,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sellers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS"service_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"service_provider_id" integer,
	"service_id" integer,
	"booking_number" text NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"scheduled_time" text NOT NULL,
	"address" json NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending',
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"customer_notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "service_bookings_booking_number_unique" UNIQUE("booking_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_hindi" text,
	"description" text,
	"icon" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"service_id" integer,
	"experience" text,
	"rating" numeric(3, 2) DEFAULT '5.0',
	"total_jobs" integer DEFAULT 0,
	"is_available" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"name" text NOT NULL,
	"name_hindi" text,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"duration" integer NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer,
	"store_name" text NOT NULL,
	"store_type" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"pincode" text NOT NULL,
	"phone" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"license_number" text,
	"gst_number" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"approval_status" "approval_status" DEFAULT 'approved' NOT NULL,
	"address" text,
	"city" text,
	"pincode" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$
BEGIN
    BEGIN
        ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "delivery_boys" ADD CONSTRAINT "delivery_boys_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_sellers_id_fk"
        FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_updated_by_users_id_fk"
        FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk"
        FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_boy_id_delivery_boys_id_fk"
        FOREIGN KEY ("delivery_boy_id") REFERENCES "public"."delivery_boys"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_delivery_addresses_id_fk"
        FOREIGN KEY ("delivery_address_id") REFERENCES "public"."delivery_addresses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk"
        FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk"
        FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_delivery_boy_id_delivery_boys_id_fk"
        FOREIGN KEY ("delivery_boy_id") REFERENCES "public"."delivery_boys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "reviews" ADD CONSTRAINT "reviews_delivery_address_id_delivery_addresses_id_fk"
        FOREIGN KEY ("delivery_address_id") REFERENCES "public"."delivery_addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_customer_id_users_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_provider_id_service_providers_id_fk"
        FOREIGN KEY ("service_provider_id") REFERENCES "public"."service_providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_id_services_id_fk"
        FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_service_id_services_id_fk"
        FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TABLE "stores" ADD CONSTRAINT "stores_seller_id_sellers_id_fk"
        FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

END $$;
