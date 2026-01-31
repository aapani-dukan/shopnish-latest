CREATE TABLE "admin_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_delivery_radius_km" numeric(5, 2) DEFAULT '5.00',
	"base_delivery_charge" numeric(10, 2) DEFAULT '20.00',
	"charge_per_km" numeric(10, 2) DEFAULT '5.00',
	"free_delivery_min_order_value" numeric(10, 2) DEFAULT '500.00',
	"updated_at" timestamp DEFAULT now()
);
