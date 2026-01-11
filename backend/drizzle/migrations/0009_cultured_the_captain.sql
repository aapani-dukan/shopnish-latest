CREATE TYPE "public"."section_type" AS ENUM('HERO_BANNER', 'CATEGORY_GRID', 'PRODUCT_HORIZONTAL', 'PROMO_AD', 'PRODUCT_GRID', 'SEARCH_BAR');--> statement-breakpoint
CREATE TABLE "home_layout" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_name" text NOT NULL,
	"display_name" text,
	"section_type" "section_type" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"config" json NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_type" "discount_type" DEFAULT 'percentage';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_value" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "offer_label" text;