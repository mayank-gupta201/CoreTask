# TaskMaster PPM — Phase-Wise Implementation Prompts
> Direct copy-paste prompts for each development phase.
> Total: 10 Prompts across 3 Phases.

---

## HOW TO USE
1. Paste **SYSTEM CONTEXT** (ye ek baar dena hoga pehle conversation mein)
2. Phir **Phase 1A ka prompt** paste karo
3. Jab complete ho jaye, same conversation mein **Phase 1B** paste karo
4. Aur isi tarah aage badhte jao

---

---

# ══════════════════════════════════════════
# SYSTEM CONTEXT — SABSE PEHLE YE PASTE KARO
# ══════════════════════════════════════════

```
You are working on TaskMaster — a production-ready full-stack task management application.

EXISTING TECH STACK:
- Backend: Node.js 20, Express 5, TypeScript 5.9, Drizzle ORM 0.45
- Database: PostgreSQL 15 (hosted on Neon), Redis 7 (hosted on Upstash)
- Queue: BullMQ 5.70 for background jobs
- Real-time: Socket.io 4.8
- Auth: JWT + Refresh tokens + Google OAuth via Passport.js
- File Storage: AWS S3 via AWS SDK v3
- AI: Google Gemini 2.0 Flash
- Email: Nodemailer via BullMQ email worker
- Testing: Vitest
- Logging: Pino
- Validation: Zod 4
- Frontend: React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Zustand 5, TanStack Query 5, React Router 7, React Hook Form 7, Axios, Socket.io client, @dnd-kit, Shadcn/UI + Radix UI

EXISTING ARCHITECTURE PATTERN (strict layered):
Routes → Controllers → Services → Repositories → Database (Drizzle ORM)

EXISTING DATABASE TABLES:
- users (id UUID PK, email, password_hash, google_id, is_email_verified, verification_token, reset_password_token, reset_password_expires, refresh_token, created_at, updated_at)
- workspaces (id UUID PK, name, owner_id FK→users, created_at, updated_at)
- workspace_members (workspace_id FK, user_id FK, role ENUM['OWNER','ADMIN','MEMBER'], joined_at)
- tasks (id UUID PK, title, description, status ENUM['TODO','IN_PROGRESS','DONE'], priority ENUM['LOW','MEDIUM','HIGH','URGENT'], due_date, category, recurrence_rule, is_recurring_instance, workspace_id FK, user_id FK, created_at, updated_at)
- task_activities (id UUID PK, task_id FK, user_id FK, type, content, created_at)
- task_attachments (id UUID PK, task_id FK, file_name, file_url, file_size, mime_type, uploaded_by FK, created_at)
- task_templates (id UUID PK, name, description, workspace_id FK, created_by FK, created_at)
- template_items (id UUID PK, template_id FK, title, description, priority, category, sort_order)
- audit_logs (id UUID PK, user_id FK, action, resource, metadata, created_at)

EXISTING FOLDER STRUCTURE:
backend/src/
  controllers/ — auth, task, workspace, template, chat, task-activity
  services/ — auth, task, workspace, template, ai, s3, audit
  repositories/ — user, task, workspace, template, attachment
  middlewares/ — auth, workspace, validate, rateLimiter, logger, passport, upload
  db/ — index.ts, schema.ts, migrations/
  queue/ — index.ts (BullMQ queues + email worker)
  workers/ — recurringTaskWorker.ts, csvWorker.ts
  routes/ — auth, task, workspace, template, chat
  errors/ — ProblemDetails (RFC 7807)

frontend/src/
  features/ — auth/, dashboard/, tasks/, templates/, workspaces/
  components/ — AIChatBot.tsx, FileAttachments.tsx, ui/ (shadcn)
  layouts/ — DashboardLayout.tsx (sidebar + header)
  store/ — authStore.ts, workspaceStore.ts, uiStore.ts
  api/ — axios.ts (with auto-refresh interceptors), queryClient.ts
  hooks/ — useSocket.ts

EXISTING API CONVENTIONS:
- All protected routes: Authorization: Bearer <token> header
- All workspace-scoped routes: x-workspace-id header
- Error format: RFC 7807 ProblemDetails { type, title, status, detail }
- Response format: { data: ..., message: '...' }
- Zod validation on all request bodies via validate middleware

Keep all new code consistent with these patterns. Never break existing functionality.
```

---

---

# ══════════════════════════════════════════
# PHASE 1 — FOUNDATION
# ══════════════════════════════════════════

---

## PROMPT 1A — Database Schema Extension (Migrations 007–012)

