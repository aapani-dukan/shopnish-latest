CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'LOW_STOCK',
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
