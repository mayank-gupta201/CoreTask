import { relations, sql } from 'drizzle-orm';
import { 
    pgTable, uuid, varchar, timestamp, boolean, integer, text, date, decimal, index, primaryKey, unique, check, jsonb 
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }), // Nullable for OAuth-only
    googleId: varchar('google_id', { length: 255 }).unique(),
    isEmailVerified: boolean('is_email_verified').default(false).notNull(),
    verificationToken: varchar('verification_token', { length: 255 }),
    resetPasswordToken: varchar('reset_password_token', { length: 255 }),
    resetPasswordExpires: timestamp('reset_password_expires'),
    refreshToken: varchar('refresh_token', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    ownerId: uuid('owner_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceMembers = pgTable('workspace_members', {
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('MEMBER'), // OWNER, ADMIN, PROJECT_MANAGER, RESOURCE_MANAGER, MEMBER, VIEWER
    weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(40), 
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    // Internal cost rate and billing rate retained for backward compat
    internalCostRate: integer('internal_cost_rate').notNull().default(0), 
    billingRate: integer('billing_rate').notNull().default(0), 
});

export const userLeaves = pgTable('user_leaves', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    reason: varchar('reason', { length: 500 }),
    isApproved: boolean('is_approved').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Enterprise PPM Hierarchy ---
export const workspaceHolidays = pgTable('workspace_holidays', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    date: timestamp('date').notNull(),
});

// --- PORTFOLIO MANAGEMENT ---
export const portfolios = pgTable('portfolios', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).default('#2563EB'),
    ownerId: uuid('owner_id').references(() => users.id).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // ACTIVE | ARCHIVED
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    // Added for app compat
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(), 
    deletedAt: timestamp('deleted_at'),
});

