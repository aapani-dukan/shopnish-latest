CREATE TABLE "product_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2),
	"changed_by" integer,
	"change_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "message_hindi" text;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD COLUMN "visual_status" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_returnable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "return_period_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_history" ADD CONSTRAINT "product_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_history" ADD CONSTRAINT "product_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;