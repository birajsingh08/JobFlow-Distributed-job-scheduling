# 🚀 JobFlow — Distributed Job Scheduler Platform

A **production-grade distributed job scheduling platform** built with NestJS, Next.js 15, PostgreSQL, Redis, and BullMQ primitives. Comparable to BullMQ, Celery, Sidekiq, or AWS SQS workers.

---

## Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend (Next.js 15)"
        FE[Dashboard UI<br/>React 19 + TailwindCSS]
        WS_CLIENT[Socket.io Client<br/>Real-time updates]
    end

    subgraph "Backend (NestJS — Clean Architecture)"
        subgraph "Presentation Layer"
            REST[REST Controllers<br/>Auth/Projects/Queues/Jobs/Workers/Metrics]
            WS[Socket.io Gateway<br/>EventsGateway]
            GUARD[JWT Guards + RBAC]
        end

        subgraph "Application Layer"
            AUTH_SVC[AuthService<br/>JWT + Bcrypt]
            PROJ_SVC[ProjectService<br/>Org + Project CRUD]
            QUEUE_SVC[QueueService<br/>Pause/Resume/Stats]
            JOB_SVC[JobService<br/>Lifecycle + DLQ]
        end

        subgraph "Infrastructure Layer"
            PRISMA[PrismaService<br/>PostgreSQL ORM]
            REDIS_SVC[RedisService<br/>Lua Scripts + Locks]
            WORKER[WorkerEngine<br/>Polling + Claiming]
            SCHEDULER[SchedulerService<br/>Cron + Delayed Jobs]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16<br/>12+ Tables)]
        REDIS[(Redis 7<br/>Sorted Sets + Pub/Sub)]
    end

    FE -->|REST API| REST
    FE -->|WebSocket| WS
    WS_CLIENT --> WS
    REST --> AUTH_SVC
    REST --> PROJ_SVC
    REST --> QUEUE_SVC
    REST --> JOB_SVC
    WS -->|Event Emitter| REST
    AUTH_SVC --> PRISMA
    QUEUE_SVC --> PRISMA
    JOB_SVC --> PRISMA
    JOB_SVC --> REDIS_SVC
    WORKER --> PRISMA
    WORKER --> REDIS_SVC
    SCHEDULER --> PRISMA
    SCHEDULER --> REDIS_SVC
    PRISMA --> PG
    REDIS_SVC --> REDIS