```
TASK: Extend the TaskMaster database schema with all new tables required for the PPM feature expansion.

You need to:
1. Update backend/src/db/schema.ts to add all new Drizzle ORM table definitions
2. Create a new migration file via `npm run db:generate` (document the command to run)
3. Also ADD two new columns to the existing tasks table: start_date (timestamp, nullable) and estimated_hours (decimal(5,2), nullable)

NEW TABLES TO CREATE:

--- PORTFOLIO MANAGEMENT ---
portfolios:
  id UUID PK default gen_random_uuid()
  name varchar(255) NOT NULL
  description text
  color varchar(7) default '#2563EB'  -- hex color for UI
  owner_id UUID FK → users NOT NULL
  status varchar(20) NOT NULL default 'ACTIVE'  -- ACTIVE | ARCHIVED
  created_at timestamp default now()
  updated_at timestamp default now()

programs:
  id UUID PK default gen_random_uuid()
  name varchar(255) NOT NULL
  description text
  portfolio_id UUID FK → portfolios NOT NULL ON DELETE CASCADE
  start_date timestamp
  end_date timestamp
  status varchar(20) default 'ACTIVE'
  created_at timestamp default now()
  updated_at timestamp default now()

program_projects:  -- join table
  program_id UUID FK → programs ON DELETE CASCADE
  workspace_id UUID FK → workspaces ON DELETE CASCADE
  sort_order integer default 0
  joined_at timestamp default now()
  PRIMARY KEY (program_id, workspace_id)

milestones:
  id UUID PK default gen_random_uuid()
  title varchar(255) NOT NULL
  description text
  due_date timestamp NOT NULL
  workspace_id UUID FK → workspaces ON DELETE CASCADE
  is_complete boolean default false
  completed_at timestamp
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()

--- DEPENDENCY PLANNING ---
task_dependencies:
  id UUID PK default gen_random_uuid()
  predecessor_task_id UUID FK → tasks ON DELETE CASCADE NOT NULL
  successor_task_id UUID FK → tasks ON DELETE CASCADE NOT NULL
  dependency_type varchar(10) NOT NULL  -- FS | SS | FF | SF (Finish-to-Start etc)
  lag_days integer default 0            -- positive = lag, negative = lead
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()
  UNIQUE (predecessor_task_id, successor_task_id)
  CHECK predecessor_task_id != successor_task_id

project_baselines:
  id UUID PK default gen_random_uuid()
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  name varchar(255) NOT NULL
  snapshot_date timestamp default now()
  baseline_data jsonb NOT NULL  -- snapshot of all tasks at save time
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()

--- RESOURCE MANAGEMENT ---
task_assignments:
  id UUID PK default gen_random_uuid()
  task_id UUID FK → tasks ON DELETE CASCADE NOT NULL
  user_id UUID FK → users ON DELETE CASCADE NOT NULL
  allocation_percent integer default 100  -- 1-100
  assigned_by UUID FK → users NOT NULL
  assigned_at timestamp default now()
  UNIQUE (task_id, user_id)

resource_availability:
  id UUID PK default gen_random_uuid()
  user_id UUID FK → users ON DELETE CASCADE NOT NULL
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  available_hours_per_day decimal(4,2) default 8.00
  effective_from date NOT NULL
  effective_to date  -- NULL = no end date (current setting)
  created_at timestamp default now()

holidays:
  id UUID PK default gen_random_uuid()
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  name varchar(255) NOT NULL
  date date NOT NULL
  is_recurring boolean default false  -- true = repeat same date every year
  region varchar(100)  -- optional: 'IN', 'US', etc.
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()

user_cost_rates:
  id UUID PK default gen_random_uuid()
  user_id UUID FK → users ON DELETE CASCADE NOT NULL
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  hourly_rate decimal(10,2) NOT NULL
  currency varchar(3) default 'USD'
  effective_from date NOT NULL
  created_at timestamp default now()

--- TIMESHEETS ---
timesheets:
  id UUID PK default gen_random_uuid()
  user_id UUID FK → users ON DELETE CASCADE NOT NULL
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  week_start date NOT NULL  -- always Monday
  week_end date NOT NULL    -- always Sunday
  status varchar(20) NOT NULL default 'DRAFT'  -- DRAFT | SUBMITTED | APPROVED | REJECTED
  submitted_at timestamp
  approved_by UUID FK → users
  approved_at timestamp
  rejection_reason text
  created_at timestamp default now()
  updated_at timestamp default now()
  UNIQUE (user_id, workspace_id, week_start)

time_logs:
  id UUID PK default gen_random_uuid()
  timesheet_id UUID FK → timesheets ON DELETE CASCADE NOT NULL
  task_id UUID FK → tasks ON DELETE SET NULL  -- nullable: non-task time allowed
  user_id UUID FK → users NOT NULL
  log_date date NOT NULL
  hours decimal(5,2) NOT NULL  -- e.g. 7.50 = 7h 30min
  notes text
  created_at timestamp default now()
  updated_at timestamp default now()

--- REPORTING ---
report_templates:
  id UUID PK default gen_random_uuid()
  workspace_id UUID FK → workspaces ON DELETE CASCADE NOT NULL
  name varchar(255) NOT NULL
  report_type varchar(50) NOT NULL  -- STATUS | TIME_VARIANCE | COST | RESOURCE | TIMESHEET
  config jsonb NOT NULL  -- column selections, filters, groupings
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()
  updated_at timestamp default now()

report_schedules:
  id UUID PK default gen_random_uuid()
  report_template_id UUID FK → report_templates ON DELETE CASCADE NOT NULL
  frequency varchar(20) NOT NULL  -- DAILY | WEEKLY | MONTHLY
  next_run_at timestamp NOT NULL
  last_run_at timestamp
  recipients jsonb NOT NULL  -- array of email strings
  is_active boolean default true
  created_by UUID FK → users NOT NULL
  created_at timestamp default now()

generated_reports:
  id UUID PK default gen_random_uuid()
  report_template_id UUID FK → report_templates ON DELETE CASCADE
  generated_by UUID FK → users NOT NULL
  generated_at timestamp default now()
  format varchar(10) NOT NULL  -- PDF | DOCX | XLSX
  s3_url text
  file_name varchar(255)
  expires_at timestamp  -- auto-expire after 30 days

ALSO ADD INDEXES:
- CREATE INDEX ON tasks (workspace_id, status)
- CREATE INDEX ON task_assignments (task_id)
- CREATE INDEX ON task_assignments (user_id, task_id)
- CREATE INDEX ON timesheets (user_id, workspace_id, week_start)
- CREATE INDEX ON time_logs (timesheet_id, log_date)
- CREATE INDEX ON task_dependencies (predecessor_task_id)
- CREATE INDEX ON task_dependencies (successor_task_id)

DRIZZLE RELATIONS to define:
- portfolios → programs (one-to-many)
- programs → program_projects (one-to-many)
- workspaces → program_projects (one-to-many)
- tasks → task_dependencies (as predecessor and as successor)
- tasks → task_assignments (one-to-many)
- users → task_assignments (one-to-many)
- workspaces → timesheets (one-to-many)
- timesheets → time_logs (one-to-many)
- workspaces → report_templates (one-to-many)

OUTPUT: Updated schema.ts with all new tables and relations. Show the command to run for migration generation.
```

---

## PROMPT 1B — RBAC Expansion + Pagination + Redis Cache Service

```
TASK: Three foundational upgrades before any new feature routes are built.

PART 1 — EXPAND RBAC (Role-Based Access Control)

Current workspace_members.role supports: OWNER | ADMIN | MEMBER
Expand to support: OWNER | ADMIN | PROJECT_MANAGER | RESOURCE_MANAGER | MEMBER | VIEWER

Update the role ENUM in schema.ts.

Create a permissions matrix at backend/src/config/permissions.ts:
- OWNER: all permissions
- ADMIN: all except delete workspace
- PROJECT_MANAGER: manage tasks, approve timesheets, manage dependencies, view resources, view reports
- RESOURCE_MANAGER: manage resource assignments, availability, holidays, cost rates; view timesheets
- MEMBER: create/edit own tasks, log time, submit timesheets, view dashboards
- VIEWER: read-only on everything

Create a checkPermission middleware at backend/src/middlewares/permission.middleware.ts:
  - Takes a permission string (e.g., 'timesheet:approve', 'resource:manage')
  - Reads the user's role from workspace_members
  - Throws 403 ProblemDetails if not permitted
  - Usage: router.post('/approve', auth, workspace, checkPermission('timesheet:approve'), controller)

Define these permission strings:
  portfolio:create, portfolio:read, portfolio:manage
  program:create, program:read, program:manage
  task:create, task:read, task:update, task:delete, task:assign
  dependency:manage
  resource:manage, resource:read
  timesheet:submit, timesheet:approve, timesheet:read
  report:generate, report:manage
  dashboard:read
  workspace:manage

---

PART 2 — CURSOR-BASED PAGINATION UTILITY

Create backend/src/utils/pagination.ts with:
  - A generic paginateQuery() helper that accepts (query result array, limit, cursor field)
  - Returns: { data: T[], nextCursor: string | null, hasMore: boolean }
  - Cursor is base64-encoded { id, created_at } of the last item
  
Create a Zod schema for pagination query params:
  - limit: number (default 20, max 100)
  - cursor: string (optional, base64)

Apply cursor pagination to the existing GET /api/tasks route immediately (this is critical — it currently returns ALL tasks with no limit).

---

PART 3 — REDIS CACHE SERVICE

Create backend/src/services/cache.service.ts:

class CacheService {
  // Get value from Redis; if not found, call fetcher fn, store result, return it
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T>
  
  // Invalidate single key
  async invalidate(key: string): Promise<void>
  
  // Invalidate all keys matching a pattern (e.g., 'dashboard:workspace:*')
  async invalidatePattern(pattern: string): Promise<void>
  
  // Build standardized cache keys
  static keys = {
    workspaceDashboard: (workspaceId: string) => `dashboard:workspace:${workspaceId}`,
    portfolioDashboard: (portfolioId: string) => `dashboard:portfolio:${portfolioId}`,
    resourceGrid: (workspaceId: string, dateRange: string) => `resources:${workspaceId}:${dateRange}`,
    userUtilization: (userId: string, workspaceId: string) => `util:${userId}:${workspaceId}`,
  }
}

TTL defaults:
  - Dashboard aggregations: 60 seconds
  - Portfolio dashboard: 300 seconds (5 min)
  - Resource utilization: 120 seconds

Invalidate workspace dashboard cache whenever: task is created/updated/deleted (hook into existing task.service.ts emit calls).

OUTPUT: permissions.ts, permission.middleware.ts, pagination.ts, cache.service.ts, and updated task.service.ts with cache invalidation calls.
```

