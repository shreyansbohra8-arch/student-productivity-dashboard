# Student Productivity Dashboard

A database-centric academic productivity management system built to demonstrate real, working MongoDB database engineering — not just CRUD, but aggregation pipelines, transactions, text search, indexing strategy, and array-level document updates, all wired to a fully functional REST API and a polished vanilla JS frontend.

## Description

Student Productivity Dashboard centralizes six areas of academic life into one application:

1. **Task Planner** — tasks with embedded subtasks, priorities, statuses, and deadlines
2. **Attendance Tracker** — per-subject attendance with automatic percentage calculation and shortage warnings
3. **Pomodoro Study Timer** — a real, working focus/break timer that logs completed sessions to the database
4. **Notes** — subject-tagged notes with MongoDB full-text search
5. **Exam Countdown** — upcoming exams with live day-count labels
6. **Analytics Dashboard** — every number on this page is computed by a MongoDB aggregation pipeline on the backend, never counted in frontend JavaScript

## Features

- JWT authentication with bcrypt-hashed passwords
- Per-user data isolation — every query is scoped to the authenticated user
- Embedded subtasks with `$push` / `$pull` / `$set` / `$elemMatch` array operations
- MongoDB `$text` full-text search over notes
- Upsert-based attendance recording
- "Safe Classes" calculator — for each subject, shows how many classes you can miss (when above the threshold) or how many you must attend next (when below it)
- Aggregation-pipeline-driven analytics (task completion, study time by subject, attendance percentage, most productive day, 14-day study trend)
- Productivity streak — consecutive-day streak from focus sessions + completed tasks, computed via `$unionWith` / `$setWindowFields`, shown on the dashboard and analytics page
- Multi-document ACID transaction for cascading account deletion
- Paginated, projected task and note listings
- Responsive, modern dashboard UI with loading/empty/error states, toasts, and modals
- Seed script with realistic demo data and documented demo credentials

## Technology Stack

**Frontend:** HTML5, CSS3, Vanilla JavaScript (no framework), Chart.js (via CDN) for analytics charts

**Backend:** Node.js, Express.js

**Database:** MongoDB, Mongoose ODM

**Authentication:** JSON Web Tokens (JWT), bcryptjs

**Other:** Helmet (security headers), CORS, Morgan (request logging), express-validator (available for extended validation)

## Architecture

```
Browser (static HTML/CSS/JS)
        │  fetch() via assets/js/api.js
        ▼
Express REST API (backend/server.js)
        │  routes → middleware (auth) → controllers
        ▼
Mongoose Models
        │
        ▼
MongoDB (standalone for CRUD, replica set required for transactions)
```

The Express server also serves the `frontend/` folder as static files, so the entire app runs from a single `npm start` on one port.

## Folder Structure

```
student-productivity-dashboard/
├── backend/
│   ├── config/db.js                   MongoDB connection
│   ├── controllers/                   Business logic (9 files)
│   ├── middleware/                    Auth guard + centralized error handler
│   ├── models/                        7 Mongoose schemas
│   ├── routes/                        9 Express routers
│   ├── services/transactionService.js Multi-document transaction logic
│   ├── utils/verifySubjectOwnership.js Shared subjectId ownership check
│   ├── seed/seedData.js               Demo data seeder
│   └── server.js                      App entry point
├── frontend/
│   ├── assets/css/                    style.css, dashboard.css, responsive.css
│   ├── assets/js/                     api.js + one module per page
│   └── *.html                         11 pages
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── PROJECT_STRUCTURE.md
```

See `PROJECT_STRUCTURE.md` for a file-by-file breakdown.

## MongoDB Collections

| Collection      | Purpose                                             |
|------------------|------------------------------------------------------|
| `users`          | Accounts, hashed passwords, attendance threshold pref |
| `subjects`       | User-defined subjects, used across the other modules |
| `tasks`          | Tasks with an embedded `subtasks` array               |
| `studysessions`  | Completed Pomodoro focus sessions                      |
| `attendances`    | One document per (user, subject), updated via upsert  |
| `notes`          | Notes with a `title + content` text index              |
| `exams`          | Exams with a date index                                |

## MongoDB Techniques Demonstrated

All 13 required techniques are implemented in real, running query code:

