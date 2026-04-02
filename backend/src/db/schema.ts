import { relations } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, boolean, integer, text } from 'drizzle-orm/pg-core';

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
    role: varchar('role', { length: 50 }).notNull().default('MEMBER'), // OWNER, ADMIN, MEMBER
    internalCostRate: integer('internal_cost_rate').notNull().default(0), // Cost to company
    billingRate: integer('billing_rate').notNull().default(0), // Charge to client
    weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(40), // Feature: Workload tracking
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
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

export const portfolios = pgTable('portfolios', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    ownerId: uuid('owner_id').references(() => users.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const programs = pgTable('programs', {
    id: uuid('id').defaultRandom().primaryKey(),
    portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('PLANNING'), // PLANNING, ACTIVE, ON_HOLD, COMPLETED
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    budget: integer('budget').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    portfolioId: uuid('portfolio_id').references(() => portfolios.id).notNull(),
    programId: uuid('program_id').references(() => programs.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('PLANNING'), // PLANNING, ACTIVE, ON_HOLD, COMPLETED
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    budget: integer('budget').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const projectDependencies = pgTable('project_dependencies', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    dependsOnProjectId: uuid('depends_on_project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    dependencyType: varchar('dependency_type', { length: 50 }).notNull().default('FINISH_TO_START'), // FINISH_TO_START, BLOCKS
});

export const projectMilestones = pgTable('project_milestones', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    dueDate: timestamp('due_date').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('PENDING'), // PENDING, ACHIEVED, DELAYED
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectRisks = pgTable('project_risks', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    probability: varchar('probability', { length: 50 }).notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH
    impact: varchar('impact', { length: 50 }).notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH
    status: varchar('status', { length: 50 }).notNull().default('OPEN'), // OPEN, MITIGATED, CLOSED
    mitigationStrategy: varchar('mitigation_strategy', { length: 2000 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectExpenses = pgTable('project_expenses', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    amount: integer('amount').notNull(), // amount in base currency/cents
    description: varchar('description', { length: 500 }).notNull(),
    expenseDate: timestamp('expense_date').notNull(),
    category: varchar('category', { length: 100 }), // SOFTWARE, TRAVEL, MATERIALS
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

export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(), // Maintained for global checks
    projectId: uuid('project_id').references(() => projects.id), // Nullable for global orphaned tasks temporarily
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('TODO'),
    priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
    dueDate: timestamp('due_date'),
    category: varchar('category', { length: 100 }),
    estimatedHours: integer('estimated_hours').default(0), // Feature: Resource allocation
    recurrenceRule: varchar('recurrence_rule', { length: 50 }),
    isRecurringInstance: boolean('is_recurring_instance').default(false).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id),
    parentTaskId: uuid('parent_task_id'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskDependencies = pgTable('task_dependencies', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    dependsOnTaskId: uuid('depends_on_task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    dependencyType: varchar('dependency_type', { length: 50 }).notNull().default('FINISH_TO_START'), // FINISH_TO_START or BLOCKS
});

// --- Timesheets & Billing ---
export const timesheets = pgTable('timesheets', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    periodStartDate: timestamp('period_start_date').notNull(),
    periodEndDate: timestamp('period_end_date').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('DRAFT'), // DRAFT, SUBMITTED, APPROVED, REJECTED
    approvedBy: uuid('approved_by').references(() => users.id),
    totalHours: integer('total_hours').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const timeLogs = pgTable('time_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    timesheetId: uuid('timesheet_id').references(() => timesheets.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    durationMinutes: integer('duration_minutes').default(0), // Automatically computed
    internalCostRate: integer('internal_cost_rate').notNull().default(0), // Frozen cost rate
    billingRate: integer('billing_rate').notNull().default(0), // Frozen billing rate
    billable: boolean('billable').default(true).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id), // Nullable for anonymous actions like failed login
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    metadata: varchar('metadata', { length: 2000 }), // Stringified JSON
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskActivities = pgTable('task_activities', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id),
    type: varchar('type', { length: 50 }).notNull(), // COMMENT, STATUS_CHANGE, PRIORITY_CHANGE, ASSIGNMENT_CHANGE, etc.
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
    fileSize: integer('file_size').notNull(), // bytes
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relations ---

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    user: one(users, { fields: [tasks.userId], references: [users.id], relationName: 'taskCreator' }),
    assignee: one(users, { fields: [tasks.assignedTo], references: [users.id], relationName: 'taskAssignee' }),
    workspace: one(workspaces, { fields: [tasks.workspaceId], references: [workspaces.id] }),
    project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
    parent: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id], relationName: 'subtasks' }),
    subtasks: many(tasks, { relationName: 'subtasks' }),
    activities: many(taskActivities),
    attachments: many(taskAttachments),
    timeLogs: many(timeLogs),
    dependentOn: many(taskDependencies, { relationName: 'taskDependentOn'})
}));

export const workspaceHolidaysRelations = relations(workspaceHolidays, ({ one }) => ({
    workspace: one(workspaces, { fields: [workspaceHolidays.workspaceId], references: [workspaces.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    portfolio: one(portfolios, { fields: [projects.portfolioId], references: [portfolios.id] }),
    program: one(programs, { fields: [projects.programId], references: [programs.id] }),
    tasks: many(tasks),
    dependencies: many(projectDependencies, { relationName: 'projectDependentOn' }),
    milestones: many(projectMilestones),
    risks: many(projectRisks),
    expenses: many(projectExpenses),
    allocations: many(projectAllocations),
}));

export const projectDependenciesRelations = relations(projectDependencies, ({ one }) => ({
    project: one(projects, { fields: [projectDependencies.projectId], references: [projects.id], relationName: 'projectDependentOn' }),
    dependsOnProject: one(projects, { fields: [projectDependencies.dependsOnProjectId], references: [projects.id] }),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
    project: one(projects, { fields: [projectMilestones.projectId], references: [projects.id] }),
}));

export const projectRisksRelations = relations(projectRisks, ({ one }) => ({
    project: one(projects, { fields: [projectRisks.projectId], references: [projects.id] }),
}));

export const projectExpensesRelations = relations(projectExpenses, ({ one }) => ({
    project: one(projects, { fields: [projectExpenses.projectId], references: [projects.id] }),
    creator: one(users, { fields: [projectExpenses.createdBy], references: [users.id] }),
}));

export const projectAllocationsRelations = relations(projectAllocations, ({ one }) => ({
    project: one(projects, { fields: [projectAllocations.projectId], references: [projects.id] }),
    user: one(users, { fields: [projectAllocations.userId], references: [users.id] }),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
    portfolio: one(portfolios, { fields: [programs.portfolioId], references: [portfolios.id] }),
    projects: many(projects),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [portfolios.workspaceId], references: [workspaces.id] }),
    owner: one(users, { fields: [portfolios.ownerId], references: [users.id] }),
    programs: many(programs),
    projects: many(projects),
}));

export const timesheetsRelations = relations(timesheets, ({ one, many }) => ({
    user: one(users, { fields: [timesheets.userId], references: [users.id] }),
    workspace: one(workspaces, { fields: [timesheets.workspaceId], references: [workspaces.id] }),
    approver: one(users, { fields: [timesheets.approvedBy], references: [users.id], relationName: 'timesheetApprover' }),
    entries: many(timeLogs),
}));

export const timeLogsRelations = relations(timeLogs, ({ one }) => ({
    timesheet: one(timesheets, { fields: [timeLogs.timesheetId], references: [timesheets.id] }),
    task: one(tasks, { fields: [timeLogs.taskId], references: [tasks.id] }),
    user: one(users, { fields: [timeLogs.userId], references: [users.id] }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
    task: one(tasks, { fields: [taskDependencies.taskId], references: [tasks.id], relationName: 'taskDependentOn' }),
    dependsOnTask: one(tasks, { fields: [taskDependencies.dependsOnTaskId], references: [tasks.id] }),
}));

export const taskActivitiesRelations = relations(taskActivities, ({ one }) => ({
    user: one(users, { fields: [taskActivities.userId], references: [users.id] }),
    task: one(tasks, { fields: [taskActivities.taskId], references: [tasks.id] }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
    items: many(templateItems),
}));

export const templateItemsRelations = relations(templateItems, ({ one }) => ({
    template: one(taskTemplates, { fields: [templateItems.templateId], references: [taskTemplates.id] }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
    task: one(tasks, { fields: [taskAttachments.taskId], references: [tasks.id] }),
    uploader: one(users, { fields: [taskAttachments.uploadedBy], references: [users.id] }),
}));