---

## PROMPT 1C — Task Dependencies API (Backend)

```
TASK: Build the complete backend for task dependency management and Gantt data endpoint.

PART 1 — DEPENDENCY REPOSITORY
Create backend/src/repositories/dependency.repository.ts with:
  - createDependency(data): creates a new task_dependency row
  - deleteDependency(id, workspaceId): deletes by id (validate task belongs to workspace)
  - getDependenciesByTask(taskId): returns all dependencies where task is predecessor OR successor
  - getDependenciesByWorkspace(workspaceId): returns all dependencies for all tasks in workspace (for Gantt)
  - checkCircular(predecessorId, successorId, db): recursive CTE query to detect circular chains before inserting

PART 2 — DEPENDENCY SERVICE
Create backend/src/services/dependency.service.ts with:
  
  addDependency(workspaceId, userId, body: { predecessorTaskId, successorTaskId, dependencyType, lagDays }):
    1. Verify both tasks belong to workspaceId (security check)
    2. Check for circular dependency using checkCircular() — throw 422 if circular
    3. Create dependency
    4. Emit Socket.io event 'dependency:created' to workspace room
    5. Enqueue BullMQ job 'critical-path-compute' with workspaceId
    
  removeDependency(workspaceId, dependencyId, userId):
    1. Delete dependency
    2. Emit 'dependency:deleted' to workspace room
    3. Enqueue 'critical-path-compute' job

PART 3 — GANTT ENDPOINT DATA SERVICE
Add getGanttData(workspaceId) to the task service (or dependency service):
  Returns:
  {
    tasks: Array<{
      id, title, status, priority, startDate, dueDate, estimatedHours,
      assignees: Array<{ userId, name, avatarUrl, allocationPercent }>,
      dependencies: Array<{ id, predecessorId, successorId, type, lagDays }>
    }>,
    milestones: Array<{ id, title, dueDate, isComplete }>,
    criticalPathTaskIds: string[]  -- from Redis cache of last compute job result
  }

PART 4 — BullMQ CRITICAL PATH WORKER
Add a new queue 'critical-path' to backend/src/queue/index.ts.
Create backend/src/workers/criticalPathWorker.ts:
  - Triggered with { workspaceId }
  - Fetches all tasks with start_date, due_date, and dependencies
  - Implements basic CPM (Critical Path Method):
      * Build directed graph from dependencies
      * Forward pass: compute earliest start/finish per task
      * Backward pass: compute latest start/finish per task
      * Tasks with zero float = critical path
  - Stores result in Redis: cache key `critical-path:${workspaceId}`, TTL 1 hour
  - Emits Socket.io event 'critical-path:updated' to workspace room with { criticalPathTaskIds }

PART 5 — ROUTES + CONTROLLER + VALIDATION
Create backend/src/controllers/dependency.controller.ts
Create backend/src/routes/dependency.routes.ts with:

  POST   /api/workspaces/:workspaceId/tasks/:taskId/dependencies
         Body Zod: { successorTaskId: uuid, dependencyType: enum['FS','SS','FF','SF'], lagDays?: number }
         Middleware: auth, workspace, checkPermission('dependency:manage'), validate

  DELETE /api/workspaces/:workspaceId/dependencies/:dependencyId
         Middleware: auth, workspace, checkPermission('dependency:manage')

  GET    /api/workspaces/:workspaceId/gantt
         Returns full Gantt data (tasks + dependencies + milestones + critical path)
         Middleware: auth, workspace, checkPermission('dashboard:read')
         Cache: Redis 60s TTL via CacheService

Register the new route in backend/src/routes/index.ts.

SOCKET EVENTS to add to socket.ts:
  - 'dependency:created' → payload: { dependency }
  - 'dependency:deleted' → payload: { dependencyId }
  - 'critical-path:updated' → payload: { workspaceId, criticalPathTaskIds }

OUTPUT: Full working backend for task dependencies with circular detection, CPM worker, and Gantt data endpoint.
```

---

## PROMPT 1D — Gantt Chart Frontend

```
TASK: Build the Gantt chart frontend view for TaskMaster.

Install this package: npm install @dhtmlx/trial-gantt
(Alternatively use: npm install gantt-task-react — use whichever has better TypeScript support)

CREATE frontend/src/features/gantt/GanttView.tsx

This page should:

1. FETCH DATA
   - Use TanStack Query: useQuery({ queryKey: ['gantt', workspaceId], queryFn: () => api.get('/workspaces/:id/gantt') })
   - Listen to Socket.io events: 'dependency:created', 'dependency:deleted', 'critical-path:updated'
   - On socket events: call queryClient.invalidateQueries(['gantt', workspaceId])

2. DISPLAY GANTT CHART
   - Left panel: task list (title, assignees avatars, status badge)
   - Right panel: horizontal timeline bars
   - Bar width = proportional to task duration (start_date to due_date)
   - Bar color by status: TODO=blue, IN_PROGRESS=amber, DONE=green
   - Critical path tasks: red border/glow on bar
   - Dependency arrows: lines connecting bars (FS = arrow from end of predecessor to start of successor)
   - Milestones: diamond shape on timeline
   - Today line: vertical red/blue dashed line on current date

3. INTERACTIONS
   - Click task bar → opens existing task detail slide-over (Sheet component)
   - Drag task bar left/right → updates start_date and due_date (PATCH /api/tasks/:id)
   - Drag bar edges → resize (change duration only)
   - Zoom controls: Day | Week | Month view toggle (top-right buttons)
   - Collapse/expand task groups by status

4. DEPENDENCY MANAGEMENT PANEL (right-click or "+" button on task)
   - Small modal/popover: "Add Dependency"
   - Select predecessor/successor from dropdown of workspace tasks
   - Select type: FS / SS / FF / SF
   - Optional lag days input
   - Submit → POST to dependency endpoint

5. TOOLBAR
   - Left: workspace name + "Gantt View" breadcrumb
   - Right: Zoom selector (Day/Week/Month), "Add Milestone" button, "Save Baseline" button

6. LOADING STATE
   - Skeleton bars while loading
   - Spinner overlay during mutations

7. STATE MANAGEMENT
   Create frontend/src/store/ganttStore.ts (Zustand):
   - zoomLevel: 'day' | 'week' | 'month'
   - criticalPathTaskIds: string[]
   - isDragging: boolean

ADD ROUTE in App.tsx:
  <Route path="/projects/:workspaceId/gantt" element={<GanttView />} />

ADD NAVIGATION in DashboardLayout.tsx sidebar:
  - Add "Gantt" link with a GitBranch or LayoutList icon (from lucide-react)
  - Only show if user has 'dashboard:read' permission

STYLE REQUIREMENTS (Tailwind + Shadcn):
  - Dark header toolbar matching existing DashboardLayout style
  - Gantt bars: rounded-full, subtle shadow
  - Critical path bars: ring-2 ring-red-500
  - Dependency arrows: SVG overlay with smooth bezier curves, color: #94a3b8
  - Milestones: rotate-45 diamond shape, filled brand color
  - Today line: border-dashed border-blue-500

OUTPUT: Complete GanttView.tsx + ganttStore.ts + all supporting hooks. Add the route and sidebar link.
```