1. **CRUD** — every module (subjects, tasks, attendance, study sessions, notes, exams)
2. **Embedded documents** — `Task.subtasks[]` (`backend/models/Task.js`)
3. **ObjectId references** — `userId` / `subjectId` across every collection
4. **Aggregation pipelines** — `backend/controllers/analyticsController.js` (8 separate pipelines: task stats, study-by-subject, most-productive-day, 14-day trend, productive-day streak via `$unionWith` + `$setWindowFields`, attendance-by-subject, overall attendance)
5. **Single-field indexes** — `Task.userId`, `StudySession.subjectId`, `Exam.examDate`, etc.
6. **Compound index** — `{ userId: 1, status: 1, deadline: 1 }` on `Task` for efficient pending-task retrieval
7. **Text index** — `{ title: 'text', content: 'text' }` on `Note`, queried with `$text`/`$search`
8. **Schema validation** — required fields, enums (`priority`, `status`), min/max, regex email validation
9. **Multi-document transactions** — `backend/services/transactionService.js`, invoked from `DELETE /api/users/me`
10. **Pagination** — `page`/`limit`/`skip()`/`limit()` on `/api/tasks` and `/api/notes`, with metadata returned
11. **Projection** — `.select('title priority status deadline subjectId subtasks createdAt')` on task listing
12. **Upsert** — `Attendance.findOneAndUpdate(..., { upsert: true })` in `attendanceController.js`
13. **Array operations** — `$push` (add subtask), `$pull` (delete subtask), `$set` (edit subtask), `$elemMatch` (locate subtask) — all in `taskController.js`

## Installation

### Prerequisites

- Node.js 18+
- npm
- A MongoDB deployment (see **MongoDB Setup** below — a replica set is required for the transaction feature)

### Steps

```bash
# 1. Extract/clone the project, then install dependencies
cd student-productivity-dashboard
npm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env with your real MongoDB URI and a strong JWT secret

# 3. (Optional but recommended) seed demo data
npm run seed

# 4. Start the server
npm run dev     # with nodemon, for development
# or
npm start       # plain node, for production-style run
```

The app is served at **http://localhost:5000** (or whatever `PORT` you set) — both the API (`/api/...`) and the frontend static files.

## MongoDB Setup

MongoDB **transactions** (used for cascading account deletion) require the database to be running as a **replica set**. A single standalone `mongod` will throw:

```
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
```

Everything else in the app (all CRUD, aggregation, text search, upserts, array ops) works fine on a standalone instance — only the account-deletion transaction needs a replica set.

### Option 1 — MongoDB Atlas (recommended, zero setup)

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Atlas clusters are **always** backed by a replica set, so transactions work out of the box
3. Get your connection string from Atlas → Connect → Drivers, and put it in `.env` as `MONGODB_URI`

### Option 2 — Local MongoDB as a single-node replica set

```bash
# Stop any existing mongod, then start it with --replSet
mongod --dbpath /path/to/your/data --replSet rs0

# In a separate terminal, initiate the replica set (one-time)
mongosh
> rs.initiate()
```

Then use `MONGODB_URI=mongodb://127.0.0.1:27017/student_productivity_dashboard?replicaSet=rs0` in your `.env`.

If you only need CRUD/analytics/search and don't care about testing the "Delete Account" feature, a plain standalone `mongod` on `mongodb://127.0.0.1:27017/student_productivity_dashboard` works for everything else.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable          | Description                                      |
|--------------------|---------------------------------------------------|
| `PORT`             | Port the Express server listens on (default 5000) |
| `MONGODB_URI`      | Your MongoDB connection string                    |
| `JWT_SECRET`       | Long, random secret used to sign JWTs              |
| `JWT_EXPIRES_IN`   | Token lifetime, e.g. `7d`                          |
| `NODE_ENV`         | `development` or `production`                      |

The server refuses to start (with a clear console error) if `MONGODB_URI` or `JWT_SECRET` is missing.

## Running the Backend

```bash
npm run dev    # nodemon, auto-restarts on file changes
npm start      # plain node
```

## Running the Frontend

There is no separate frontend server — `backend/server.js` serves `frontend/` as static files via Express. Just start the backend and visit it in a browser.

## Seeding Demo Data

```bash
npm run seed
```

This creates one demo user with 4 subjects, 5 tasks (with subtasks), attendance records, 14 days of study sessions, 3 notes, and 4 exams. It is **not** run automatically on server start — only when you explicitly run the script — and it clears any previous demo data for that account first so it's safe to re-run.

### Demo Credentials

```
Email:    demo@student.com
Password: Demo@1234
```

## API Overview

All routes below (except `/auth/register` and `/auth/login`) require an `Authorization: Bearer <token>` header.

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PATCH  /api/auth/settings
DELETE /api/users/me                          (multi-document transaction)

GET    /api/subjects            POST   /api/subjects
PATCH  /api/subjects/:id        DELETE /api/subjects/:id

GET    /api/tasks               POST   /api/tasks
GET    /api/tasks/:id           PATCH  /api/tasks/:id           DELETE /api/tasks/:id
POST   /api/tasks/:id/subtasks
PATCH  /api/tasks/:id/subtasks/:subtaskId     DELETE /api/tasks/:id/subtasks/:subtaskId

GET    /api/attendance          POST   /api/attendance/mark     DELETE /api/attendance/:id

GET    /api/study-sessions      POST   /api/study-sessions      DELETE /api/study-sessions/:id

