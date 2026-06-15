CREATE TABLE "category_subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"sub_category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_product_id" integer NOT NULL,
	"sub_category_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subcategories" DROP CONSTRAINT "subcategories_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "category_subcategories" ADD CONSTRAINT "category_subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_subcategories" ADD CONSTRAINT "category_subcategories_sub_category_id_subcategories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subcategories" ADD CONSTRAINT "product_subcategories_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subcategories" ADD CONSTRAINT "product_subcategories_sub_category_id_subcategories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" DROP COLUMN "category_id";