---

---

# ══════════════════════════════════════════
# PHASE 2 — RESOURCE & TIME
# ══════════════════════════════════════════

---

## PROMPT 2A — Resource Management (Full Backend)

```
TASK: Build the complete backend for resource management — assignments, availability, holidays, cost rates, and utilization calculation.

PART 1 — REPOSITORIES
Create backend/src/repositories/resource.repository.ts with:
  - assignUserToTask(taskId, userId, allocationPercent, assignedBy)
  - removeAssignment(taskId, userId)
  - getTaskAssignments(taskId): returns assignments with user details (name, email, avatar)
  - getWorkspaceAssignments(workspaceId, dateFrom, dateTo): all assignments in workspace for date range
  - getUserUtilization(userId, workspaceId, dateFrom, dateTo): 
      * For each day in range, sum allocation_percent of all tasks where that day falls between task.start_date and task.due_date
      * Returns: Array<{ date: string, totalAllocation: number, isOverAllocated: boolean }>
  - setAvailability(userId, workspaceId, hoursPerDay, effectiveFrom, effectiveTo)
  - getAvailability(userId, workspaceId, date): returns applicable availability record for given date
  - createHoliday(workspaceId, data)
  - getHolidays(workspaceId, year): returns all holidays for workspace in given year
  - deleteHoliday(id, workspaceId)
  - setUserCostRate(userId, workspaceId, data)
  - getUserCostRate(userId, workspaceId, date): returns applicable rate for given date
  - getResourceGridData(workspaceId, dateFrom, dateTo):
      Returns: Array<{
        user: { id, name, email },
        dailyData: Array<{
          date: string,
          totalAllocation: number,
          isHoliday: boolean,
          isOverAllocated: boolean,  // totalAllocation > 100
          tasks: Array<{ taskId, taskTitle, allocation }>
        }>
      }>

PART 2 — SERVICE
Create backend/src/services/resource.service.ts:

  assignUserToTask(workspaceId, taskId, userId, allocationPercent, requesterId):
    1. Verify task belongs to workspace
    2. Verify userId is a member of workspace
    3. Create task_assignment row
    4. Recalculate utilization for userId (enqueue BullMQ job 'utilization-calc')
    5. Emit Socket.io 'assignment:created' to workspace room
    6. If new utilization > 100% on any day: emit 'resource:overallocated' event with details

  removeAssignment(workspaceId, taskId, userId, requesterId): 
    1. Delete assignment
    2. Enqueue utilization recalc
    3. Emit 'assignment:removed'

  getResourceGrid(workspaceId, dateFrom, dateTo):
    1. Check Redis cache first (key: CacheService.keys.resourceGrid(workspaceId, `${dateFrom}:${dateTo}`), TTL 120s)
    2. Fetch from getResourceGridData repo method
    3. Merge holiday data into daily data
    4. Store in cache and return

  setAvailability(workspaceId, userId, data, requesterId): sets availability record, invalidates utilization cache
  
  manageHolidays(workspaceId, action, data, requesterId): create/delete holidays, invalidate resource grid cache

PART 3 — BullMQ WORKER
Add 'utilization-calc' queue to queue/index.ts.
Create backend/src/workers/utilizationWorker.ts:
  - Job data: { userId, workspaceId }
  - Calculates total daily allocation for user across all assigned tasks
  - Stores result in Redis: `util:${userId}:${workspaceId}`, TTL 1800s (30 min)
  - If any day > 100%: emit Socket.io 'resource:overallocated' event

PART 4 — ROUTES + CONTROLLERS
Create backend/src/controllers/resource.controller.ts
Create backend/src/routes/resource.routes.ts:

  POST   /api/workspaces/:workspaceId/tasks/:taskId/assignments
         Body: { userId: uuid, allocationPercent: number (1-100) }
         Permission: task:assign

  DELETE /api/workspaces/:workspaceId/tasks/:taskId/assignments/:userId
         Permission: task:assign

  GET    /api/workspaces/:workspaceId/resources
         Query: { dateFrom: date, dateTo: date }
         Returns full resource grid data
         Permission: resource:read
         Cached via CacheService (120s TTL)

  PUT    /api/workspaces/:workspaceId/resources/:userId/availability
         Body: { availableHoursPerDay: number, effectiveFrom: date, effectiveTo?: date }
         Permission: resource:manage

  GET    /api/workspaces/:workspaceId/holidays
         Query: { year: number }
         Permission: resource:read

  POST   /api/workspaces/:workspaceId/holidays
         Body: { name, date, isRecurring, region? }
         Permission: resource:manage

  DELETE /api/workspaces/:workspaceId/holidays/:holidayId
         Permission: resource:manage

  PUT    /api/workspaces/:workspaceId/resources/:userId/cost-rate
         Body: { hourlyRate, currency, effectiveFrom }
         Permission: resource:manage

SOCKET EVENTS:
  - 'assignment:created' → { taskId, userId, allocationPercent }
  - 'assignment:removed' → { taskId, userId }
  - 'resource:overallocated' → { userId, userName, overAllocatedDates: string[] }

OUTPUT: Full resource management backend — repositories, service, worker, controller, routes. Register route in routes/index.ts.
```

---

## PROMPT 2B — Resource Grid Frontend

