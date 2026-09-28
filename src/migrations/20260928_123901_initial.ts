import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_status" AS ENUM('open', 'converted', 'expired');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending_payment', 'confirmed', 'cancelled', 'completed', 'expired');
  CREATE TYPE "public"."enum_jobs_source" AS ENUM('website', 'supplier', 'phone', 'whatsapp', 'email', 'account', 'other');
  CREATE TYPE "public"."enum_jobs_leg" AS ENUM('outbound', 'return');
  CREATE TYPE "public"."enum_jobs_status" AS ENUM('unassigned', 'assigned', 'driver_confirmed', 'completed', 'no_show', 'cancelled');
  CREATE TYPE "public"."enum_jobs_payment_method" AS ENUM('web_prepaid', 'supplier', 'cash', 'card_link', 'bank', 'account');
  CREATE TYPE "public"."enum_job_events_type" AS ENUM('created', 'updated', 'assigned', 'unassigned', 'status_changed', 'message_sent');
  CREATE TYPE "public"."enum_job_events_actor_type" AS ENUM('user', 'system', 'customer');
  CREATE TYPE "public"."enum_payments_kind" AS ENUM('initial', 'amendment', 'post_trip', 'payment_link');
  CREATE TYPE "public"."enum_webhook_events_provider" AS ENUM('stripe', 'whatsapp');
  CREATE TYPE "public"."enum_users_role" AS ENUM('owner', 'controller', 'accounts', 'editor');
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"marketing_consent" boolean DEFAULT false,
  	"marketing_consent_at" timestamp(3) with time zone,
  	"stripe_customer_id" varchar,
  	"is_test" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"status" "enum_quotes_status" DEFAULT 'open' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"request" jsonb NOT NULL,
  	"results" jsonb NOT NULL,
  	"total_pence" numeric NOT NULL,
  	"customer_id" integer,
  	"is_test" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'pending_payment' NOT NULL,
  	"customer_id" integer NOT NULL,
  	"quote_id" integer,
  	"booker_name" varchar,
  	"booker_phone" varchar,
  	"booker_email" varchar,
  	"subtotal_pence" numeric NOT NULL,
  	"discount_pence" numeric DEFAULT 0 NOT NULL,
  	"total_pence" numeric NOT NULL,
  	"price_snapshot" jsonb NOT NULL,
  	"terms_version" varchar,
  	"manage_token_hash" varchar,
  	"cancelled_at" timestamp(3) with time zone,
  	"cancel_reason" varchar,
  	"archived_at" timestamp(3) with time zone,
  	"is_test" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "jobs_via_stops" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"address" varchar NOT NULL,
  	"lat" numeric,
  	"lng" numeric
  );
  
  CREATE TABLE "jobs_extras" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"unit_price_pence" numeric NOT NULL
  );
  
  CREATE TABLE "jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"source" "enum_jobs_source" NOT NULL,
  	"booking_id" integer,
  	"leg" "enum_jobs_leg",
  	"return_of_job_id" integer,
  	"pickup_at" timestamp(3) with time zone NOT NULL,
  	"pickup_address" varchar NOT NULL,
  	"pickup_lat" numeric,
  	"pickup_lng" numeric,
  	"dropoff_address" varchar,
  	"dropoff_lat" numeric,
  	"dropoff_lng" numeric,
  	"flight_number" varchar,
  	"flight_arrival_at" timestamp(3) with time zone,
  	"distance_m" numeric,
  	"duration_s" numeric,
  	"hours" numeric,
  	"vehicle_class_slug" varchar NOT NULL,
  	"passengers" numeric NOT NULL,
  	"large_bags" numeric DEFAULT 0 NOT NULL,
  	"small_bags" numeric DEFAULT 0 NOT NULL,
  	"lead_name" varchar NOT NULL,
  	"lead_phone" varchar NOT NULL,
  	"lead_email" varchar,
  	"meet_and_greet" boolean DEFAULT true,
  	"name_board_text" varchar,
  	"status" "enum_jobs_status" DEFAULT 'unassigned' NOT NULL,
  	"driver_phv_no" varchar,
  	"vehicle_reg" varchar,
  	"taken_by_user_id" integer,
  	"taken_at" timestamp(3) with time zone,
  	"dispatched_by_user_id" integer,
  	"dispatched_at" timestamp(3) with time zone,
  	"subcontractor_name" varchar,
  	"completed_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"cancel_reason" varchar,
  	"customer_price_pence" numeric NOT NULL,
  	"payment_method" "enum_jobs_payment_method" DEFAULT 'web_prepaid' NOT NULL,
  	"payment_fee_pence" numeric DEFAULT 0,
  	"locked" boolean DEFAULT false,
  	"driver_notes" varchar,
  	"internal_notes" varchar,
  	"notify_passenger" boolean DEFAULT true,
  	"archived_at" timestamp(3) with time zone,
  	"is_test" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "job_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"type" "enum_job_events_type" NOT NULL,
  	"field" varchar,
  	"old_value" varchar,
  	"new_value" varchar,
  	"actor_type" "enum_job_events_actor_type" NOT NULL,
  	"actor_user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer,
  	"job_id" integer,
  	"stripe_payment_intent_id" varchar NOT NULL,
  	"amount_pence" numeric NOT NULL,
  	"fee_pence" numeric DEFAULT 0,
  	"status" varchar NOT NULL,
  	"kind" "enum_payments_kind" DEFAULT 'initial' NOT NULL,
  	"raw" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "refunds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"payment_id" integer NOT NULL,
  	"stripe_refund_id" varchar NOT NULL,
  	"amount_pence" numeric NOT NULL,
  	"reason" varchar,
  	"created_by_user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" "enum_webhook_events_provider" NOT NULL,
  	"event_id" varchar NOT NULL,
  	"type" varchar NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"payload" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'controller' NOT NULL,
  	"active" boolean DEFAULT true,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"customers_id" integer,
  	"quotes_id" integer,
  	"bookings_id" integer,
  	"jobs_id" integer,
  	"job_events_id" integer,
  	"payments_id" integer,
  	"refunds_id" integer,
  	"webhook_events_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_via_stops" ADD CONSTRAINT "jobs_via_stops_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jobs_extras" ADD CONSTRAINT "jobs_extras_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_return_of_job_id_jobs_id_fk" FOREIGN KEY ("return_of_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_taken_by_user_id_users_id_fk" FOREIGN KEY ("taken_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_dispatched_by_user_id_users_id_fk" FOREIGN KEY ("dispatched_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "job_events" ADD CONSTRAINT "job_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_jobs_fk" FOREIGN KEY ("jobs_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_job_events_fk" FOREIGN KEY ("job_events_id") REFERENCES "public"."job_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_refunds_fk" FOREIGN KEY ("refunds_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE INDEX "customers_stripe_customer_id_idx" ON "customers" USING btree ("stripe_customer_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "quotes_token_idx" ON "quotes" USING btree ("token");
  CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");
  CREATE INDEX "quotes_expires_at_idx" ON "quotes" USING btree ("expires_at");
  CREATE INDEX "quotes_customer_idx" ON "quotes" USING btree ("customer_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE UNIQUE INDEX "bookings_reference_idx" ON "bookings" USING btree ("reference");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");
  CREATE INDEX "bookings_quote_idx" ON "bookings" USING btree ("quote_id");
  CREATE INDEX "bookings_manage_token_hash_idx" ON "bookings" USING btree ("manage_token_hash");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "jobs_via_stops_order_idx" ON "jobs_via_stops" USING btree ("_order");
  CREATE INDEX "jobs_via_stops_parent_id_idx" ON "jobs_via_stops" USING btree ("_parent_id");
  CREATE INDEX "jobs_extras_order_idx" ON "jobs_extras" USING btree ("_order");
  CREATE INDEX "jobs_extras_parent_id_idx" ON "jobs_extras" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "jobs_reference_idx" ON "jobs" USING btree ("reference");
  CREATE INDEX "jobs_source_idx" ON "jobs" USING btree ("source");
  CREATE INDEX "jobs_booking_idx" ON "jobs" USING btree ("booking_id");
  CREATE INDEX "jobs_return_of_job_idx" ON "jobs" USING btree ("return_of_job_id");
  CREATE INDEX "jobs_pickup_at_idx" ON "jobs" USING btree ("pickup_at");
  CREATE INDEX "jobs_flight_number_idx" ON "jobs" USING btree ("flight_number");
  CREATE INDEX "jobs_lead_name_idx" ON "jobs" USING btree ("lead_name");
  CREATE INDEX "jobs_lead_phone_idx" ON "jobs" USING btree ("lead_phone");
  CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");
  CREATE INDEX "jobs_taken_by_user_idx" ON "jobs" USING btree ("taken_by_user_id");
  CREATE INDEX "jobs_dispatched_by_user_idx" ON "jobs" USING btree ("dispatched_by_user_id");
  CREATE INDEX "jobs_updated_at_idx" ON "jobs" USING btree ("updated_at");
  CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");
  CREATE INDEX "job_events_job_idx" ON "job_events" USING btree ("job_id");
  CREATE INDEX "job_events_actor_user_idx" ON "job_events" USING btree ("actor_user_id");
  CREATE INDEX "job_events_updated_at_idx" ON "job_events" USING btree ("updated_at");
  CREATE INDEX "job_events_created_at_idx" ON "job_events" USING btree ("created_at");
  CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");
  CREATE INDEX "payments_job_idx" ON "payments" USING btree ("job_id");
  CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_idx" ON "payments" USING btree ("stripe_payment_intent_id");
  CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");
  CREATE UNIQUE INDEX "refunds_stripe_refund_id_idx" ON "refunds" USING btree ("stripe_refund_id");
  CREATE INDEX "refunds_created_by_user_idx" ON "refunds" USING btree ("created_by_user_id");
  CREATE INDEX "refunds_updated_at_idx" ON "refunds" USING btree ("updated_at");
  CREATE INDEX "refunds_created_at_idx" ON "refunds" USING btree ("created_at");
  CREATE INDEX "webhook_events_event_id_idx" ON "webhook_events" USING btree ("event_id");
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_eventId_idx" ON "webhook_events" USING btree ("provider","event_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("jobs_id");
  CREATE INDEX "payload_locked_documents_rels_job_events_id_idx" ON "payload_locked_documents_rels" USING btree ("job_events_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_refunds_id_idx" ON "payload_locked_documents_rels" USING btree ("refunds_id");
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`);

  /*
   * Constraints Payload's collection config cannot express, added by hand.
   * These stop a duplicate becoming a second booking, so they belong in the
   * database rather than in application code a retry can race.
   *
   * `webhook_events` is NOT here: Payload already builds its compound unique
   * index from the collection's `indexes` option, as `provider_eventId_idx`.
   * Adding a second identical index only costs writes.
   */
  await db.execute(sql`
    -- §14: partial unique on (booking_id, leg) where booking_id is not null.
    -- One outbound and one return per booking, no more. Staff-entered jobs
    -- have no booking, so the index is partial rather than plain unique.
    CREATE UNIQUE INDEX "jobs_booking_leg_idx"
      ON "jobs" USING btree ("booking_id", "leg")
      WHERE "booking_id" IS NOT NULL;

    -- §14: check that source = 'website' <=> booking_id is set. A website job
    -- always has a booking behind it, and a job with a booking can only have
    -- come from the website (§2: the staff form cannot create website jobs).
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_website_iff_booking"
      CHECK (("source" = 'website') = ("booking_id" IS NOT NULL));
  `);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Local development only. `deploy.sh` never runs `down` — DATA-04 says a
  // removal takes two deployments, not a rollback that drops tables.
  await db.execute(sql`
    DROP INDEX IF EXISTS "jobs_booking_leg_idx";
    ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_website_iff_booking";
  `);

  await db.execute(sql`
   DROP TABLE "customers" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "jobs_via_stops" CASCADE;
  DROP TABLE "jobs_extras" CASCADE;
  DROP TABLE "jobs" CASCADE;
  DROP TABLE "job_events" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "refunds" CASCADE;
  DROP TABLE "webhook_events" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_jobs_source";
  DROP TYPE "public"."enum_jobs_leg";
  DROP TYPE "public"."enum_jobs_status";
  DROP TYPE "public"."enum_jobs_payment_method";
  DROP TYPE "public"."enum_job_events_type";
  DROP TYPE "public"."enum_job_events_actor_type";
  DROP TYPE "public"."enum_payments_kind";
  DROP TYPE "public"."enum_webhook_events_provider";
  DROP TYPE "public"."enum_users_role";`);
}
