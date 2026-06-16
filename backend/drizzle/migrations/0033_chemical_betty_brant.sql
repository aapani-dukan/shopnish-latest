ALTER TABLE "orders" ADD COLUMN "platform_charge" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "extra_discount" numeric(10, 2) DEFAULT '0.00';