```
TASK: Build the Resource Management frontend for TaskMaster — a spreadsheet-style resource grid showing team member workload across days.

Install: npm install @tanstack/react-table react-big-calendar date-fns

CREATE frontend/src/features/resources/ResourceGrid.tsx

LAYOUT:
  - Top toolbar: Date range picker (default: current week ± 2 weeks), "Today" button, view toggle (Week/Month)
  - Main grid: 
      * Left column (frozen): member avatar + name + total weekly hours
      * Remaining columns: one per day in the selected range
      * Each cell: shows total allocation% for that person on that day
      * Cell colors:
          0% = white/empty
          1-79% = bg-blue-50 (light blue)
          80-99% = bg-yellow-50 (light amber, approaching capacity)
          100% = bg-green-100 (fully utilized)
          >100% = bg-red-100 with red text (OVER-ALLOCATED warning)
      * Holiday cells: bg-gray-100 with a small holiday icon
      * Weekend cells: slightly darker gray background
      * Hover any cell → tooltip showing task list for that day
  - Collapsed task rows: click member row to expand → show individual task rows underneath with allocation per task

COMPONENTS TO BUILD:
  1. ResourceGrid.tsx — main page component
  2. ResourceGridCell.tsx — individual cell with tooltip (Radix UI Tooltip)
  3. ResourceGridRow.tsx — one row per team member
  4. ResourceTaskRow.tsx — expandable sub-row per task under each member
  5. AssignUserDialog.tsx — modal to assign a user to a task
     - Select task from dropdown (filtered by workspace tasks)
     - Select user from workspace members
     - Allocation % slider (1-100)
     - Submit → POST assignment
  6. HolidayManager.tsx — side panel (Sheet) to manage holidays
     - List of existing holidays
     - Form to add: name, date, recurring toggle
     - Delete button per holiday

ZUSTAND STORE (frontend/src/store/resourceStore.ts):
  - dateFrom: string (ISO date)
  - dateTo: string (ISO date)  
  - viewMode: 'week' | 'month'
  - expandedMembers: Set<string> (user IDs with expanded task rows)
  - setDateRange(from, to): action
  - toggleMemberExpand(userId): action

DATA FETCHING (TanStack Query):
  - useQuery(['resources', workspaceId, dateFrom, dateTo], () => api.get('/workspaces/:id/resources?dateFrom=...&dateTo=...'))
  - Refetch on Socket.io events: 'assignment:created', 'assignment:removed', 'resource:overallocated'
  - On 'resource:overallocated': show toast notification (shadcn/ui Toast) with warning

OVERALLOCATION ALERT BANNER:
  If any member is over-allocated in the current view period:
  - Show a yellow alert banner at top of page listing affected members
  - Each member name is clickable to scroll to their row

ADD ROUTE: <Route path="/projects/:workspaceId/resources" element={<ResourceGrid />} />
ADD TO SIDEBAR: "Resources" link with Users icon

OUTPUT: Complete resource management frontend with grid, assignment dialog, holiday manager, and Socket.io integration.
```

---

## PROMPT 2C — Timesheets (Full Backend)

```
TASK: Build the complete timesheet backend — weekly timesheet management, time logging, approval workflow, auto-fill, and payroll export.

PART 1 — REPOSITORIES
Create backend/src/repositories/timesheet.repository.ts:
  - getOrCreateTimesheet(userId, workspaceId, weekStart, weekEnd): upsert timesheet row
  - getTimesheetById(id): with all time_logs joined
  - getTimesheetsByWorkspace(workspaceId, filters: { userId?, status?, weekStart? }): for PM approval view
  - logTime(timesheetId, data: { taskId, logDate, hours, notes, userId }): insert time_log
  - updateTimeLog(id, data): update hours/notes
  - deleteTimeLog(id, userId): delete (only if timesheet is DRAFT)
  - getLastWeekLogs(userId, workspaceId, currentWeekStart): returns time_logs from previous week
  - submitTimesheet(id, userId): update status DRAFT→SUBMITTED, set submitted_at
  - approveTimesheet(id, approverId): update status SUBMITTED→APPROVED, set approved_by, approved_at
  - rejectTimesheet(id, approverId, reason): update status SUBMITTED→REJECTED, set rejection_reason
  - getTimesheetStats(workspaceId, dateFrom, dateTo): aggregate hours per user per task for reporting

PART 2 — SERVICE
Create backend/src/services/timesheet.service.ts:

  getCurrentTimesheet(userId, workspaceId, weekStartParam?):
    - Calculate week boundaries (Monday to Sunday) from weekStartParam or today
    - getOrCreate the timesheet record
    - Return timesheet with all time_logs grouped by task

  logHours(userId, workspaceId, timesheetId, data):
    1. Verify timesheet belongs to userId and is in DRAFT status (throw 422 if SUBMITTED/APPROVED)
    2. Verify task (if provided) belongs to workspace
    3. Validate hours: must be > 0 and ≤ 24 per day per person
    4. Check total hours for that day don't exceed 24 (sum of existing + new)
    5. Insert time_log
    6. Emit Socket.io 'timelog:added' to workspace room

  autoFillFromLastWeek(userId, workspaceId, timesheetId):
    1. Get current timesheet's week_start
    2. Calculate previous week_start (subtract 7 days)
    3. Fetch last week's time_logs
    4. For each last week log: create new time_log on same weekday but current week
    5. Only copy tasks that still exist (skip deleted tasks)
    6. Return created logs count

  submitTimesheet(userId, workspaceId, timesheetId):
    1. Verify ownership and DRAFT status
    2. Verify at least 1 time_log exists (can't submit empty)
    3. Update status → SUBMITTED
    4. Emit Socket.io 'timesheet:submitted' to workspace room (PMs see this)
    5. Send email notification to workspace PROJECT_MANAGERs via BullMQ email queue

  approveTimesheet(approverId, workspaceId, timesheetId):
    1. Verify approver has PROJECT_MANAGER or ADMIN role
    2. Verify SUBMITTED status
    3. Update → APPROVED
    4. Emit 'timesheet:approved'
    5. Send email notification to the timesheet owner

  rejectTimesheet(approverId, workspaceId, timesheetId, reason):
    1. Verify permissions + SUBMITTED status
    2. Update → REJECTED with reason
    3. Reset to allow re-editing (set status DRAFT)
    4. Emit 'timesheet:rejected'
    5. Email owner with rejection reason

  exportPayroll(workspaceId, weekStart, weekEnd, requesterId):
    - Fetch all APPROVED timesheets in date range
    - Join with user_cost_rates to get hourly rates
    - Compute: hours × rate = cost per user per task
    - Return CSV-formatted data (use fast-csv or manual CSV string)

PART 3 — BullMQ TIMESHEET REMINDER WORKER
Add 'timesheet-reminder' queue.
Create backend/src/workers/timesheetReminderWorker.ts:
  - Scheduled every Friday at 4pm via node-cron: '0 16 * * 5'
  - Fetch all workspace members who have DRAFT or no timesheet for current week
  - For each: enqueue email reminder via existing email queue
  - Email template: "Don't forget to submit your timesheet for this week! [Submit Now →]"

PART 4 — ROUTES + CONTROLLERS
Create backend/src/routes/timesheet.routes.ts:

  GET    /api/workspaces/:workspaceId/timesheets/current
         Query: ?weekStart=YYYY-MM-DD (optional, defaults to current week)
         Permission: timesheet:submit (any member can get their own)
         Returns: current user's timesheet with time_logs

  POST   /api/workspaces/:workspaceId/timesheets/:timesheetId/logs
         Body: { taskId?: uuid, logDate: date, hours: number, notes?: string }
         Permission: timesheet:submit

  PATCH  /api/workspaces/:workspaceId/timesheets/:timesheetId/logs/:logId
         Body: { hours?: number, notes?: string }
         Permission: timesheet:submit

  DELETE /api/workspaces/:workspaceId/timesheets/:timesheetId/logs/:logId
         Permission: timesheet:submit

  POST   /api/workspaces/:workspaceId/timesheets/:timesheetId/autofill
         Permission: timesheet:submit

  POST   /api/workspaces/:workspaceId/timesheets/:timesheetId/submit
         Permission: timesheet:submit

  GET    /api/workspaces/:workspaceId/timesheets
         Query: ?userId&status&weekStart — for PM approval view
         Permission: timesheet:approve

  POST   /api/workspaces/:workspaceId/timesheets/:timesheetId/approve
         Permission: timesheet:approve

  POST   /api/workspaces/:workspaceId/timesheets/:timesheetId/reject
         Body: { reason: string }
         Permission: timesheet:approve

  GET    /api/workspaces/:workspaceId/timesheets/payroll-export
         Query: ?weekStart&weekEnd
         Permission: resource:manage (OWNER/ADMIN/RESOURCE_MANAGER only)
         Returns: CSV download (Content-Type: text/csv)

SOCKET EVENTS: timelog:added, timesheet:submitted, timesheet:approved, timesheet:rejected

OUTPUT: Full timesheet backend. Register routes in routes/index.ts.
```

