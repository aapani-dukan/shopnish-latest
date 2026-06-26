CREATE TABLE "product_affinity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"last_interaction" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"product_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "product_affinity" ADD CONSTRAINT "product_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_affinity" ADD CONSTRAINT "product_affinity_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_affinity_user_product" ON "product_affinity" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_affinity_user" ON "product_affinity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_product_views_user" ON "product_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_product_views_product" ON "product_views" USING btree ("product_id");