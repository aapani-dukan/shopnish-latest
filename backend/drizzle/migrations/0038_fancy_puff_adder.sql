ALTER TYPE "public"."order_item_status_enum" ADD VALUE 'return_requested' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."order_item_status_enum" ADD VALUE 'return_accepted' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."order_item_status_enum" ADD VALUE 'picked_up' BEFORE 'cancelled';