---

## PROMPT 2D — Timesheets Frontend

```
TASK: Build the complete timesheet frontend — weekly grid, submission flow, approval dashboard, and auto-fill.

CREATE frontend/src/features/timesheets/TimesheetWeekly.tsx (main user view)

LAYOUT:
  - Top: Week navigator with ← → arrows, current week label ("Apr 7 – Apr 13, 2026"), today button
  - Timesheet status badge: DRAFT (gray) | SUBMITTED (blue) | APPROVED (green) | REJECTED (red)
  - "Auto-Fill from Last Week" button (top right, with clock icon)
  - "Submit Timesheet" button (disabled if no logs, blue when ready)
  - Main grid:
      * Rows: one per task that has been logged this week + one "+ Add Time" row at bottom
      * Columns: Mon | Tue | Wed | Thu | Fri | Sat | Sun (7 columns)
      * Each cell: editable number input for hours (e.g. "7.5")
      * Empty cells show "—" placeholder
      * Weekends (Sat/Sun): slightly grayed background
      * Total row at bottom: sum of each column (daily totals)
      * Total column at right: sum of each row (task totals)
      * Cells are NOT editable if timesheet status is SUBMITTED or APPROVED
  - REJECTED banner: if status is REJECTED, show red alert with rejection_reason and "Edit & Resubmit" guidance

INTERACTIONS:
  - Click any empty cell → create time_log via POST (debounced 800ms after user stops typing)
  - Edit existing cell → PATCH time_log
  - Clear cell to 0 → DELETE time_log
  - "Add Time" row: opens task selector dropdown → adds new task row to grid
  - Auto-Fill button → POST /autofill → animates new values populating cells
  - Submit button → confirmation dialog (Radix AlertDialog) → POST /submit

COMPONENT BREAKDOWN:
  1. TimesheetWeekly.tsx — main page
  2. TimesheetGrid.tsx — the actual table
  3. TimesheetCell.tsx — individual editable cell with debounced save
  4. TimesheetStatusBadge.tsx — reusable status badge
  5. WeekNavigator.tsx — week selector with arrow navigation
  6. AddTaskToTimesheetDialog.tsx — dialog to pick a task to add a new row

ZUSTAND STORE (frontend/src/store/timesheetStore.ts):
  - currentWeekStart: string (ISO date, Monday)
  - draftEdits: Record<logId, { hours, notes }> (pending saves)
  - isSaving: boolean
  - setWeek(weekStart): action

---

CREATE frontend/src/features/timesheets/TimesheetApproval.tsx (PM view)

LAYOUT:
  - Filters row: week picker, status filter (All/Draft/Submitted/Approved/Rejected), member filter dropdown
  - Table (using @tanstack/react-table): columns = Member Name | Week | Total Hours | Status | Submitted At | Actions
  - Actions per row:
      * SUBMITTED status: "Approve" (green) and "Reject" (red) buttons
      * Click Approve → confirm dialog → POST /approve
      * Click Reject → modal with textarea for reason → POST /reject
      * Any status: "View Details" → slide-over showing the full timesheet grid (read-only)
  - Batch actions: select multiple submitted timesheets → "Approve All Selected" button
  - "Export Payroll CSV" button (top right): triggers GET /payroll-export → file download

DATA FETCHING:
  - useQuery(['timesheets', workspaceId, filters], () => api.get('/workspaces/:id/timesheets?...'))
  - Listen to Socket.io: 'timesheet:submitted' → show toast "New timesheet submitted by [name]" + invalidate query

ADD ROUTES:
  <Route path="/timesheets" element={<TimesheetWeekly />} />
  <Route path="/timesheets/approval" element={<TimesheetApproval />} />
  (Approval route: only accessible to PROJECT_MANAGER, ADMIN, OWNER)

ADD TO SIDEBAR:
  - "My Timesheet" link (clock icon) → /timesheets
  - "Timesheet Approval" link (check-circle icon) → /timesheets/approval (only visible to PMs)

OUTPUT: Complete timesheet frontend — weekly grid with live edits, approval dashboard, and Socket.io integration.
```

---

---

# ══════════════════════════════════════════
# PHASE 3 — VISIBILITY & REPORTING
# ══════════════════════════════════════════

---

## PROMPT 3A — Portfolio & Program Management (Full Stack)