export const programs = pgTable('programs', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    portfolioId: uuid('portfolio_id').references(() => portfolios.id, { onDelete: 'cascade' }).notNull(),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const programProjects = pgTable('program_projects', {
    programId: uuid('program_id').references(() => programs.id, { onDelete: 'cascade' }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    sortOrder: integer('sort_order').default(0),
    joinedAt: timestamp('joined_at').defaultNow()
}, (t) => ({
    pk: primaryKey({ columns: [t.programId, t.workspaceId] })
}));

export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
    programId: uuid('program_id').references(() => programs.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('PLANNING'),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    budget: integer('budget').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const milestones = pgTable('milestones', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    dueDate: timestamp('due_date').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    isComplete: boolean('is_complete').default(false),
    completedAt: timestamp('completed_at'),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const projectMilestones = pgTable('project_milestones', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    dueDate: timestamp('due_date').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('PENDING'), 
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectRisks = pgTable('project_risks', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    probability: varchar('probability', { length: 50 }).notNull().default('MEDIUM'),
    impact: varchar('impact', { length: 50 }).notNull().default('MEDIUM'),
    status: varchar('status', { length: 50 }).notNull().default('OPEN'), 
    mitigationStrategy: varchar('mitigation_strategy', { length: 2000 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectExpenses = pgTable('project_expenses', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    amount: integer('amount').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    expenseDate: timestamp('expense_date').notNull(),
    category: varchar('category', { length: 100 }), 
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectAllocations = pgTable('project_allocations', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    allocatedHours: integer('allocated_hours').notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- TASKS ---
export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(), 
    projectId: uuid('project_id').references(() => projects.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('TODO'),
    priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
    dueDate: timestamp('due_date'),
    category: varchar('category', { length: 100 }),
    recurrenceRule: varchar('recurrence_rule', { length: 50 }),
    isRecurringInstance: boolean('is_recurring_instance').default(false).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    // Keep app compat
    assignedTo: uuid('assigned_to').references(() => users.id),
    parentTaskId: uuid('parent_task_id'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    // ADDED AS PER PROMPT
    startDate: timestamp('start_date'),
    estimatedHours: decimal('estimated_hours', { precision: 5, scale: 2 }),
}, (t) => ({
    workspaceStatusIdx: index('idx_tasks_workspace_status').on(t.workspaceId, t.status)
}));

export const projectDependencies = pgTable('project_dependencies', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    dependsOnProjectId: uuid('depends_on_project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    dependencyType: varchar('dependency_type', { length: 50 }).notNull().default('FINISH_TO_START'), 
});

// --- DEPENDENCY PLANNING ---
export const taskDependencies = pgTable('task_dependencies', {
    id: uuid('id').defaultRandom().primaryKey(),
    predecessorTaskId: uuid('predecessor_task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    successorTaskId: uuid('successor_task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    dependencyType: varchar('dependency_type', { length: 10 }).notNull(), // FS | SS | FF | SF
    lagDays: integer('lag_days').default(0),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
    unq: unique().on(t.predecessorTaskId, t.successorTaskId),
    chk: check('task_dep_check', sql`${t.predecessorTaskId} != ${t.successorTaskId}`),
    predIdx: index('idx_task_dep_pred').on(t.predecessorTaskId),
    succIdx: index('idx_task_dep_succ').on(t.successorTaskId)
}));

export const projectBaselines = pgTable('project_baselines', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    snapshotDate: timestamp('snapshot_date').defaultNow(),
    baselineData: jsonb('baseline_data').notNull(),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

// --- RESOURCE MANAGEMENT ---
export const taskAssignments = pgTable('task_assignments', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    allocationPercent: integer('allocation_percent').default(100),
    assignedBy: uuid('assigned_by').references(() => users.id).notNull(),
    assignedAt: timestamp('assigned_at').defaultNow(),
}, (t) => ({
    unq: unique().on(t.taskId, t.userId),
    taskIdx: index('idx_task_assign_task').on(t.taskId),
    userTaskIdx: index('idx_task_assign_user_task').on(t.userId, t.taskId)
}));

export const resourceAvailability = pgTable('resource_availability', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    availableHoursPerDay: decimal('available_hours_per_day', { precision: 4, scale: 2 }).default('8.00'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const holidays = pgTable('holidays', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    date: date('date').notNull(),
    isRecurring: boolean('is_recurring').default(false),
    region: varchar('region', { length: 100 }),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const userCostRates = pgTable('user_cost_rates', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD'),
    effectiveFrom: date('effective_from').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

// --- TIMESHEETS ---
export const timesheets = pgTable('timesheets', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
    unq: unique().on(t.userId, t.workspaceId, t.weekStart),
    idx: index('idx_timesheets_user_ws_start').on(t.userId, t.workspaceId, t.weekStart)
}));

export const timeLogs = pgTable('time_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    timesheetId: uuid('timesheet_id').references(() => timesheets.id, { onDelete: 'cascade' }).notNull(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id).notNull(),
    logDate: date('log_date').notNull(),
    hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
    idx: index('idx_timelogs_ts_date').on(t.timesheetId, t.logDate)
}));

// --- REPORTING ---
export const reportTemplates = pgTable('report_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    reportType: varchar('report_type', { length: 50 }).notNull(),
    config: jsonb('config').notNull(), 
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const reportSchedules = pgTable('report_schedules', {
    id: uuid('id').defaultRandom().primaryKey(),
    reportTemplateId: uuid('report_template_id').references(() => reportTemplates.id, { onDelete: 'cascade' }).notNull(),
    frequency: varchar('frequency', { length: 20 }).notNull(),
    nextRunAt: timestamp('next_run_at').notNull(),
    lastRunAt: timestamp('last_run_at'),
    recipients: jsonb('recipients').notNull(), 
    isActive: boolean('is_active').default(true),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const generatedReports = pgTable('generated_reports', {
    id: uuid('id').defaultRandom().primaryKey(),
    reportTemplateId: uuid('report_template_id').references(() => reportTemplates.id, { onDelete: 'cascade' }),
    generatedBy: uuid('generated_by').references(() => users.id).notNull(),
    generatedAt: timestamp('generated_at').defaultNow(),
    format: varchar('format', { length: 10 }).notNull(),
    s3Url: text('s3_url'),
    fileName: varchar('file_name', { length: 255 }),
    expiresAt: timestamp('expires_at'),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id), 
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    metadata: varchar('metadata', { length: 2000 }), 
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskActivities = pgTable('task_activities', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id),
    type: varchar('type', { length: 50 }).notNull(), 
    content: varchar('content', { length: 2000 }).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskTemplates = pgTable('task_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templateItems = pgTable('template_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').references(() => taskTemplates.id, { onDelete: 'cascade' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
    category: varchar('category', { length: 100 }),
    sortOrder: integer('sort_order').notNull().default(0),
});

export const taskAttachments = pgTable('task_attachments', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileSize: integer('file_size').notNull(), 
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relations Mapping ---

export const portfoliosRelations = relations(portfolios, ({ many, one }) => ({
    programs: many(programs),
    projects: many(projects),
    workspace: one(workspaces, { fields: [portfolios.workspaceId], references: [workspaces.id] }),
    owner: one(users, { fields: [portfolios.ownerId], references: [users.id] })
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
    portfolio: one(portfolios, { fields: [programs.portfolioId], references: [portfolios.id] }),
    programProjects: many(programProjects),
}));

export const programProjectsRelations = relations(programProjects, ({ one }) => ({
    program: one(programs, { fields: [programProjects.programId], references: [programs.id] }),
    workspace: one(workspaces, { fields: [programProjects.workspaceId], references: [workspaces.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
    programProjects: many(programProjects),
    timesheets: many(timesheets),
    reportTemplates: many(reportTemplates)
}));

export const tasksRelations = relations(tasks, ({ many }) => ({
    assignments: many(taskAssignments),
    predecessors: many(taskDependencies, { relationName: 'successor' }),
    successors: many(taskDependencies, { relationName: 'predecessor' })
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
    predecessor: one(tasks, { fields: [taskDependencies.predecessorTaskId], references: [tasks.id], relationName: 'predecessor' }),
    successor: one(tasks, { fields: [taskDependencies.successorTaskId], references: [tasks.id], relationName: 'successor' }),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
    task: one(tasks, { fields: [taskAssignments.taskId], references: [tasks.id] }),
    user: one(users, { fields: [taskAssignments.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    taskAssignments: many(taskAssignments)
}));

export const timesheetsRelations = relations(timesheets, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [timesheets.workspaceId], references: [workspaces.id] }),
    user: one(users, { fields: [timesheets.userId], references: [users.id] }),
    timeLogs: many(timeLogs)
}));

export const timeLogsRelations = relations(timeLogs, ({ one }) => ({
    timesheet: one(timesheets, { fields: [timeLogs.timesheetId], references: [timesheets.id] }),
    task: one(tasks, { fields: [timeLogs.taskId], references: [tasks.id] }),
    user: one(users, { fields: [timeLogs.userId], references: [users.id] }),
}));

export const reportTemplatesRelations = relations(reportTemplates, ({ one }) => ({
    workspace: one(workspaces, { fields: [reportTemplates.workspaceId], references: [workspaces.id] })
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
    items: many(templateItems)
}));

export const templateItemsRelations = relations(templateItems, ({ one }) => ({
    template: one(taskTemplates, { fields: [templateItems.templateId], references: [taskTemplates.id] })
}));

