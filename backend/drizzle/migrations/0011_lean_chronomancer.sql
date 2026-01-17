CREATE TABLE "master_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_sku" text,
	"category_id" integer,
	"name" text NOT NULL,
	"name_hindi" text,
	"brand" text,
	"unit" text DEFAULT 'piece' NOT NULL,
	"product_type" text,
	"image" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "master_products_master_sku_unique" UNIQUE("master_sku")
);
--> statement-breakpoint
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;