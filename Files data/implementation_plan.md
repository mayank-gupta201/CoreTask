# Database Schema Extension (Migrations 007–012)

This plan outlines the specific database DDL and Drizzle schema changes exactly as detailed in the "PROMPT 1A" specification, migrating the TaskMaster platform toward a mature Enterprise PPM.

## User Review Required

> [!IMPORTANT]
> This plan strictly follows your provided schema. Note that some existing fields in `tasks` (like the single `assignedTo` relationship) will be superseded by the new `task_assignments` multiple-assignment relationship. Please approve so I can overwrite `schema.ts` and run the generator.

## Proposed Changes

### Phase 1: Database Schema Expansion

#### [MODIFY] [schema.ts](file:///c:/Users/gupta/OneDrive/Desktop/CoreTask/backend/src/db/schema.ts)
I will systematically inject or overwrite the definitions in `schema.ts` to strictly match:

1. **Portfolio Management**:
   - `portfolios` (add `color`, `status` ACTIVE/ARCHIVED).
   - `programs` (status active, start/end dates).
   - `program_projects` (Many-to-many join table linking programs and workspaces/projects).
   - `milestones` (table with `isComplete`, `dueDate`).
2. **Dependency Planning**:
   - `task_dependencies` (replacing existing basic block with `dependencyType` FS/SS/FF/SF, and `lagDays`).
   - `project_baselines` (snapshot tracking via JSONB).
3. **Resource Management**:
   - `task_assignments` (replacing tasks `assignedTo` with a true many-to-many allocation).
   - `resource_availability` (tracking daily hours on effective dates).
   - `holidays` (with recurring flags and region scopes).
   - `user_cost_rates` (abstracting cost out of workspace member into a historical tracking table).
4. **Timesheets (Overhaul)**:
   - `timesheets` (adding week_start/end strict constraints).
   - `time_logs` (linking directly to timesheet with distinct `hours` decimal layout).
5. **Reporting**:
   - `report_templates`, `report_schedules`, `generated_reports`.
6. **Task Enhancements**:
   - Add `startDate` (timestamp) and update `estimatedHours` to (decimal(5,2)).

### Phase 2: Indexing and Relational Mapping
- Drizzle `index()` arrays will be injected into all heavily-queried foreign keys (`tasks.workspaceId`, `task_assignments`, `timesheets`, `task_dependencies`).
- `relations()` mappings will be completely rebuilt to satisfy Drizzle ORM query bindings (e.g. `portfolios` → `programs`, `workspaces` → `timesheets`).

## Verification Plan
1. Directly modify `backend/src/db/schema.ts`.
2. Execute `bun run db:generate`.
3. Provide the explicit documentation and terminal output for your review.
