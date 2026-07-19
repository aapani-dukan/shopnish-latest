CREATE TYPE "public"."return_status_enum" AS ENUM('requested', 'accepted', 'picked_up', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."return_type_enum" AS ENUM('shop', 'pickup');--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sub_order_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"delivery_boy_id" integer,
	"return_type" "return_type_enum" NOT NULL,
	"reason" text NOT NULL,
	"refund_phonepe" text,
	"refund_upi" text,
	"pickup_fee" numeric(10, 2) DEFAULT 0 NOT NULL,
	"status" "return_status_enum" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_delivery_boy_id_delivery_boys_id_fk" FOREIGN KEY ("delivery_boy_id") REFERENCES "public"."delivery_boys"("id") ON DELETE no action ON UPDATE no action;