CREATE TABLE IF NOT EXISTS "acknowledgements" (
	"audit_id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"suggestion" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"auditor_id" text NOT NULL,
	"channel" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"audit_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "answers" (
	"audit_id" text NOT NULL,
	"param_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "answers_audit_id_param_id_pk" PRIMARY KEY("audit_id","param_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aois" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"param_id" text,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auditor_targets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"period" text DEFAULT 'Weekly' NOT NULL,
	"share" real DEFAULT 1 NOT NULL,
	"lobs" text[] NOT NULL,
	"override_calls" integer,
	"override_emails" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audits" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"auditor_id" text NOT NULL,
	"tl_id" text NOT NULL,
	"form_id" text NOT NULL,
	"channel" text NOT NULL,
	"lob" text NOT NULL,
	"product" text NOT NULL,
	"customer" text NOT NULL,
	"client_id" text NOT NULL,
	"audit_date" date NOT NULL,
	"week_ending" date NOT NULL,
	"month" text NOT NULL,
	"interaction_date" date NOT NULL,
	"phone" text,
	"link" text,
	"observations" text DEFAULT '' NOT NULL,
	"overall" real NOT NULL,
	"actual" real NOT NULL,
	"fatal" boolean NOT NULL,
	"status" text DEFAULT 'Pending acknowledgement' NOT NULL,
	"allocation_id" text,
	"import_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calib_agreed" (
	"session_id" text NOT NULL,
	"item_id" text NOT NULL,
	"param_id" text NOT NULL,
	"value" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "calib_agreed_item_id_param_id_pk" PRIMARY KEY("item_id","param_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calib_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"ord" integer NOT NULL,
	"audit_id" text,
	"case_id" text NOT NULL,
	"link" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calib_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"item_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"overall" real NOT NULL,
	"actual" real NOT NULL,
	"fatal" boolean NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calib_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"form_id" text NOT NULL,
	"due" date,
	"status" text DEFAULT 'Open' NOT NULL,
	"participants" text[] NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"sso_domains" text[] DEFAULT '{}' NOT NULL,
	"sso_tenant_ids" text[] DEFAULT '{}' NOT NULL,
	"auto_provision" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"cols" text DEFAULT '' NOT NULL,
	"filters" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"freq" text DEFAULT 'Monthly' NOT NULL,
	"status" text DEFAULT 'Awaiting format' NOT NULL,
	"by" text NOT NULL,
	"at" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"param_ids" text[] NOT NULL,
	"reason" text NOT NULL,
	"raised_at" timestamp with time zone NOT NULL,
	"outcome" text,
	"note" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"by" text NOT NULL,
	"mode" text NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"family" text NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"lobs" text[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"file" text NOT NULL,
	"form_id" text NOT NULL,
	"imported_by" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_assignments" (
	"item_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"opened_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"comment" text DEFAULT '' NOT NULL,
	CONSTRAINT "learning_assignments_item_id_agent_id_pk" PRIMARY KEY("item_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_files" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"params" text[] NOT NULL,
	"audience" jsonb NOT NULL,
	"due" date,
	"status" text DEFAULT 'Draft' NOT NULL,
	"quiz" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lobs" (
	"name" text PRIMARY KEY NOT NULL,
	"client_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'Queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "params" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"section_id" text NOT NULL,
	"ord" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"weight" real NOT NULL,
	"fatal" boolean DEFAULT false NOT NULL,
	"options" text[] NOT NULL,
	"guide_y" text DEFAULT '' NOT NULL,
	"guide_n" text DEFAULT '' NOT NULL,
	"guide_na" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"customer" text NOT NULL,
	"lob" text NOT NULL,
	"product" text NOT NULL,
	"channel" text NOT NULL,
	"projected" integer,
	"go_live" date,
	"is_new" boolean DEFAULT false NOT NULL,
	"rate" real,
	"override" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"lob" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"answers" jsonb NOT NULL,
	"auto" jsonb NOT NULL,
	"manual" jsonb NOT NULL,
	"score" real NOT NULL,
	"max" real NOT NULL,
	"pct" real,
	"passed" boolean,
	"status" text NOT NULL,
	"graded_by" text,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"by" text NOT NULL,
	"to_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"ord" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"username" text NOT NULL,
	"password_hash" text,
	"auth_sso" boolean DEFAULT true NOT NULL,
	"auth_password" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lob" text,
	"tl_id" text,
	"fixed" boolean DEFAULT false NOT NULL,
	"company_id" text,
	"client_id" text,
	"sso_tid" text,
	"sso_oid" text,
	"import_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "volumes" (
	"id" text PRIMARY KEY NOT NULL,
	"customer" text NOT NULL,
	"lob" text NOT NULL,
	"product" text NOT NULL,
	"channel" text NOT NULL,
	"month" text NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aois_audit" ON "aois" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audits_agent" ON "audits" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audits_auditor" ON "audits" USING btree ("auditor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audits_date" ON "audits" USING btree ("audit_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audits_tl" ON "audits" USING btree ("tl_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calib_scores_uniq" ON "calib_scores" USING btree ("item_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_company" ON "clients" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_client" ON "customers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_audit" ON "disputes" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_files_item" ON "learning_files" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "params_form" ON "params" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_item" ON "quiz_submissions" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tl" ON "users" USING btree ("tl_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_sso" ON "users" USING btree ("sso_tid","sso_oid");