```
TASK: Build the complete Portfolio & Program management feature — full backend + frontend.

--- BACKEND ---

PART 1 — REPOSITORIES
Create backend/src/repositories/portfolio.repository.ts:
  - createPortfolio(ownerId, data): insert into portfolios
  - getPortfoliosByUser(userId): portfolios where owner_id = userId
  - getPortfolioById(id): with programs and program_projects joined
  - updatePortfolio(id, data): name, description, color, status
  - deletePortfolio(id, ownerId): hard delete (cascade handles programs)
  - createProgram(portfolioId, data): insert into programs
  - getProgramsByPortfolio(portfolioId): list programs
  - addProjectToProgram(programId, workspaceId): insert program_projects
  - removeProjectFromProgram(programId, workspaceId): delete program_projects row
  - getPortfolioDashboard(portfolioId): complex JOIN returning:
      {
        portfolio: { id, name, color, status },
        totalProjects: number,
        totalTasks: number,
        completedTasks: number,
        overallCompletionPercent: number,
        projectHealth: Array<{
          workspaceId, workspaceName,
          totalTasks, completedTasks, completionPercent,
          overdueTasks: number,
          health: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK'
          -- ON_TRACK: completion >= 70% or no overdue; AT_RISK: some overdue; OFF_TRACK: completion < 30%
        }>,
        upcomingMilestones: Array<{ title, dueDate, workspaceName, isComplete }>,
        totalBudget: number,   -- sum of all cost_rates × estimated_hours across projects
        spentBudget: number,   -- sum of hours_logged × cost_rates across projects
      }

PART 2 — SERVICE
Create backend/src/services/portfolio.service.ts:
  - createPortfolio(userId, data): create + return
  - getPortfolioDashboard(portfolioId, userId): 
      1. Check Redis cache (TTL 300s)
      2. Fetch from repo
      3. Return with cache set
  - addProjectToProgram(programId, workspaceId, userId): 
      1. Verify user is OWNER of the portfolio
      2. Verify user is also OWNER/ADMIN of the workspace being added
      3. Insert
  - (other CRUD methods following same pattern)

PART 3 — ROUTES (Create routes/portfolio.routes.ts + controller):
  POST   /api/portfolios                           — create portfolio
  GET    /api/portfolios                           — list user's portfolios
  GET    /api/portfolios/:id                       — get portfolio with programs
  PATCH  /api/portfolios/:id                       — update
  DELETE /api/portfolios/:id                       — delete
  GET    /api/portfolios/:id/dashboard             — portfolio dashboard data (cached)
  POST   /api/portfolios/:id/programs              — create program
  GET    /api/portfolios/:id/programs              — list programs
  POST   /api/programs/:id/projects                — add workspace to program, body: { workspaceId }
  DELETE /api/programs/:id/projects/:workspaceId   — remove workspace from program

--- FRONTEND ---

CREATE frontend/src/features/portfolios/:
  PortfolioList.tsx:
    - Grid of portfolio cards (color-coded by portfolio.color)
    - Each card: portfolio name, description, project count, overall health badge
    - "Create Portfolio" button → opens CreatePortfolioDialog
    - Card click → navigate to /portfolios/:id

  PortfolioDashboard.tsx:
    - Header: portfolio name + color chip + status badge + edit button
    - Top stats row (4 cards): Total Projects | Total Tasks | Completion % | Budget Consumed
    - Project Health Table: one row per project showing:
        * Project name, task completion progress bar, health badge (green/yellow/red), overdue count
    - Upcoming Milestones widget: timeline of next 5 milestones across all projects
    - Budget waterfall bar chart (Recharts BarChart): planned vs actual spend per project
    - "Manage Programs" section: list of programs, each with their assigned projects as chips

  PortfolioRoadmap.tsx:
    - Gantt-style timeline showing ALL projects in portfolio as horizontal bars
    - Each bar = a workspace (project), spanning its earliest task.start_date to latest task.due_date
    - Milestones shown as diamond markers on each project bar
    - Zoom: Quarter | Month | Week

  CreatePortfolioDialog.tsx: name, description, color picker (react-colorful)
  AddProjectToProgram.tsx: select workspace from user's workspaces list

ZUSTAND STORE (portfolioStore.ts):
  - portfolios: Portfolio[]
  - activePortfolioId: string | null
  - setActivePortfolio(id): action

ADD ROUTES:
  /portfolios          → PortfolioList
  /portfolios/:id      → PortfolioDashboard
  /portfolios/:id/roadmap → PortfolioRoadmap

ADD TO SIDEBAR: "Portfolios" nav item with Briefcase icon (above existing Workspaces section)

OUTPUT: Full portfolio management — backend (repo + service + routes) + frontend (list, dashboard, roadmap).
```

---

## PROMPT 3B — Reporting Engine (Full Stack)

```
TASK: Build the complete reporting engine — on-demand report generation, export to PDF/DOCX/XLSX, saved templates, and scheduled reports.

Install backend: npm install exceljs docx @react-pdf/renderer
Install frontend: (no new packages needed — use existing TanStack Table)

--- BACKEND ---

PART 1 — REPORT DATA SERVICES
Create backend/src/services/report.service.ts with data fetchers for each report type:

  getStatusReportData(workspaceId, dateFrom?, dateTo?):
    Returns: {
      workspace: { name, memberCount },
      taskSummary: { total, todo, inProgress, done, overdue },
      completionTrend: Array<{ week: string, completed: number }>,  -- last 8 weeks
      topBlockers: Array<{ taskTitle, daysSinceCreated, assignee }>,  -- IN_PROGRESS tasks past due
      upcomingDeadlines: Array<{ taskTitle, dueDate, assignee, priority }>,
    }

  getTimeVarianceData(workspaceId, dateFrom, dateTo):
    Returns: {
      summary: { totalEstimatedHours, totalLoggedHours, varianceHours, variancePercent },
      byTask: Array<{ taskId, taskTitle, estimatedHours, loggedHours, variance }>,
      byMember: Array<{ userId, name, estimatedHours, loggedHours, variance }>,
    }

  getCostReportData(workspaceId, dateFrom, dateTo):
    Returns: {
      summary: { budgetedCost, actualCost, variance, cpi },  -- cost performance index
      byProject: Array<{ workspaceName, budgeted, actual }>,
      byMember: Array<{ name, hourlyRate, hoursLogged, cost }>,
    }

  getResourceAvailabilityData(workspaceId, dateFrom, dateTo):
    Returns availability grid data (reuse resource.service.getResourceGrid())

  getTimesheetReportData(workspaceId, dateFrom, dateTo, userId?):
    Returns: {
      rows: Array<{ userName, weekStart, totalHours, status, taskBreakdown: Array<{taskTitle, hours}> }>
    }

PART 2 — EXPORT GENERATORS
Create backend/src/services/export/:
  
  excelExporter.ts:
    generateExcel(reportType, data, fileName):
      - Uses ExcelJS to create styled workbook
      - Header row: bold, brand color background (#1E3A5F), white text
      - Alternating row colors
      - Auto-fit column widths
      - Freeze header row
      - Add summary sheet for status/cost reports
      - Returns Buffer

  pdfExporter.ts:
    generatePdf(reportType, data, fileName):
      - Uses puppeteer OR @react-pdf/renderer
      - Clean table layout with header + data rows
      - Company name "TaskMaster" watermark in footer
      - Page numbers
      - Returns Buffer

  docxExporter.ts:
    generateDocx(reportType, data, fileName):
      - Uses docx npm package (same approach as this PRD document)
      - Proper heading + table structure
      - Returns Buffer

PART 3 — BullMQ REPORT WORKER
Add 'report-generation' queue.
Create backend/src/workers/reportWorker.ts:
  Job data: { reportType, workspaceId, format, config, requesterId, templateId? }
  Process:
    1. Fetch report data using appropriate data service
    2. Generate file using appropriate exporter
    3. Upload Buffer to S3 (use existing s3.service.ts)
    4. Insert row into generated_reports table
    5. Emit Socket.io 'report:ready' event to user's personal room with { reportId, downloadUrl }
    6. Send email with download link

Add report schedule cron:
  Check report_schedules where next_run_at <= NOW() and is_active = true
  For each: enqueue report-generation job, update next_run_at

PART 4 — ROUTES
Create routes/report.routes.ts:
  POST   /api/workspaces/:workspaceId/reports/generate
         Body: { reportType, format: 'PDF'|'DOCX'|'XLSX', config?: {}, dateFrom?, dateTo? }
         Returns: { jobId, message: 'Report generation started. You will be notified when ready.' }
         Permission: report:generate

  GET    /api/workspaces/:workspaceId/reports/status/:jobId
         Returns BullMQ job status for polling (WAITING/ACTIVE/COMPLETED/FAILED)

  GET    /api/workspaces/:workspaceId/reports
         Returns list of generated_reports for this workspace
         Permission: report:generate

  GET    /api/workspaces/:workspaceId/report-templates
         Permission: report:generate

  POST   /api/workspaces/:workspaceId/report-templates
         Body: { name, reportType, config }
         Permission: report:manage

  DELETE /api/workspaces/:workspaceId/report-templates/:id
         Permission: report:manage

--- FRONTEND ---

CREATE frontend/src/features/reports/ReportBuilder.tsx:
  - Sidebar: Report Type selector (Status | Time Variance | Cost | Resource | Timesheet)
  - Config panel: date range picker, optional member filter, optional project filter
  - Preview section: shows a live preview table using TanStack Table with the report structure
  - Export buttons: "Export PDF" | "Export Excel" | "Export Word"
  - Click export → POST /reports/generate → show "Generating..." toast
  - Listen to Socket.io 'report:ready' → show success toast with "Download" link

CREATE frontend/src/features/reports/ReportTemplates.tsx:
  - List of saved report templates (name, type, last generated)
  - "Run Report" button per template → triggers generation
  - "Delete Template" button
  - "Save Current Config as Template" from ReportBuilder

CREATE components/ReportGenerationStatus.tsx:
  - Floating notification (bottom-right) that appears when a report is generating
  - Progress indicator (spinner)
  - Auto-dismisses 5s after download link appears

ADD ROUTES:
  /reports         → ReportBuilder
  /reports/templates → ReportTemplates

ADD TO SIDEBAR: "Reports" nav item with FileText icon

OUTPUT: Full reporting engine — data services, 3 export formats, BullMQ worker, routes, and React frontend.
```

