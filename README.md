# Pop Quiz

A lightweight browser quiz app built with plain HTML, CSS, and JavaScript.

## Run

1. Install dependencies: `npm install`
2. Start local server: `npm run dev`
3. Open `http://localhost:4173`
4. Open `http://localhost:4173/admin.html` for class management UI

## Auth API (PQ-005)

1. Copy environment template: `cp .env.example .env`
2. Set `AUTH_JWT_SECRET` in `.env`
3. Start auth API: `npm run api:dev`
4. API runs at `http://localhost:3000`

Auth routes:

- `GET /auth/blocks` for block selection options
- `POST /auth/signup` with `{ "username": "student_1", "password": "secret1", "blockNumber": 2 }`
- `POST /auth/login` with `{ "username": "student_1", "password": "secret1" }`
- `POST /auth/logout`
- `GET /auth/me` (requires session cookie)

Admin class routes (admin role + session required):

- `GET /admin/classes`
- `POST /admin/classes` with `{ "name": "Biology", "blockNumber": 2 }`
- `PUT /admin/classes/:classId`
- `DELETE /admin/classes/:classId`
- `GET /admin/students` (optional query: `classId` or `blockNumber`)
- `POST /admin/students/:studentId/reset-password` with optional `{ "newPassword": "secret123" }`
- `GET /admin/audit-logs` (optional query: `limit`)

## Admin Class UI

- `admin.html` provides class create/edit/delete flow
- `admin-classes.js` calls the API at `http://localhost:3000` by default
- To override API base URL, set `localStorage.popQuizApiBase` in browser devtools

## Database Setup

1. Copy environment template: `cp .env.example .env`
2. Update `DATABASE_URL` in `.env`
3. Generate Prisma client: `npm run db:generate`
4. Run local migrations: `npm run db:migrate`
5. For deployment migrations: `npm run db:migrate:deploy`

## Quality Checks

- Lint: `npm run lint`
- Tests: `npm test`
- Formatting check: `npm run format:check`
- All checks: `npm run check`

## Features

- 5-question timed quiz
- 15-second timer per question
- Instant correct/incorrect feedback
- Final score summary
- Restart flow