GET    /api/notes               POST   /api/notes
PATCH  /api/notes/:id           DELETE /api/notes/:id

GET    /api/exams               POST   /api/exams
PATCH  /api/exams/:id           DELETE /api/exams/:id

GET    /api/analytics/dashboard

GET    /api/health               (unauthenticated health check)
```

`GET /api/tasks` supports `?page=&limit=&status=&priority=&subjectId=&overdue=true&sort=`.
`GET /api/notes` supports `?page=&limit=&q=&subjectId=` where `q` triggers the MongoDB `$text` search.

## Transaction Requirements

See **MongoDB Setup** above. In short: replica set or Atlas required for `DELETE /api/users/me`; everything else works on a standalone MongoDB instance.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits immediately with "Missing required environment variables" | You haven't copied `.env.example` to `.env`, or left `MONGODB_URI`/`JWT_SECRET` blank |
| `MongoServerError: Transaction numbers are only allowed on a replica set member` | You're deleting an account against a standalone `mongod`. Use Atlas or a local replica set (see above) |
| Login returns 401 immediately after registering | Check that `JWT_SECRET` in `.env` didn't change between requests (changing it invalidates all existing tokens) |
| Notes search returns nothing | Confirm the text index built successfully — Mongoose creates it automatically on first connection, but on very large existing collections index builds can take time |
| Frontend shows "Could not reach the server" | Backend isn't running, or you're opening the HTML files directly via `file://` instead of through `http://localhost:5000` |
| Blank dashboard after seeding | Make sure you logged in with the demo credentials above, not a freshly registered empty account |

## Project Workflow

1. Register or log in → JWT stored in `localStorage`
2. Create subjects first (tasks/attendance/notes/exams can optionally reference a subject)
3. Add tasks, mark attendance, log Pomodoro sessions, write notes, and add exams as you go
4. The Analytics page aggregates all of the above in real time via MongoDB pipelines
5. Deleting your account cascades — atomically, via a transaction — through every collection tied to your `userId`

## Future Improvements

- Real-time updates via WebSockets (e.g. live session sync across tabs)
- Recurring tasks and calendar view
- Export analytics to PDF/CSV
- Push/email reminders for upcoming exams and deadlines
- Dark mode
- Refresh tokens / token rotation instead of a single long-lived JWT

## Security & Correctness Fixes (Post-Review 1)

A follow-up review pass found and fixed the following issues in the initial version:

- **Subject ownership validation.** Creating or updating a Task, Note, Exam, or Study Session with a `subjectId` now verifies — via `backend/utils/verifySubjectOwnership.js` — that the referenced subject actually belongs to the authenticated user before saving. Previously a user could attach another user's `subjectId` to their own task/note/exam/session. Attendance already had this check; it's now consistent across every resource that accepts a `subjectId`.
- **Subject update mass-assignment.** `PATCH /api/subjects/:id` previously spread the entire request body into `$set`, which could let a client smuggle unexpected fields (e.g. `userId`) into the update. It now uses an explicit field allow-list (`name`, `code`, `color`), matching the pattern already used by every other controller.
- **Notes projection + a real search bug.** `GET /api/notes` now applies an explicit projection (`title`, `content`, `subjectId`, `tags`, `createdAt`, `updatedAt`) on both the plain listing and the `$text` search listing. This also fixed a real bug: the search branch previously projected *only* the text-search `score` meta field, which meant `$text` search results were silently missing `title`/`content`/`tags` in the response.
- **Upcoming exam count.** `GET /api/analytics/dashboard` previously reported `upcomingCount` as `upcomingExams.length`, which is wrong (and silently capped at 5) once a user has more than 5 upcoming exams. It now runs a separate `Exam.countDocuments()` for the true total, independent of the 5-item preview list.
- **Below-threshold attendance now computed in MongoDB.** The attendance aggregation pipeline now uses `$facet` to compute both the full per-subject list and the below-threshold subset in a single database round trip, instead of filtering the already-fetched array in application code.
- **Duplicate index warning removed.** `User.js` declared the same unique index on `email` twice (once via `unique: true`, once via an explicit `.index()` call), which produced a harmless but noisy Mongoose warning at connect time. The redundant explicit index was removed.

None of these fixes changed any API route, request/response shape consumed by the frontend, or existing feature — they are all internal to controller logic in `backend/`.

## Known Limitation — MongoDB Runtime Testing

This project was built and statically verified (syntax checks, route-to-call cross-referencing, dependency installation) in a sandboxed environment **without network access to a real MongoDB deployment** (no local `mongod`, no access to download one). Every MongoDB technique described above is implemented in genuine query code and has been read through line-by-line for correctness, but **it has not been exercised against a live database** in this environment. Before your review/demo, run through the **Installation** and **Seeding Demo Data** steps against a real MongoDB (Atlas is fastest) and confirm the app end-to-end on your machine.