---

## PROMPT 3C — Enhanced Dashboards (Full Stack)

```
TASK: Upgrade the existing dashboard and add Portfolio and Personal dashboards with real-time Socket.io updates and Recharts visualizations.

Install frontend: npm install recharts
(recharts should already be available or add it)

--- BACKEND ---

Add these endpoints to a new dashboard.service.ts:

  getProjectDashboard(workspaceId):
    Returns (cache TTL 60s):
    {
      stats: {
        totalTasks: number,
        completedTasks: number,
        inProgressTasks: number,
        overdueTasks: number,
        completionPercent: number,
        totalEstimatedHours: number,
        totalLoggedHours: number,
        teamSize: number,
      },
      tasksByStatus: [{ status, count }],           -- for donut chart
      tasksByPriority: [{ priority, count }],       -- for bar chart
      completionTrend: [{ week: string, completed: number, created: number }],  -- 8 weeks
      budgetBurn: [{ date: string, planned: number, actual: number }],          -- 12 data points
      teamVelocity: [{ week: string, tasksCompleted: number }],                 -- 8 weeks
      upcomingDeadlines: Task[],   -- next 7 days, limit 10
      recentActivity: TaskActivity[],  -- last 20 activities with user details
    }

  getPersonalDashboard(userId, workspaceId):
    Returns:
    {
      myTasks: { total, overdue, dueToday, dueThisWeek, completedThisWeek },
      myHoursThisWeek: number,   -- from time_logs for current week
      myAssignedTasks: Task[],   -- open tasks assigned to me, limit 10
      myUpcomingDeadlines: Task[],
    }

ADD ROUTES (to existing workspace routes or new dashboard.routes.ts):
  GET /api/workspaces/:workspaceId/dashboard    (cached 60s)
  GET /api/workspaces/:workspaceId/dashboard/personal  (cached 30s)

Invalidate dashboard cache on: task CRUD, time log changes.

--- FRONTEND ---

UPGRADE frontend/src/features/dashboard/DashboardOverview.tsx:

LAYOUT (Project Dashboard):
  Top stats row — 4 stat cards with icons:
  [Total Tasks] [Completed] [Overdue 🔴] [Team Members]
  
  Second row — 2 cards:
  LEFT: Task Status Donut Chart (Recharts PieChart)
    - 3 segments: TODO (blue), IN PROGRESS (amber), DONE (green)
    - Center label: "X% Complete"
  RIGHT: Team Velocity Bar Chart (Recharts BarChart)
    - X axis: last 8 weeks
    - Y axis: tasks completed
    - Bar color: brand blue

  Third row — 2 cards:
  LEFT: Budget Burn Area Chart (Recharts AreaChart)
    - Two areas: Planned (blue, dashed outline) and Actual (green, filled)
    - X axis: dates
    - Y axis: cost ($)
    - If no cost rates configured: show "Configure cost rates to see budget tracking" placeholder
  RIGHT: Upcoming Deadlines
    - List of tasks due in next 7 days
    - Each item: priority color dot | task title | due date chip | assignee avatar
    - Overdue items show red date chip
    - "View All" link → /tasks with due date filter

  Fourth row (full width): Recent Activity Feed
    - Timeline list of last 20 activities
    - Each: user avatar | action description | task link | relative time
    - Real-time: Socket.io 'task:activity' events prepend new items

ADD Personal Dashboard tab:
  - Tab toggle at top: "Project Overview" | "My Work"
  - My Work tab shows:
    - My stats: My Tasks | Due Today | This Week | Completed This Week
    - My Tasks list (TanStack Table, filterable by status/priority)
    - My Hours This Week: big number with progress bar vs 40h target

REAL-TIME BEHAVIOR:
  All chart data auto-refreshes when these Socket.io events arrive:
  - 'task:created', 'task:updated', 'task:deleted' → invalidate ['dashboard', workspaceId]
  - 'timelog:added' → invalidate ['dashboard:personal', workspaceId, userId]
  
  Use React Query's staleTime: 60_000 (1 min) to avoid over-fetching.

LOADING STATES:
  - While dashboard data loads: show skeleton placeholders for each card
  - Chart loading: shimmer effect in the chart container box

EMPTY STATES:
  - New workspace (0 tasks): show onboarding prompt "Create your first task to see project insights"
  - No cost data: budget chart shows placeholder with configure prompt

OUTPUT: Enhanced project dashboard + personal dashboard tab, all with Recharts charts, real-time Socket.io updates, and proper loading/empty states. Also update existing DashboardOverview.tsx to use the new dashboard API endpoint instead of any existing stats fetching logic.
```

---

---

# ══════════════════════════════════════════
# QUICK REFERENCE — PHASE SUMMARY
# ══════════════════════════════════════════

| Prompt | What Gets Built | Est. Time |
|--------|----------------|-----------|
| 1A | 12 new DB tables + indexes (all migrations) | 1 session |
| 1B | RBAC expansion + pagination + Redis cache | 1 session |
| 1C | Task dependencies API + critical path worker | 1 session |
| 1D | Gantt chart frontend | 1–2 sessions |
| 2A | Resource management full backend | 1–2 sessions |
| 2B | Resource grid frontend | 1–2 sessions |
| 2C | Timesheets full backend | 1 session |
| 2D | Timesheets frontend | 1–2 sessions |
| 3A | Portfolio & program management (full stack) | 1–2 sessions |
| 3B | Reporting engine (full stack) | 2 sessions |
| 3C | Enhanced dashboards (full stack) | 1 session |

> TIP: Agar kisi prompt ke beech mein AI stuck ho jaye ya kuch chhoot jaye,
> wahi section ka part number bolo jaise "2C ka PART 3 dobara karo" — 
> toh vo sirf usi hisse ko regenerate karega.
