# LUMEN — Government Operations Platform

A working implementation of the **LUMEN Government Web Platform** blueprint: an operational
command center for municipal civic infrastructure — complaint lifecycle management, GIS
operations, departments, workforce, citizens, assets, analytics, AI insights and an
immutable audit trail, all behind role-based access control for 8 staff roles.

## Quick Start

```bash
npm install
npx prisma db push        # creates prisma/lumen.db (SQLite)
npx tsx prisma/seed.ts    # seeds departments, engineers, citizens, complaints, etc.
npm run dev               # http://localhost:3000
```

## Demo Accounts (password: `lumen123`)

| Email | Role | What they see |
|---|---|---|
| superadmin@lumen.gov | Super Admin | Everything incl. monitoring & security |
| admin@lumen.gov | Administrator | Full admin: settings, audit, security |
| commissioner@lumen.gov | Commissioner | Executive oversight: dashboards, analytics, GIS |
| manager@lumen.gov | Department Manager | Water Supply dept scope: complaints, assignment, closure |
| supervisor@lumen.gov | Supervisor | Dept scope: review/approve closures, escalations |
| engineer@lumen.gov | Engineer | Own assignments: start work, mark complete |
| analyst@lumen.gov | Analyst | Analytics, reports, AI insights (read-only ops) |
| auditor@lumen.gov | Auditor | Audit log explorer, citizens, complaints (read-only) |

## What's Implemented (vs. the Blueprint)

- **Public zone** — landing, about, features, FAQ, contact (Part 4)
- **Auth** — credential login, JWT session cookie (jose), audit-logged sign-in/out (Part 5, simplified: no MFA/OTP)
- **RBAC** — 8 roles, role-filtered sidebar (hidden not disabled), server-side route guards, department scoping for DM/Supervisor/Engineer, permission matrix view in Settings (Part 6)
- **Dashboard** — role-adaptive KPIs, intake trend, status donut, category bars (Part 7)
- **Complaints** — CMP refs, full 9-state machine enforced server-side, role-gated transitions, four-eyes closure, escalation with automatic priority bump, assignment drawer, append-only timeline, SLA on-track/at-risk/breached badges, filterable queue, manual intake form (Part 8)
- **GIS** — SVG operations map: open complaints by priority, live engineer layer (permission-gated + audited), at-risk assets (Part 9; production would use Google Maps JS API)
- **Departments / Engineers / Citizens / Assets** — directories, detail pages, budgets/KPIs, skills/ratings/workload, condition tracking (Parts 10–13)
- **Analytics & Reports** — MTTR, SLA compliance, weekly intake vs resolution, per-department reports (Parts 14–15)
- **Notifications** — role-targeted notification center with unread badge (Part 16)
- **AI Insights** — heuristic duplicate detection queue, volume forecast, asset failure-risk table (Part 18)
- **Audit Logs** — immutable explorer; every login, assignment, transition and GIS live-tracking access is recorded (Part 19)
- **Monitoring / Security Center** — service status, latency, threat flags, sessions (Parts 20–21, demo telemetry)

## Architecture Notes (deviations from the blueprint)

The blueprint specifies Next.js + a separate NestJS API + PostgreSQL + Redis + BullMQ.
To keep this build runnable on a laptop with zero external services, it is implemented as a
**single Next.js 16 (App Router) full-stack app**:

- Server Components + Server Actions in place of the separate NestJS REST API
- **Prisma + SQLite** (`prisma/lumen.db`) in place of PostgreSQL — the schema mirrors the blueprint's core entities and ports to Postgres by changing the datasource
- Session JWT in an httpOnly cookie in place of Redis-backed sessions
- Tailwind CSS v4, Recharts, lucide-react per the blueprint's frontend stack

Re-seed anytime with `npx tsx prisma/seed.ts` (wipes and regenerates demo data).