```

## ER Diagram

```mermaid
erDiagram
    User {
        uuid id PK
        string email UK
        string name
        string passwordHash
        enum role
        bool isActive
        datetime createdAt
    }

    RefreshToken {
        uuid id PK
        string token UK
        uuid userId FK
        datetime expiresAt
        datetime revokedAt
    }

    Organization {
        uuid id PK
        string name
        string slug UK
        string description
    }

    OrgMember {
        uuid id PK
        uuid orgId FK
        uuid userId FK
        enum role
    }

    Project {
        uuid id PK
        uuid orgId FK
        string name
        string slug
        string apiKey UK
    }

    Queue {
        uuid id PK
        uuid projectId FK
        string name
        enum status
        int priority
        int maxConcurrency
    }

    RetryPolicy {
        uuid id PK
        uuid queueId FK
        int maxRetries
        enum strategy
        int initialDelay
        int maxDelay
        float backoffMultiple
    }

    Job {
        uuid id PK
        uuid queueId FK
        uuid workerId FK
        string name
        enum type
        enum status
        int priority
        json payload
        string cronExpression
        datetime scheduledAt
        int retryCount
        int maxRetries
    }

    JobExecution {
        uuid id PK
        uuid jobId FK
        uuid workerId FK
        int attempt
        enum status
        int duration
    }

    JobLog {
        uuid id PK
        uuid jobId FK
        string level
        string message
        json metadata
    }

    Worker {
        uuid id PK
        string name
        string hostname
        int pid
        enum status
        datetime lastHeartbeat
    }

    DeadLetterQueue {
        uuid id PK
        uuid jobId FK
        string reason
        json payload
        bool requeued
    }

    User ||--o{ RefreshToken : has
    User ||--o{ OrgMember : belongs
    Organization ||--o{ OrgMember : has
    Organization ||--o{ Project : owns
    Project ||--o{ Queue : has
    Queue ||--o| RetryPolicy : has
    Queue ||--o{ Job : contains
    Job ||--o{ JobExecution : has
    Job ||--o{ JobLog : has
    Job ||--o| DeadLetterQueue : "may go to"
    Worker ||--o{ Job : processes
    Worker ||--o{ JobExecution : runs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | TailwindCSS, Shadcn UI |
| State | React Query v5, Zustand |
| Charts | Recharts |
| Real-time | Socket.io (client + server) |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Cache/Queue | Redis 7, BullMQ primitives |
| Auth | JWT, Bcrypt, Refresh tokens |
| API Docs | Swagger (OpenAPI 3) |
| Testing | Jest, Supertest |
| Infrastructure | Docker Compose |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)

### Run with Docker

```bash
git clone <repo>
cd assign
docker compose up --build
```

Services:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Local Development

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
assign/
├── backend/
│   ├── src/
│   │   ├── domain/              # Entities + Repository interfaces
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   ├── application/         # Use cases + DTOs + Services
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── queues/
│   │   │   └── jobs/
│   │   ├── infrastructure/      # Prisma, Redis, Workers, Scheduler
│   │   │   ├── database/
│   │   │   ├── redis/
│   │   │   ├── workers/
│   │   │   ├── scheduler/
│   │   │   └── auth/
│   │   └── presentation/        # Controllers, Gateways, Guards
│   │       ├── controllers/
│   │       ├── gateways/
│   │       ├── guards/
│   │       ├── filters/
│   │       └── interceptors/
│   ├── prisma/schema.prisma
│   └── test/
├── frontend/
│   └── src/
│       ├── app/                 # Next.js App Router
│       │   ├── (dashboard)/     # Protected dashboard pages
│       │   ├── login/
│       │   └── register/
│       ├── components/          # UI components
│       ├── lib/                 # API client, socket, utils
│       └── store/               # Zustand stores
└── docker-compose.yml
```

---

## Key Design Decisions

### 1. Custom Worker Engine (not BullMQ's scheduler)
BullMQ is used only for Redis sorted set primitives. The worker polling, job lifecycle, retry logic, and dead letter queue are all custom-built. This demonstrates distributed systems concepts directly.

### 2. Atomic Job Claiming via Lua Scripts
Jobs are claimed atomically using Redis `ZPOPMIN` + `HSET` in a single Lua script — preventing duplicate execution across distributed workers.

### 3. Clean Architecture
Strict layering: Domain → Application → Infrastructure → Presentation. The domain layer never imports infrastructure; dependency inversion is enforced via interfaces.

### 4. Retry Strategies
Three built-in strategies with jitter:
- **FIXED**: Same delay every retry
- **LINEAR**: Delay grows linearly with attempt count
- **EXPONENTIAL**: Delay doubles each time (with configurable multiplier)

### 5. Graceful Shutdown
Workers drain active jobs (up to 30s timeout) before shutting down, preventing job loss on deployments.

### 6. Stale Job Reclaim
A background process detects workers that haven't sent heartbeats in 60s, marks them offline, and requeues their jobs.

### 7. Real-time via Socket.io
Every domain event (job created/completed/failed, queue paused, worker died) is published via Socket.io to project/queue-specific rooms.

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |

### Organizations & Projects
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/organizations` | List/create orgs |
| GET/PUT/DELETE | `/api/organizations/:id` | Org CRUD |
| POST | `/api/organizations/:id/projects` | Create project |
| GET/PUT/DELETE | `/api/projects/:id` | Project CRUD |

### Queues
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/projects/:id/queues` | List/create |
| GET/PUT/DELETE | `/api/projects/:id/queues/:qid` | Queue CRUD |
| POST | `.../queues/:qid/pause` | Pause |
| POST | `.../queues/:qid/resume` | Resume |
| GET | `.../queues/:qid/stats` | Statistics |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/queues/:qid/jobs` | List/create |
| POST | `/api/queues/:qid/jobs/bulk` | Batch create |
| GET | `/api/queues/:qid/jobs/:jid` | Job details |
| POST | `.../jobs/:jid/retry` | Retry |
| POST | `.../jobs/:jid/cancel` | Cancel |
| GET | `.../jobs/:jid/logs` | Job logs |

### Dead Letter Queue
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/dlq` | List DLQ |
| POST | `/api/projects/:id/dlq/:did/requeue` | Requeue |

### Workers & Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workers` | All workers |
| GET | `/api/workers/active` | Online workers |
| GET | `/api/metrics/dashboard` | System metrics |
| GET | `/api/metrics/project/:id` | Project metrics |
| GET | `/api/metrics/throughput` | Throughput data |

---

## Testing

```bash
# Unit tests
cd backend && npm test

# E2E tests
cd backend && npm run test:e2e

# With coverage
cd backend && npm run test:cov
```

---

## Trade-offs

1. **In-process worker vs separate service**: Worker runs in the same process as the API for simplicity. In production, separate worker instances would be deployed independently.

2. **Job execution simulation**: `runJobHandler()` simulates execution with random delay/failure. In production, handlers would be registered by name and called dynamically.

3. **Single Redis instance**: For production, Redis Cluster or Redis Sentinel would be used for HA.

4. **Metrics collection**: Queue metrics are collected every 5 minutes. For higher resolution, Prometheus + Grafana would be preferable.

---

## Deployment Guide

### Production Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://:password@host:6379
JWT_SECRET=<256-bit-random-secret>
JWT_REFRESH_SECRET=<256-bit-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
```

### Docker Compose (Production)
```bash
docker compose -f docker-compose.yml up -d
```

### Health Checks
- Backend: `GET /api/metrics/dashboard`
- Frontend: `GET /`
