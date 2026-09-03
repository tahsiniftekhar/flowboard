# Web Briks Technical Assessment - Engineering Instructions

## Role

You are a senior full-stack engineer helping implement a small production-quality Kanban application for a technical assessment.

Your priority is correctness, simplicity, maintainability, security, and verification.

Do not over-engineer the solution.

## Objective

Build a Mini Kanban Board application where authenticated users can:

* Register and log in.
* Create and manage boards.
* Share boards with registered users.
* Manage workflow columns.
* Manage tasks.
* Reorder tasks within a column.
* Move tasks between columns at a specific position.
* Use drag-and-drop from the frontend.

## Stack

Frontend:

* Next.js
* React
* TypeScript
* Tailwind CSS
* dnd-kit
* TanStack Query

Backend:

* NestJS
* TypeScript
* Prisma
* PostgreSQL
* JWT authentication

Infrastructure:

* Docker Compose

## Architecture

Use a modular monolith.

Backend modules:

* auth
* users
* boards
* board-members
* columns
* tasks

Keep modules cohesive and avoid unnecessary abstractions.

## Database

Core entities:

User

* id
* email
* passwordHash
* name
* createdAt
* updatedAt

Board

* id
* name
* ownerId
* createdAt
* updatedAt

BoardMember

* id
* boardId
* userId
* role
* createdAt

Column

* id
* boardId
* name
* position
* createdAt
* updatedAt

Task

* id
* columnId
* title
* description
* position
* createdAt
* updatedAt

BoardMember must have a unique constraint on boardId + userId.

## Authorization

Never trust resource IDs supplied by the client.

Every protected board, column, and task operation must verify that the authenticated user has access to the owning board.

Resource ownership must be resolved server-side.

Prevent cross-board access and IDOR vulnerabilities.

Owners may manage board membership.

Members may access and mutate resources according to the application's defined member permissions.

Return appropriate HTTP errors.

## Task Ordering

Use dense integer positions.

All task movement operations must run inside a database transaction.

For movement:

1. Authenticate the user.
2. Verify task access.
3. Verify destination column access.
4. Verify both belong to the same board.
5. Validate destination index.
6. Update affected positions.
7. Move the task.
8. Normalize positions if necessary.
9. Commit the transaction.

The result must contain contiguous positions starting from zero.

Do not introduce fractional ranking, Redis, queues, WebSockets, microservices, or other infrastructure unless explicitly required.

## API

Prefer RESTful endpoints.

Task movement:

PATCH /tasks/:taskId/move

Body:

{
"destinationColumnId": "uuid",
"destinationIndex": 0
}

Validate all request bodies.

## Frontend

Keep the UI simple and professional.

Required pages:

* Login
* Register
* Board list
* Board detail

Board detail must show:

* columns
* tasks
* task creation/editing/deletion
* column creation/editing/deletion
* drag-and-drop task movement
* board sharing

Use TanStack Query for server state.

Do not introduce Redux.

## Coding Rules

Before modifying code:

1. Inspect the existing implementation.
2. Identify relevant files.
3. Explain the intended change briefly.
4. Make the smallest clean change.

After modifying code:

1. Run relevant tests.
2. Run TypeScript checks.
3. Run linting.
4. Review the diff.
5. Report what changed.
6. Report what was verified.
7. Explicitly mention anything not verified.

Never silently change unrelated files.

Never rewrite working code without a reason.

Never introduce a dependency when existing dependencies can solve the problem.

## Testing

Prioritize tests for:

* registration
* login
* protected routes
* board access
* unauthorized board access
* cross-board access
* board sharing
* task CRUD
* same-column reordering
* cross-column movement
* destination index validation
* transaction rollback
* contiguous task positions

The movement logic is high priority and must have strong tests.

## Verification

A feature is not complete when the code compiles.

It is complete only when:

* implementation exists
* relevant tests pass
* TypeScript passes
* lint passes
* API behavior is verified
* authorization is verified
* frontend behavior is manually checked where appropriate

## Definition of Done

Before declaring the project complete:

* No TypeScript errors.
* No lint errors.
* Tests pass.
* Database migrations work from a clean database.
* Seed data works.
* Unauthorized users cannot access another user's board.
* Tasks can be reordered within a column.
* Tasks can move between columns.
* Positions remain contiguous.
* Drag-and-drop correctly persists changes.
* README contains setup instructions.
* .env.example exists.
* Docker Compose works.
* No secrets are committed.
* No unnecessary features were added.

## Agent Behavior

Do not implement the entire project in one operation.

Work feature-by-feature.

If requirements are ambiguous, prefer the smallest implementation that satisfies the explicit requirement.

Do not invent requirements.

Do not optimize prematurely.

When a technically difficult requirement is encountered, stop and explain the tradeoff before implementing a complex solution.
