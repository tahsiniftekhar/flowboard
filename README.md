# Flowboard

Flowboard is a focused Kanban workspace for organizing boards, columns, tasks, and collaboration.

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

The seed creates three boards with ten columns and twenty-three tasks, including shared boards, varied workflow stages, long descriptions, empty-column-capable layouts, and multiple member roles. The additional accounts are useful for checking the shared-board experience.

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

## API Overview

All board, column, and task routes require a bearer token from login or registration.

| Method   | Route                              | Purpose                             |
| -------- | ---------------------------------- | ----------------------------------- |
| `POST`   | `/auth/register`                   | Create an account                   |
| `POST`   | `/auth/login`                      | Sign in                             |
| `GET`    | `/auth/me`                         | Read the current user               |
| `GET`    | `/boards`                          | List accessible boards              |
| `POST`   | `/boards`                          | Create a board with starter columns |
| `GET`    | `/boards/:id`                      | Read a board with columns and tasks |
| `PATCH`  | `/boards/:id`                      | Rename an owned board               |
| `DELETE` | `/boards/:id`                      | Delete an owned board               |
| `POST`   | `/boards/:boardId/members`         | Add a registered member by email    |
| `GET`    | `/boards/:boardId/members`         | List board members                  |
| `DELETE` | `/boards/:boardId/members/:userId` | Remove a member                     |
| `POST`   | `/boards/:boardId/columns`         | Create a column                     |
| `PATCH`  | `/columns/:id`                     | Rename a column                     |
| `DELETE` | `/columns/:id`                     | Delete a column and its tasks       |
| `POST`   | `/columns/:columnId/tasks`         | Create a task                       |
| `PATCH`  | `/tasks/:id`                       | Update a task                       |
| `DELETE` | `/tasks/:id`                       | Delete a task                       |
| `PATCH`  | `/tasks/:taskId/move`              | Move or reorder a task              |

## Tests and Checks

Backend:

```bash
cd backend
pnpm run test
pnpm run test:e2e
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

The backend test suite requires a working test database configuration. If Jest fails before collecting tests because of the local Node/Jest ESM configuration, resolve that environment issue before treating the test run as a functional result.

## Architecture Decisions

- The application is a modular monolith: NestJS modules own authentication, boards, members, columns, and tasks.
- PostgreSQL is the source of truth, accessed through Prisma.
- The Next.js client uses TanStack Query for server state and dnd-kit for task movement.
- JWT authentication is used for the API; authorization is checked server-side for every protected resource.
- There is no Redux, realtime transport, queue, cache server, or microservice layer.
- Docker Compose is intentionally limited to the PostgreSQL dependency.

## Task Ordering

Tasks use dense integer positions beginning at zero within each column. Move operations run in a database transaction, validate both source and destination access, shift affected tasks, move the task, and normalize positions so each column remains contiguous after the operation.

New boards receive three starter columns at positions zero through two, making the first board usable immediately without additional setup.
