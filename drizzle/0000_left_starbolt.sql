CREATE TABLE "ems_analysis_result" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"analysis_date" date NOT NULL,
	"equipment_id" integer NOT NULL,
	"run_minutes" integer DEFAULT 0 NOT NULL,
	"idle_minutes" integer DEFAULT 0 NOT NULL,
	"stop_minutes" integer DEFAULT 0 NOT NULL,
	"utilization_rate" numeric(5, 4),
	"lost_units" numeric(10, 1),
	"result_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ems_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"group" varchar(20) NOT NULL,
	"stop_threshold" numeric(6, 2) NOT NULL,
	"idle_threshold" numeric(6, 2) NOT NULL,
	"duration_min" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ems_criteria_group_unique" UNIQUE("group")
);
--> statement-breakpoint
CREATE TABLE "ems_downtime_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"analysis_date" date NOT NULL,
	"equipment_id" integer NOT NULL,
	"state" varchar(10) NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"duration" integer NOT NULL,
	"avg_current" numeric(8, 3),
	"min_current" numeric(8, 3),
	"max_current" numeric(8, 3),
	"lost_units" numeric(10, 1),
	"tags" jsonb,
	"cause" varchar(50),
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ems_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"factory" varchar(10) NOT NULL,
	"group" varchar(20) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ems_equipment_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ems_mold_production" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipment_id" integer NOT NULL,
	"production_date" date NOT NULL,
	"dept_code" varchar(10),
	"order_no" varchar(50),
	"item_name" varchar(200),
	"input_qty" integer DEFAULT 0 NOT NULL,
	"good_qty" integer DEFAULT 0 NOT NULL,
	"capa_12hr" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "ems_reading" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipment_id" integer NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"current_value" numeric(8, 3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ems_analysis_result" ADD CONSTRAINT "ems_analysis_result_equipment_id_ems_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."ems_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ems_downtime_event" ADD CONSTRAINT "ems_downtime_event_equipment_id_ems_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."ems_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ems_mold_production" ADD CONSTRAINT "ems_mold_production_equipment_id_ems_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."ems_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ems_reading" ADD CONSTRAINT "ems_reading_equipment_id_ems_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."ems_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ems_analysis" ON "ems_analysis_result" USING btree ("analysis_date","equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ems_mold" ON "ems_mold_production" USING btree ("equipment_id","production_date","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ems_reading" ON "ems_reading" USING btree ("equipment_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_ems_reading_time" ON "ems_reading" USING btree ("recorded_at","equipment_id");