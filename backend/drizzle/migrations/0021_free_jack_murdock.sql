CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"amount" double precision NOT NULL,
	"type" varchar(10) NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"reference_id" varchar(100),
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"closing_balance" double precision NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_type" varchar(20) NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"pending_amount" double precision DEFAULT 0 NOT NULL,
	"last_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_user_type_unique" UNIQUE("user_id","user_type")
);
--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_id_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "purpose_idx" ON "wallet_transactions" USING btree ("purpose");