<p align="center">
  <h1 align="center">🚀 CoreTask</h1>
  <p align="center">
    <strong>Enterprise-Grade Project & Portfolio Management Platform</strong>
  </p>
  <p align="center">
    A full-stack, real-time task management system engineered for teams that demand visibility, control, and performance at scale.
  </p>
  <p align="center">
    <a href="#tech-stack"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 5"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Bun-Runtime-F9F1E1?style=for-the-badge&logo=bun&logoColor=black" alt="Bun"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 15"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis 7"/></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Socket.io-Realtime-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"/></a>
  </p>
</p>

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [RBAC & Permissions](#rbac--permissions)
- [Background Workers](#background-workers)
- [Real-Time Events](#real-time-events)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**CoreTask** is an enterprise project portfolio management (PPM) platform that combines task management, resource planning, Gantt scheduling, and real-time collaboration into a single cohesive system. It is built on a modern, high-performance stack using the Bun runtime, React 19, Express 5, and PostgreSQL — designed to handle the demands of engineering teams at scale.

### Why CoreTask?

| Problem | CoreTask Solution |
|---|---|
| Scattered task tracking | Unified workspace with Kanban, List, and Gantt views |
| No resource visibility | Resource grid with daily allocation tracking and overallocation alerts |
| Slow, stale dashboards | Redis-cached aggregations with real-time WebSocket updates |
| Rigid role systems | 6-tier RBAC with granular permission matrix |
| Manual dependency tracking | Automated CPM (Critical Path Method) computation via background workers |
| No scheduling intelligence | BullMQ workers for utilization analysis and recurring task generation |

---

## Key Features

### 📋 Task Management
- **CRUD Operations** with soft-delete support (`deleted_at` timestamps)
- **Kanban Board** with drag-and-drop via `@dnd-kit`
- **Subtask Hierarchy** via self-referencing parent-child relationships
- **Recurring Tasks** (Daily / Weekly / Monthly) processed by background workers
- **Task Templates** for repeatable workflows
- **File Attachments** with AWS S3 presigned URLs
- **Activity Feed** tracking status, priority, and assignment changes in real-time

### 📊 Gantt Chart & Dependencies
- **Interactive Gantt View** with `gantt-task-react` integration
- **Task Dependencies** (FS, SS, FF, SF) with lag day support
- **Circular Dependency Detection** via PostgreSQL recursive CTE
- **Critical Path Method (CPM)** computed asynchronously with BullMQ
  - Forward & backward pass scheduling
  - Zero-float critical path identification
  - Results cached in Redis and pushed via WebSocket

### 👥 Resource Management
- **Task Assignments** with allocation percentage tracking
- **Resource Grid** showing daily allocation per user over date ranges
- **Overallocation Detection** (>100%) with proactive WebSocket alerts
- **Availability Management** with effective date ranges
- **Holiday Calendar** with recurring holiday support
- **User Cost Rates** with effective-from date tracking

### 🏢 Portfolio & Program Management (PPM)
- **Portfolio → Program → Project** hierarchy
- **Project Milestones, Risks, Expenses, and Allocations**
- **Project Dependencies** between related projects
- **Baseline Snapshots** for schedule variance analysis

### 🔐 Security & Access Control
- **JWT Authentication** with refresh token rotation
- **Google OAuth 2.0** via Passport.js
- **Email Verification** and **Password Reset** flows
- **6-Tier RBAC**: Owner → Admin → Project Manager → Resource Manager → Member → Viewer
- **Granular Permission Matrix** with 20+ permission strings
- **Helmet** security headers + **Rate Limiting** on all API routes
- **Audit Logging** for critical operations

### ⚡ Performance & Scalability
- **Redis Caching** with TTL-based invalidation and pattern-based cache busting
- **Cursor-Based Pagination** for efficient large dataset traversal
- **BullMQ Background Workers** for CPU-intensive computations
- **Socket.io** for real-time event propagation across workspace rooms
- **PM2 Cluster Mode** for production multi-core utilization

### 🤖 AI-Powered Features
- **AI Task Breakdown** — submit a goal and receive AI-generated subtask suggestions via Google Gemini
- **AI Chat Assistant** for project-related queries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19 + Vite)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Dashboard │ │  Tasks   │ │  Gantt   │ │   PPM Suite   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       └─────────────┴────────────┴──────────────┘           │
│                    TanStack Query + Zustand                 │
│                    Socket.io Client + Axios                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Express 5 + Bun)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Routes  │→│  Middlew  │→│ Controll │→│   Services   │   │
│  │          │ │ Auth/RBAC │ │   lers   │ │              │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────┬───────┘   │
│                                                 │           │
│            ┌────────────────┬────────────────────┤           │
│            ▼                ▼                    ▼           │
│     ┌────────────┐  ┌─────────────┐     ┌─────────────┐    │
│     │Repositories│  │  BullMQ     │     │  Socket.io  │    │
│     │  (Drizzle) │  │  Workers    │     │   Server    │    │
│     └─────┬──────┘  └──────┬──────┘     └─────────────┘    │
└───────────┼────────────────┼────────────────────────────────┘
            ▼                ▼
     ┌─────────────┐  ┌─────────────┐
     │ PostgreSQL  │  │    Redis    │
     │   (Neon)    │  │    Cache    │
     └─────────────┘  └─────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework with latest concurrent features |
| **Vite 7** | Lightning-fast dev server and build tool |
| **TypeScript 5.9** | Type-safe development |
| **TailwindCSS 4** | Utility-first CSS framework |
| **TanStack Query** | Server state management with caching |
| **Zustand** | Lightweight client state management |
| **React Router 7** | Client-side routing |
| **@dnd-kit** | Drag-and-drop for Kanban board |
| **gantt-task-react** | Interactive Gantt chart rendering |
| **Recharts** | Dashboard analytics charts |
| **Radix UI** | Accessible, unstyled component primitives |
| **Socket.io Client** | Real-time event subscriptions |
| **Lucide React** | Icon library |
| **React Hook Form + Zod** | Form management with schema validation |

### Backend
| Technology | Purpose |
|---|---|
| **Bun** | JavaScript runtime (replaces Node.js) |
| **Express 5** | HTTP framework with async route support |
| **TypeScript 5.9** | Type-safe server development |
| **Drizzle ORM** | Type-safe SQL query builder & migrations |
| **PostgreSQL 15** | Primary relational database |
| **Redis 7 + ioredis** | Caching, queue broker, & session store |
| **BullMQ** | Distributed job queue for background workers |
| **Socket.io** | Real-time bidirectional event-based communication |
| **Zod** | Runtime schema validation for API requests |
| **JWT + Passport.js** | Authentication (local + Google OAuth) |
| **Helmet** | HTTP security headers |
| **Pino** | Structured JSON logging |
| **Nodemailer** | Transactional email delivery |
| **AWS S3** | File attachment storage with presigned URLs |
| **PM2** | Production process manager (cluster mode) |

### DevOps
| Technology | Purpose |
|---|---|
| **GitHub Actions** | CI/CD pipeline (lint, test, deploy) |
| **Docker** | Containerized production builds |
| **Drizzle Kit** | Database migration management |
| **Vitest** | Backend unit testing |

---

## Project Structure

```
CoreTask/
├── .github/
│   └── workflows/
│       └── main.yml                # CI/CD pipeline
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── permissions.ts      # RBAC permission matrix
│   │   ├── controllers/            # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── task.controller.ts
│   │   │   ├── dependency.controller.ts
│   │   │   ├── resource.controller.ts
│   │   │   ├── portfolio.controller.ts
│   │   │   ├── ppm.controller.ts
│   │   │   └── ...
│   │   ├── db/
│   │   │   ├── schema.ts           # Drizzle ORM schema (30+ tables)
│   │   │   ├── index.ts            # Database connection
│   │   │   └── migrations/         # SQL migration files
│   │   ├── errors/                 # RFC 7807 Problem Details
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts   # JWT verification
│   │   │   ├── permission.middleware.ts  # RBAC enforcement
│   │   │   ├── workspace.middleware.ts
│   │   │   ├── validate.middleware.ts    # Zod validation
│   │   │   ├── rateLimiter.middleware.ts
│   │   │   └── logger.middleware.ts      # Pino structured logging
│   │   ├── queue/
│   │   │   └── index.ts            # BullMQ queue definitions
│   │   ├── repositories/           # Data access layer
│   │   │   ├── task.repository.ts
│   │   │   ├── dependency.repository.ts
│   │   │   ├── resource.repository.ts
│   │   │   └── ...
│   │   ├── routes/                 # Express route definitions
│   │   │   ├── index.ts            # Route aggregator
│   │   │   ├── task.routes.ts
│   │   │   ├── dependency.routes.ts
│   │   │   ├── resource.routes.ts
│   │   │   └── ...
│   │   ├── services/               # Business logic layer
│   │   │   ├── task.service.ts
│   │   │   ├── dependency.service.ts
│   │   │   ├── resource.service.ts
│   │   │   ├── cache.service.ts    # Redis caching abstraction
│   │   │   ├── ai.service.ts       # Google Gemini integration
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── pagination.ts       # Cursor-based pagination
│   │   ├── workers/
│   │   │   ├── criticalPathWorker.ts    # CPM computation
│   │   │   ├── utilizationWorker.ts     # Resource overallocation detection
│   │   │   ├── recurringTaskWorker.ts   # Nightly recurring task generation
│   │   │   └── index.ts
│   │   ├── socket.ts               # Socket.io server setup
│   │   └── index.ts                # Application entry point
│   ├── Dockerfile
│   ├── drizzle.config.ts
│   ├── ecosystem.config.js         # PM2 cluster config
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/                    # Axios instance & API helpers
│   │   ├── components/             # Shared UI components (shadcn/ui)
│   │   ├── features/
│   │   │   ├── auth/               # Login, Register, OAuth, Password Reset
│   │   │   ├── dashboard/          # Analytics overview
│   │   │   ├── tasks/              # TaskList, TaskSheet (Kanban + List)
│   │   │   ├── gantt/              # GanttView (interactive chart)
│   │   │   ├── ppm/                # Portfolio/Program management
│   │   │   ├── templates/          # Task template management
│   │   │   └── workspaces/         # Workspace selection & settings
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── layouts/                # DashboardLayout with sidebar
│   │   ├── lib/                    # Utility functions
│   │   ├── store/                  # Zustand stores (auth, workspace)
│   │   ├── App.tsx                 # Route definitions
│   │   └── main.tsx                # React entry point
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| [Bun](https://bun.sh) | v1.0+ |
| [PostgreSQL](https://www.postgresql.org/) | 15+ |
| [Redis](https://redis.io/) | 7+ |

### 1. Clone the Repository

```bash
git clone https://github.com/mayank-gupta201/CoreTask.git
cd CoreTask
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
bun install

# Configure environment variables (see section below)
cp .env.example .env
# Edit .env with your database, Redis, and API credentials

# Run database migrations
bun run db:push

# Start development server (with hot-reload)
bun run dev
```

The backend will start on **http://localhost:4000**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
bun install

# Start development server
bun run dev
```

The frontend will start on **http://localhost:5173**.

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/coretask

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# SMTP Email (for verification & password reset)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# AWS S3 (for file attachments)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Google Gemini AI (for AI features)
GEMINI_API_KEY=your-gemini-api-key

# Server
PORT=4000
NODE_ENV=development
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login with email/password |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET` | `/api/auth/verify-email` | Verify email address |
| `GET` | `/api/auth/google` | Google OAuth login |

### Workspaces
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workspaces` | List user's workspaces |
| `POST` | `/api/workspaces` | Create workspace |
| `POST` | `/api/workspaces/:id/invite` | Invite member |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List tasks (cursor-paginated) |
| `POST` | `/api/tasks` | Create task |
| `GET` | `/api/tasks/:id` | Get task details |
| `PUT` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Soft-delete task |
| `GET` | `/api/tasks/:id/subtasks` | List subtasks |
| `POST` | `/api/tasks/:id/generate-subtasks` | AI-generate subtasks |

### Dependencies & Gantt
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/workspaces/:wId/tasks/:tId/dependencies` | Create dependency |
| `DELETE` | `/api/workspaces/:wId/dependencies/:dId` | Delete dependency |
| `GET` | `/api/workspaces/:wId/gantt` | Get full Gantt data |

### Resource Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/workspaces/:wId/tasks/:tId/assignments` | Assign user to task |
| `DELETE` | `/api/workspaces/:wId/tasks/:tId/assignments/:uId` | Remove assignment |
| `GET` | `/api/workspaces/:wId/resources?dateFrom&dateTo` | Resource grid data |
| `PUT` | `/api/workspaces/:wId/resources/:uId/availability` | Set availability |
| `PUT` | `/api/workspaces/:wId/resources/:uId/cost-rate` | Set cost rate |
| `GET` | `/api/workspaces/:wId/holidays?year` | List holidays |
| `POST` | `/api/workspaces/:wId/holidays` | Create holiday |
| `DELETE` | `/api/workspaces/:wId/holidays/:hId` | Delete holiday |

### Portfolios & PPM
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portfolios` | List portfolios |
| `POST` | `/api/portfolios` | Create portfolio |
| `GET/POST/PUT` | `/api/portfolios/:id/projects` | Manage projects |

### Webhooks
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/github` | GitHub webhook (auto-update task status on PR merge) |

---

## Database Schema

CoreTask uses a rich relational schema with **30+ tables** managed by Drizzle ORM. Key entities include:

```
users ─────────────┐
                    │ 1:N
workspace_members ──┼── workspaces ──── portfolios ── programs ── projects
                    │                        │
                    │                   project_milestones
                    │                   project_risks
                    │                   project_expenses
                    │
tasks ──────────────┤
  ├── task_assignments (N:M with users)
  ├── task_dependencies (predecessor ↔ successor)
  ├── task_activities (audit trail)
  ├── task_attachments (S3 files)
  └── parent_task_id (self-referencing subtasks)

resource_availability ── per user, per workspace
holidays ── workspace-wide calendar
user_cost_rates ── effective-dated billing rates
timesheets ── time_logs (weekly submission/approval)
report_templates ── report_schedules ── generated_reports
audit_logs ── system-wide activity tracking
```

---

## RBAC & Permissions

CoreTask implements a **6-tier role-based access control** system with a granular permission matrix:

| Permission | Owner | Admin | PM | RM | Member | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `workspace:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `portfolio:create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `task:create` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `task:delete` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `task:assign` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `dependency:manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `resource:manage` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `resource:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `timesheet:approve` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `timesheet:submit` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `report:manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `dashboard:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Roles expand from **Viewer** (read-only) → **Owner** (full control). The `checkPermission` middleware enforces access at the route level.

---

## Background Workers

CoreTask uses **BullMQ** with Redis for asynchronous job processing:

| Worker | Queue | Trigger | What It Does |
|---|---|---|---|
| **Critical Path** | `criticalPathQueue` | Dependency created/deleted | Runs CPM algorithm (Kahn's topological sort + forward/backward pass), caches zero-float critical path task IDs in Redis, emits WebSocket update |
| **Utilization** | `utilizationQueue` | Assignment created/removed/availability changed | Calculates daily allocation % per user over 180-day window, detects overallocation (>100%), emits proactive alerts |
| **Recurring Tasks** | `recurringTasksQueue` | Cron (midnight daily) | Scans tasks with `recurrence_rule`, creates new instances for the next cycle |
| **Email** | `emailQueue` | User registration, password reset | Sends transactional emails via Nodemailer |

---

## Real-Time Events

CoreTask uses **Socket.io** for real-time event propagation. Clients join workspace rooms and receive targeted broadcasts:

| Event | Payload | Emitted When |
|---|---|---|
| `taskCreated` | `task` | New task created |
| `taskUpdated` | `task` | Task fields updated |
| `taskDeleted` | `{ id, workspaceId }` | Task soft-deleted |
| `taskActivityCreated` | `{ taskId, activity }` | Status/priority/assignment change logged |
| `dependency:created` | `{ dependency }` | New task dependency added |
| `dependency:deleted` | `{ dependencyId }` | Dependency removed |
| `critical-path:updated` | `{ workspaceId, criticalPathTaskIds }` | CPM worker completes recomputation |
| `assignment:created` | `{ taskId, userId, allocationPercent }` | User assigned to task |
| `assignment:removed` | `{ taskId, userId }` | Assignment deleted |
| `resource:overallocated` | `{ userId, userName, overAllocatedDates }` | User exceeds 100% allocation |

---

## CI/CD Pipeline

CoreTask uses **GitHub Actions** for continuous integration and deployment:

```yaml
# Triggered on: push to main, pull requests to main
Pipeline:
  ├── Lint & Test
  │   ├── Spin up PostgreSQL 15 + Redis 7 services
  │   ├── Install backend deps → Lint → Run Vitest tests
  │   └── Install frontend deps → Type-check → Build
  └── Deploy (on main push only)
      └── Trigger Render deploy hook (or Docker Hub push)
```

---

## Deployment

### Docker

```bash
cd backend
docker build -t coretask-api .
docker run -p 4000:4000 --env-file .env coretask-api
```

### PM2 (Production)

```bash
cd backend
bun run build
pm2 start ecosystem.config.js --env production
```

The PM2 config runs the API in **cluster mode** across all available CPU cores for maximum throughput.

---

## Scripts Reference

### Backend

```bash
bun run dev          # Start dev server with hot-reload
bun run build        # Compile TypeScript to dist/
bun run start        # Run production build
bun run test         # Run Vitest test suite
bun run lint         # ESLint check
bun run db:generate  # Generate Drizzle migration files
bun run db:push      # Push schema changes to database
```

### Frontend

```bash
bun run dev          # Start Vite dev server (port 5173)
bun run build        # Type-check & production build
bun run preview      # Preview production build locally
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/mayank-gupta201">Mayank Gupta</a>
</p>
