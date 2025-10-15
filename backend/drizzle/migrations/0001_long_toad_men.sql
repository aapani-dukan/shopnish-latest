
ALTER TABLE "orders" ADD COLUMN "delivery_otp" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_otp_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "welcome_message_sent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_activity_at" timestamp DEFAULT now();