import { relations } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

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
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: varchar('status', { length: 50 }).notNull().default('TODO'),
    priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
    dueDate: timestamp('due_date'),
    category: varchar('category', { length: 100 }),
    recurrenceRule: varchar('recurrence_rule', { length: 50 }), // DAILY, WEEKLY, MONTHLY, or null
    isRecurringInstance: boolean('is_recurring_instance').default(false).notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    // Feature 1: Task Assignment
    assignedTo: uuid('assigned_to').references(() => users.id),
    // Feature 2: Soft Delete
    deletedAt: timestamp('deleted_at'),
    // Feature 6: Subtasks (self-referencing FK — applied via raw SQL migration)
    parentTaskId: uuid('parent_task_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
    // Feature 2: Soft Delete
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Task Templates ---

export const taskTemplates = pgTable('task_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    // Feature 2: Soft Delete
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

// --- Relations ---

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    user: one(users, {
        fields: [tasks.userId],
        references: [users.id],
        relationName: 'taskCreator',
    }),
    assignee: one(users, {
        fields: [tasks.assignedTo],
        references: [users.id],
        relationName: 'taskAssignee',
    }),
    workspace: one(workspaces, {
        fields: [tasks.workspaceId],
        references: [workspaces.id],
    }),
    parent: one(tasks, {
        fields: [tasks.parentTaskId],
        references: [tasks.id],
        relationName: 'subtasks',
    }),
    subtasks: many(tasks, {
        relationName: 'subtasks',
    }),
    activities: many(taskActivities),
    attachments: many(taskAttachments),
}));

export const taskActivitiesRelations = relations(taskActivities, ({ one }) => ({
    user: one(users, {
        fields: [taskActivities.userId],
        references: [users.id],
    }),
    task: one(tasks, {
        fields: [taskActivities.taskId],
        references: [tasks.id],
    }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
    items: many(templateItems),
}));

export const templateItemsRelations = relations(templateItems, ({ one }) => ({
    template: one(taskTemplates, {
        fields: [templateItems.templateId],
        references: [taskTemplates.id],
    }),
}));

// --- File Attachments ---

export const taskAttachments = pgTable('task_attachments', {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 1000 }).notNull(),
    fileSize: integer('file_size').notNull(), // bytes
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
    // Feature 2: Soft Delete
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
    task: one(tasks, {
        fields: [taskAttachments.taskId],
        references: [tasks.id],
    }),
    uploader: one(users, {
        fields: [taskAttachments.uploadedBy],
        references: [users.id],
    }),
}));
