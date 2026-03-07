# 🍽️ YourTable.top

**SaaS reservation platform for restaurants** — smart table management, floor plan editor, booking widget, gift vouchers, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| **Backend** | Node.js + Express.js + TypeScript |
| **Database** | PostgreSQL (Supabase) + Prisma ORM |
| **Auth** | Supabase Auth (JWT + refresh tokens) |
| **Monorepo** | pnpm workspaces |

## Project Structure

```
yourtable/
├── packages/
│   ├── api/              # Express REST API
│   │   ├── prisma/       # Schema + migrations + seed
│   │   └── src/
│   │       ├── middleware/  # Auth, validation, errors
│   │       ├── routes/      # API route handlers
│   │       ├── services/    # Business logic
│   │       ├── utils/       # Prisma, Supabase, audit
│   │       ├── app.ts       # Express app setup
│   │       └── server.ts    # Entry point
│   ├── web/              # Admin dashboard (React SPA)
│   ├── widget/           # Embeddable booking widget
│   └── shared/           # Types + Zod validation schemas
├── scripts/              # Utility scripts
├── .env.example          # Environment template
├── pnpm-workspace.yaml
└── package.json
```

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Supabase** account (free tier works) → [supabase.com](https://supabase.com)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/yourtable.git
cd yourtable
pnpm install
```

### 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose region **EU Central (Frankfurt)** for best latency from Slovenia
3. Save the database password — you'll need it for `DATABASE_URL`
4. Go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Go to **Settings → Database** and copy the connection strings:
   - **Connection string (Transaction mode / port 6543)** → `DATABASE_URL`
   - **Connection string (Session mode / port 5432)** → `DIRECT_URL`

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to Supabase (creates all tables)
pnpm db:push

# Seed with demo data
pnpm db:seed
```

### 5. Run Development Server

```bash
# Run API only
pnpm dev:api

# Or run everything (API + Web + Widget)
pnpm dev
```

The API will be available at `http://localhost:3001`

### 6. Verify

```bash
# Health check
curl http://localhost:3001/health

# Should return: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## API Endpoints (Phase 1)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new restaurant + owner |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Current user profile |
| POST | `/api/v1/auth/logout` | Logout |

### Tenant
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant` | Get restaurant details |
| PUT | `/api/v1/tenant` | Update restaurant |
| PUT | `/api/v1/tenant/settings` | Update settings (JSON) |

### Users (Staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List staff members |
| POST | `/api/v1/users` | Create staff member |
| PUT | `/api/v1/users/:id` | Update staff member |
| DELETE | `/api/v1/users/:id` | Deactivate staff member |

## Database Schema

The Prisma schema includes all tables for the full platform (Core + V2 modules). Phase 1 focuses on: `tenants`, `users`, `floor_plans`, `restaurant_tables`, `table_adjacency`, `guests`, `seating_config`, `operating_hours`, `special_dates`, `audit_logs`.

To explore the database visually:
```bash
pnpm db:studio
```

## Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run tests
pnpm test

# Database operations
pnpm db:migrate    # Create migration
pnpm db:push       # Push schema changes (dev)
pnpm db:seed       # Re-seed demo data
pnpm db:studio     # Prisma Studio (DB browser)
```

## Roadmap

- [x] **Phase 1**: Foundation (monorepo, DB, auth, tenant management)
- [ ] **Phase 2**: Seating engine (tables, floor editor, HOLD, seating algorithm)
- [ ] **Phase 3**: Reservations (CRUD, admin timeline, guest management)
- [ ] **Phase 4**: Booking widget (embeddable, availability, HOLD flow)
- [ ] **Phase 5**: Payments & notifications (Stripe, email, waitlist)
- [ ] **Phase 6** *(V2)*: Gift vouchers (sales, QR, PDF)
- [ ] **Phase 7** *(V2)*: AI + analytics (reviews, reports, SMS)

## License

Proprietary — All rights reserved.
" " 
