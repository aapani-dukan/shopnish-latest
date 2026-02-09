ALTER TABLE "users" ADD COLUMN "is_customer" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_seller" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_delivery" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seller_approval_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delivery_approval_status" text DEFAULT 'pending';