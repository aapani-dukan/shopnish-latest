ALTER TABLE "admin_settings" ADD COLUMN "extra_pickup_charge" numeric(10, 2) DEFAULT '15.00';--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "delivery_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "total_distance" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "pickup_count" integer DEFAULT 1 NOT NULL;