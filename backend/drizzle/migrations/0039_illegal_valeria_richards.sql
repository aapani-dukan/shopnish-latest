ALTER TYPE "public"."return_status_enum" ADD VALUE 'assigned' BEFORE 'picked_up';--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "cod_balance" double precision DEFAULT 0 NOT NULL;