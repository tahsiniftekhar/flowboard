# Flowboard

[![CI](https://github.com/tahsiniftekhar/flowboard/actions/workflows/ci.yml/badge.svg)](https://github.com/tahsiniftekhar/flowboard/actions/workflows/ci.yml)

Flowboard is a shared Kanban board: boards, columns, and tasks, with **board-scoped authorization** (each board has an owner and invited members, and every request is checked against the board that owns the resource).

The part I care most about is that card order stays correct when two people drag cards at the same moment. Positions are dense integers, each move rewrites the column inside one transaction, and concurrent moves are serialized with a parent-row lock. A race test proves this. See [docs/ordering.md](docs/ordering.md) for the reasoning and the tradeoff against fractional indexing / LexoRank.

## Screenshots

![Board view in light mode](docs/screenshots/board-light.png)

| | |
| --- | --- |
| ![Board view in dark mode](docs/screenshots/board-dark.png) | ![Boards dashboard](docs/screenshots/dashboard-dark.png) |
| ![Task details dialog](docs/screenshots/task-detail-light.png) | ![Board filtered by priority](docs/screenshots/board-filtered-light.png) |
| ![Login page](docs/screenshots/login-light.png) | ![Mobile board in dark mode](docs/screenshots/mobile-board-dark.png) |

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- Docker Desktop, for the PostgreSQL container
- PostgreSQL 16 or another compatible PostgreSQL instance for a non-Docker setup

## Project Structure

```text
backend/   NestJS API, Prisma schema, migrations, and seed
frontend/  Next.js application
```

## Environment Variables

Copy the root example file when running locally:

```bash
cp .env.example backend/.env
```

The backend reads these variables from `backend/.env`:

| Variable       | Purpose                                                     | Local value                                                               |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                                | `postgresql://flowboard:flowboard@localhost:5432/flowboard?schema=public` |
| `DIRECT_URL`   | Direct PostgreSQL URL for migrations (recommended for Neon) | Empty locally                                                             |
| `JWT_SECRET`   | Secret used to sign access tokens                           | Use a long random value                                                   |
| `PORT`         | Backend HTTP port                                           | `4000`                                                                    |
| `FRONTEND_URL` | Allowed frontend origin(s), comma-separated                 | `http://localhost:3000`                                                   |

The frontend reads `NEXT_PUBLIC_API_URL`. It defaults to `http://localhost:4000`, so no separate frontend environment file is required for the standard local setup.

Never commit real secrets or production credentials.

## Local Installation

From the repository root:

```bash
pnpm install --dir backend
pnpm install --dir frontend
cp .env.example backend/.env
```

Set a real `JWT_SECRET` in `backend/.env` before starting the API.

## Database Setup

Start PostgreSQL with Docker Compose:

```bash
docker compose up -d db
```

Apply the committed migrations:

```bash
cd backend
pnpm exec prisma migrate deploy
```

For Neon, set `DATABASE_URL` to the pooled connection string and `DIRECT_URL` to
the direct connection string from the Neon dashboard. The app uses
`DATABASE_URL`; Prisma migrations use `DIRECT_URL` when it is set.

For local schema development, use `pnpm exec prisma migrate dev` instead. Do not use `migrate dev` against a shared or production database.

## Seed Data

Run the seed after migrations:

```bash
cd backend
pnpm run db:seed
```

The seed is safe to run once on a fresh database and skips when users already exist.

Demo credentials created by the seed:

```text
Email: owner@example.com
Password: FlowboardDemo123!
```

Additional seeded accounts use the same password:

```text
designer@example.com
engineer@example.com
writer@example.com
```

The seed creates three boards with ten columns and twenty-three tasks, including shared boards, varied workflow stages, long descriptions, empty-column-capable layouts, and multiple member roles. Tasks have every priority level, a mix of due dates (including overdue and due-today tasks), and assignees who are members of their board. The additional accounts are useful for checking the shared-board experience.

## Run the Application

Use two terminals from the repository root.

Terminal 1, backend:

```bash
cd backend
pnpm run start:dev
```

The API runs at [http://localhost:4000/api](http://localhost:4000/api).

Terminal 2, frontend:

```bash
cd frontend
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign in with the seeded demo credentials or register a new account. To verify the main workflow, open the sample board, create a task, edit it, move it within or between columns, and refresh the board.

## Docker Usage

Compose currently provides the PostgreSQL dependency while the frontend and backend run as normal Node development processes. This keeps the setup small and makes code changes fast:

```bash
docker compose up -d db
cd backend
pnpm exec prisma migrate deploy
pnpm run db:seed
pnpm run start:dev
```

In another terminal:

```bash
cd frontend
pnpm run dev
```

Stop the database container without deleting data:

```bash
docker compose down
```

Reset the local database and remove its volume:

```bash
docker compose down -v
```

After a reset, run migrations and seed again.

## Deployment (Docker)

The API ships as a container image, built by GitHub Actions on every push to `main`
([.github/workflows/docker-image.yml](.github/workflows/docker-image.yml)) and pushed to
`ghcr.io/tahsiniftekhar/flowboard-api` (`latest` and `sha-<commit>`). Nothing is built on the server.
The frontend deploys separately (Vercel).

```bash
docker run --env-file backend/.env -p 4000:4000 ghcr.io/tahsiniftekhar/flowboard-api   # start the API
docker run --env-file backend/.env ghcr.io/tahsiniftekhar/flowboard-api migrate           # prisma migrate deploy
docker run --env-file backend/.env ghcr.io/tahsiniftekhar/flowboard-api reset             # wipe + migrate + seed
```

- Env: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (comma-separated origins), optional `PORT` (default 4000)
  and `DIRECT_URL`. Migrations do not run on start unless `MIGRATE_ON_START=true`.
- Health check: `GET /api/health` (checks the database, all routes use the `/api` prefix).
- Sized for a 192 MB container: the image sets `NODE_OPTIONS=--max-old-space-size=128`; the idle API uses about 70 MB.
- `reset` (or `pnpm run db:reset-demo`) drops the database schema, re-applies migrations and re-seeds.
  The public demo runs it nightly. It destroys all data, so only point it at the demo database.
- Logs go to stdout; runs as the non-root `node` user.

## API Overview

All board, column, and task routes require a bearer token from login or registration.

| Method   | Route                              | Purpose                             |
| -------- | ---------------------------------- | ----------------------------------- |
| `POST`   | `/auth/register`                   | Create an account                   |
| `POST`   | `/auth/login`                      | Sign in                             |
| `GET`    | `/auth/me`                         | Read the current user               |
| `GET`    | `/boards`                          | List accessible boards              |
| `POST`   | `/boards`                          | Create a board                      |
| `GET`    | `/boards/:id`                      | Read a board with columns and tasks |
| `PATCH`  | `/boards/:id`                      | Rename an owned board               |
| `DELETE` | `/boards/:id`                      | Delete an owned board               |
| `POST`   | `/boards/:boardId/members`         | Add a registered member by email    |
| `GET`    | `/boards/:boardId/members`         | List board members                  |
| `DELETE` | `/boards/:boardId/members/:userId` | Remove a member, or leave a board   |
| `POST`   | `/boards/:boardId/columns`         | Create a column                     |
| `PATCH`  | `/columns/:id`                     | Rename a column                     |
| `PATCH`  | `/columns/:id/move`                | Reorder a column                    |
| `DELETE` | `/columns/:id`                     | Delete a column and its tasks       |
| `POST`   | `/columns/:columnId/tasks`         | Create a task                       |
| `PATCH`  | `/tasks/:id`                       | Update task fields (partial)        |
| `DELETE` | `/tasks/:id`                       | Delete a task                       |
| `PATCH`  | `/tasks/:taskId/move`              | Move or reorder a task              |

### Task fields

Besides `title` and `description`, tasks support these fields:

- `priority`: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`. Defaults to `MEDIUM`.
- `dueDate`: a date in `YYYY-MM-DD` format, or `null` when no due date is set.
- `assigneeId`: the ID of a user who is a member or owner of the task's board, or `null`. Assigning a non-member returns `400`. The assignment is cleared when that user leaves or is removed from the board.

## Tests and Checks

Backend:

```bash
cd backend
pnpm run test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Frontend:

```bash
cd frontend
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Backend tests are integration tests against a real PostgreSQL database. Run `docker compose up -d db` and `pnpm exec prisma migrate deploy` first. CI runs the same steps on every push ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Architecture Decisions

- The application is a modular monolith: NestJS modules own authentication, boards, members, columns, and tasks.
- PostgreSQL is the source of truth, accessed through Prisma.
- The Next.js client uses TanStack Query for server state and dnd-kit for task movement.
- JWT authentication is used for the API. Authorization is board-scoped: every board, column, and task request resolves the owning board server-side and checks that the caller is its owner or a member. There is no workspace or tenant layer above boards.
- There is no Redux, realtime transport, queue, cache server, or microservice layer.
- Docker Compose is intentionally limited to the PostgreSQL dependency.

## Task Ordering

Tasks use dense integer positions beginning at zero within each column. Move operations run in a database transaction, validate both source and destination access, shift affected tasks, move the task, and normalize positions so each column remains contiguous after the operation. Columns use the same dense-position strategy via `PATCH /columns/:id/move`.

Concurrent writes are serialized with `SELECT ... FOR UPDATE` on the parent column (or on the board, for column reordering). Two-column moves take their locks in id order so they cannot deadlock. If a card was moved by someone else in the meantime, the API returns `409` and the board refetches. `src/tasks/task-concurrency.spec.ts` fires simultaneous moves from two users and asserts that positions stay `0..n-1`. The full write-up is in [docs/ordering.md](docs/ordering.md).
