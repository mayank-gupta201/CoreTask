CREATE TABLE "generated_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_template_id" uuid,
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"format" varchar(10) NOT NULL,
	"s3_url" text,
	"file_name" varchar(255),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"region" varchar(100),
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"workspace_id" uuid,
	"is_complete" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "program_projects" (
	"program_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"joined_at" timestamp DEFAULT now(),
	CONSTRAINT "program_projects_program_id_workspace_id_pk" PRIMARY KEY("program_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "project_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"snapshot_date" timestamp DEFAULT now(),
	"baseline_data" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_template_id" uuid NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"recipients" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resource_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"available_hours_per_day" numeric(4, 2) DEFAULT '8.00',
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_percent" integer DEFAULT 100,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	CONSTRAINT "task_assignments_task_id_user_id_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_cost_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"effective_from" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_portfolio_id_portfolios_id_fk";
--> statement-breakpoint
ALTER TABLE "task_dependencies" DROP CONSTRAINT "task_dependencies_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "task_dependencies" DROP CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_timesheet_id_timesheets_id_fk";
--> statement-breakpoint
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "portfolios" ALTER COLUMN "description" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "portfolios" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "description" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ALTER COLUMN "dependency_type" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "task_dependencies" ALTER COLUMN "dependency_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "estimated_hours" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "estimated_hours" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "time_logs" ALTER COLUMN "timesheet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "time_logs" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "time_logs" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "timesheets" ALTER COLUMN "status" SET DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "timesheets" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "color" varchar(7) DEFAULT '#2563EB';--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "predecessor_task_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "successor_task_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "lag_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "log_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "hours" numeric(5, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "week_start" date NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "week_end" date NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_report_template_id_report_templates_id_fk" FOREIGN KEY ("report_template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_projects" ADD CONSTRAINT "program_projects_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_projects" ADD CONSTRAINT "program_projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_report_template_id_report_templates_id_fk" FOREIGN KEY ("report_template_id") REFERENCES "public"."report_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_availability" ADD CONSTRAINT "resource_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_availability" ADD CONSTRAINT "resource_availability_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cost_rates" ADD CONSTRAINT "user_cost_rates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cost_rates" ADD CONSTRAINT "user_cost_rates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_assign_task" ON "task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assign_user_task" ON "task_assignments" USING btree ("user_id","task_id");--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_task_id_tasks_id_fk" FOREIGN KEY ("predecessor_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_task_id_tasks_id_fk" FOREIGN KEY ("successor_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "public"."timesheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_dep_pred" ON "task_dependencies" USING btree ("predecessor_task_id");--> statement-breakpoint
CREATE INDEX "idx_task_dep_succ" ON "task_dependencies" USING btree ("successor_task_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_workspace_status" ON "tasks" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_timelogs_ts_date" ON "time_logs" USING btree ("timesheet_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_timesheets_user_ws_start" ON "timesheets" USING btree ("user_id","workspace_id","week_start");--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "budget";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "task_dependencies" DROP COLUMN "task_id";--> statement-breakpoint
ALTER TABLE "task_dependencies" DROP COLUMN "depends_on_task_id";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "end_time";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "duration_minutes";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "internal_cost_rate";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "billing_rate";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "billable";--> statement-breakpoint
ALTER TABLE "time_logs" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "period_start_date";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "period_end_date";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "total_hours";--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_task_id_successor_task_id_unique" UNIQUE("predecessor_task_id","successor_task_id");--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_workspace_id_week_start_unique" UNIQUE("user_id","workspace_id","week_start");--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dep_check" CHECK ("task_dependencies"."predecessor_task_id" != "task_dependencies"."successor_task_id");