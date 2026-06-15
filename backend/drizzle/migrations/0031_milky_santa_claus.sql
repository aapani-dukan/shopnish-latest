CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_hindi" varchar(255),
	"image" text,
	"fmcg_brand_commission" numeric(5, 2) DEFAULT '3.00' NOT NULL,
	"local_brand_commission" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "master_products" ADD COLUMN "sub_category_id" integer;--> statement-breakpoint
ALTER TABLE "master_products" ADD COLUMN "brand_type" varchar(50) DEFAULT 'LOCAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sub_category_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand_type" varchar(50) DEFAULT 'LOCAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_sub_category_id_subcategories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_subcategories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;