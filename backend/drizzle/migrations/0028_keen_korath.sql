CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_value" text NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"original_price" numeric(10, 2),
	"discount_type" "discount_type" DEFAULT 'percentage',
	"discount_value" numeric(10, 2) DEFAULT '0.00',
	"offer_label" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_order_qty" integer DEFAULT 1,
	"max_order_qty" integer DEFAULT 100,
	"sku" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "variant_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "original_price";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "discount_type";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "discount_value";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "offer_label";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "stock";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "min_order_qty";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "max_order_qty";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "sku";