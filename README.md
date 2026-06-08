# Momentum — Business Management Platform

A full-stack business management app with AI-powered features, built with React, Node.js, PostgreSQL, and Prisma.

---

## Prerequisites

- Node.js 18+
- PostgreSQL (or Docker)
- npm

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/tamarShaked02/momentum-monorepo.git
cd momentum-monorepo
```

### 2. Configure environment variables

**Backend** — copy and fill in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/momentum
JWT_SECRET=your-secret-key
BOT_TOKEN=                      # optional: Telegram bot token
GEMINI_API_KEY=your-gemini-key  # or set USE_MOCK_AI=true
PORT=3000
NODE_ENV=development
USE_MOCK_AI=true                # set to false to use real AI
```

**Frontend** — `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Start PostgreSQL

Using Docker:

```bash
docker run --name momentum-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=momentum -p 5432:5432 -d postgres
```

Or use your local PostgreSQL instance.

### 4. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 5. Run database migrations

```bash
cd backend
npx prisma migrate deploy
```

### 6. Start the backend

```bash
cd backend
npm run dev
```

Server runs at `http://localhost:3000`.  
Swagger docs at `http://localhost:3000/api-docs`.

### 7. Start the frontend

```bash
cd frontend
npm run dev
```

App runs at `http://localhost:5173`.

---

## Docker (core service only)

```bash
docker-compose up --build
```

---

## Project Structure

```
momentum-monorepo/
├── backend/              # Express + Prisma API
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # AI, inventory sync
│   │   ├── middleware/   # Auth JWT middleware
│   │   └── config/       # DB, env, swagger
│   ├── modules/          # Module definitions (JSON)
│   └── prisma/           # Schema and migrations
├── frontend/             # React + Vite + MUI
│   └── src/
│       ├── pages/        # Feature pages
│       ├── components/   # Shared components (Sidebar, Layout, CommandBar)
│       ├── contexts/     # Auth + Theme contexts
│       └── api/          # Axios client
├── docker-compose.yml    # Postgres + backend + frontend
├── package.json          # Monorepo root (npm workspaces)
├── README.md
└── TODO.md
```

---

## Modules

| Module       | Description                              |
| ------------ | ---------------------------------------- |
| Dashboard    | Overview widgets for all enabled modules |
| Appointments | Schedule and manage appointments         |
| Customers    | CRM — profiles, history, notes           |
| Inventory    | Stock tracking with low-stock alerts     |
| Tasks        | Kanban board with priorities             |
| Marketing    | AI-generated campaign content            |
| Analytics    | Appointment and business stats           |

---

## TODO

See [TODO.md](./TODO.md) for the full task list.
