ALTER TABLE "home_layout" ADD COLUMN "pincodes" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "home_layout" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "home_layout" ADD COLUMN "is_global" boolean DEFAULT false;