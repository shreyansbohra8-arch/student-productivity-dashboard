# Project Structure

This document explains every major folder and file, the backend/frontend/database architecture, and exactly where each of the 13 required MongoDB techniques lives in the codebase.

## Top-level layout

```
student-productivity-dashboard/
├── backend/          Express API server
├── frontend/          Static HTML/CSS/JS client
├── .env.example       Template for required environment variables
├── .gitignore
├── package.json
├── README.md
└── PROJECT_STRUCTURE.md
```

## Backend

### `backend/server.js`
Application entry point. Loads environment variables, validates that `MONGODB_URI` and `JWT_SECRET` are present (exits with a clear error if not), configures Helmet/CORS/JSON body parsing/Morgan logging, serves `frontend/` as static files, mounts all nine API routers under `/api/*`, and registers the 404 + centralized error-handling middleware last.

### `backend/config/db.js`
Connects to MongoDB via Mongoose, logs the connected host/database name, and attaches `error`/`disconnected` event listeners for visibility. Exits the process if the initial connection fails.

### `backend/models/` — Mongoose schemas

| File | What it defines |
|---|---|
| `User.js` | Name, email (unique, regex-validated), bcrypt-hashed password (`select: false` so it's never returned by default), `attendanceThreshold` preference |
| `Subject.js` | `userId` reference, name, code, color; compound index `{ userId, name }` |
| `Task.js` | Title, description, deadline, `priority` enum, `status` enum, and an **embedded** `subtasks` array (its own sub-schema with `title`/`completed`). Has a single-field index on `userId` and the **required compound index** `{ userId: 1, status: 1, deadline: 1 }` for efficient pending-task queries. Exposes a `subtaskProgress` virtual. |
| `StudySession.js` | `userId`/`subjectId` references, `mode`, `durationMinutes`, `completedAt`; indexed on `userId`, `subjectId`, and `{ userId, completedAt }` |
| `Attendance.js` | `userId`/`subjectId` references, `totalClasses`, `presentClasses`; **unique compound index** `{ userId, subjectId }` — this is the index the upsert operation relies on. Exposes a `percentage` virtual. |
| `Note.js` | `userId`/`subjectId` references, title, content, tags; **text index** `{ title: 'text', content: 'text' }` |
| `Exam.js` | `userId`/`subjectId` references, examName, examDate, description; indexed on `userId` and `examDate` |

### `backend/middleware/`

- **`authMiddleware.js`** — `protect()` reads the `Authorization: Bearer <token>` header, verifies the JWT with `jsonwebtoken`, loads the corresponding `User` (rejecting if it no longer exists or the token expired), and attaches `req.user` / `req.userId`. Every protected route file calls `router.use(protect)` before its handlers.
- **`errorMiddleware.js`** — `notFound()` catches unmatched `/api/*` routes; `errorHandler()` is the single centralized error handler. It translates Mongoose `CastError` (invalid ObjectId), `ValidationError`, and duplicate-key (`11000`) errors into clean 400/409 JSON responses, and hides raw stack traces from the client in production.

### `backend/utils/verifySubjectOwnership.js`
Shared helper used by every controller that accepts a `subjectId` from the client (Task, Note, Exam, StudySession). Given a `subjectId` and the authenticated `userId`, it confirms the subject exists **and belongs to that user** before the calling controller is allowed to save it. Returns `{ ok: true, subjectId }` (with `subjectId: null` if none was supplied and the field is optional) or `{ ok: false, status, message }` for the controller to return directly. This is what stops one user from attaching another user's subject to their own task/note/exam/session.

### `backend/controllers/`

- **`authController.js`** — `register` (hashes password with bcrypt, creates user, signs JWT), `login` (compares bcrypt hash, signs JWT), `getMe`, `updateSettings` (attendance threshold). Never returns the password field.
- **`userController.js`** — `deleteMyAccount`, which calls the transaction service.
- **`subjectController.js`** — CRUD for subjects, all queries filtered by `userId`. `updateSubject` uses an explicit field allow-list (`name`/`code`/`color`) rather than spreading the raw request body into `$set`.
- **`taskController.js`** — CRUD for tasks plus subtask sub-routes. This is where pagination, projection, and all four array operators live (see the technique table below). `createTask`/`updateTask` validate `subjectId` ownership via `verifySubjectOwnership()` before saving.
- **`attendanceController.js`** — `listAttendance` (computes percentage + safe/warning/shortage state per record), `markAttendance` (the upsert, already validates subject ownership directly), `deleteAttendance`.
- **`studySessionController.js`** — CRUD for logged Pomodoro sessions, paginated listing. `createSession` validates `subjectId` ownership (required field for this resource) via `verifySubjectOwnership()`.
- **`noteController.js`** — CRUD for notes; `listNotes` branches into a `$text` search query when `?q=` is supplied, otherwise a normal paginated/sorted query. Both branches apply an explicit projection (`NOTE_LIST_PROJECTION`). `createNote`/`updateNote` validate `subjectId` ownership.
- **`examController.js`** — CRUD for exams; computes `daysRemaining` and a human-readable countdown label (`"5 days remaining"`, `"Today"`, `"Exam completed"`) server-side. `createExam`/`updateExam` validate `subjectId` ownership.
- **`analyticsController.js`** — Eight aggregation pipelines feeding the analytics dashboard (see below), including a `$facet`-based split of attendance records into "all" and "below threshold" computed entirely in MongoDB, and a productive-day streak pipeline that merges focus sessions with completed tasks via `$unionWith` and groups consecutive days with `$setWindowFields` + `$shift`. Also runs a separate `countDocuments()` for the true upcoming-exam total (independent of the 5-item preview list).

### `backend/routes/`
One router per resource (`authRoutes.js`, `userRoutes.js`, `subjectRoutes.js`, `taskRoutes.js`, `attendanceRoutes.js`, `studySessionRoutes.js`, `noteRoutes.js`, `examRoutes.js`, `analyticsRoutes.js`). Every router except `authRoutes.js`'s register/login endpoints calls `router.use(protect)`. Routes only wire HTTP verbs/paths to controller functions — no business logic lives here.

### `backend/services/transactionService.js`
`deleteUserWithTransaction(userId)` starts a Mongoose session, opens a transaction, deletes the user's tasks/notes/attendance/study sessions/exams/subjects and finally the user document itself, then commits — or aborts on any failure. Documents in comments that this requires a replica set/Atlas.

### `backend/seed/seedData.js`
Standalone script (run via `npm run seed`, never automatically) that connects to MongoDB, wipes any previous demo user's data, and inserts one demo user plus realistic subjects/tasks/attendance/study sessions/notes/exams. Prints the demo credentials to the console when done.

## Frontend

### `frontend/assets/js/api.js`
The single source of truth for talking to the backend. `apiRequest()` attaches the JWT from `localStorage`, handles JSON parsing, redirects to `login.html` on a 401, and throws a clean `Error` with the backend's message on failure. The exported `API` object has one method per backend endpoint — every other frontend file calls through `API.*`, never `fetch()` directly.

### `frontend/assets/js/common.js`
Shared UI plumbing used by every page: `showToast()`, `openModal()`/`closeModal()`, date formatters, `renderSidebar()` (builds the nav + user info + logout button), `renderMobileTopbar()` (hamburger menu for small screens), `requireAuth()` (redirects unauthenticated users), and `renderPagination()`.

### `frontend/assets/js/auth.js`
Powers `login.html` and `register.html` — form submission, error display, redirect-if-already-logged-in, and a "fill demo credentials" convenience button on the login page.

### Page-specific modules
`dashboard.js`, `tasks.js`, `attendance.js`, `timer.js`, `notes.js`, `exams.js`, `analytics.js`, `subjects.js` — each owns one page's data loading, rendering, and event wiring. `subjects.js` additionally exports `populateSubjectSelect()`, reused by tasks/notes/exams/timer to fill their subject `<select>` dropdowns.

### `frontend/assets/css/`
- `style.css` — the full design system: CSS variables (navy/indigo palette), sidebar, cards, buttons, badges, forms, tables, modals, toasts, task/note/exam/attendance card components, and the base responsive breakpoint that turns the sidebar into a mobile drawer.
- `dashboard.css` — dashboard-only extras (welcome banner, mini-lists).
- `responsive.css` — additional narrow-viewport refinements layered on top of `style.css`.

### HTML pages
`index.html` (redirect gate), `login.html`, `register.html`, `dashboard.html`, `tasks.html`, `attendance.html`, `timer.html`, `notes.html`, `exams.html`, `analytics.html`, `subjects.html`. Every page loads `api.js` → `common.js` → its page module → an inline `init*Page()` call. `analytics.html` additionally loads Chart.js from a CDN.

## Authentication Flow

1. `POST /api/auth/register` or `/login` → backend signs a JWT containing the user's `_id`
2. Frontend stores the token (`localStorage`) and a sanitized user object
3. Every subsequent `API.*` call attaches `Authorization: Bearer <token>` via `api.js`
4. `authMiddleware.protect()` verifies the token and loads the user on every protected route
5. On a 401 (expired/invalid token), `api.js` clears storage and redirects to `login.html`

## Analytics / Aggregation Flow

`GET /api/analytics/dashboard` runs, in sequence:

1. Task stats pipeline — `$match` by `userId` → `$group` with `$cond`/`$sum` accumulators for total/completed/pending/overdue
2. Study-by-subject pipeline — `$match` → `$group` by `subjectId` → `$lookup` into `subjects` → `$unwind` → `$project`
3. Study totals pipeline — overall minutes/sessions
4. Most-productive-day pipeline — `$group` by `$dayOfWeek` → `$sort` → `$limit: 1`
5. Study trend pipeline — `$match` on a 14-day window → `$group` by `$dateToString` per day
6. Attendance pipeline — `$lookup` + computed `percentage` via `$cond`/`$divide`/`$multiply`/`$round`, then a `$facet` stage that splits the result into `all` (every subject) and `belowThreshold` (subjects under the user's threshold) in a single database round trip, rather than filtering the fetched array in application code
7. Overall attendance pipeline — summed totals across all subjects
8. Exam queries — a capped `find().limit(5)` for the dashboard preview list, run in parallel with a separate `Exam.countDocuments()` for the true total count of upcoming exams (so the reported count is correct even when there are more than 5)

All results are merged into a single JSON response consumed by both `dashboard.js` (summary cards) and `analytics.js` (Chart.js visualizations).

## Authorization: Subject Ownership Validation

Any resource that lets the client attach a `subjectId` — Task, Note, Exam, StudySession — routes that value through `backend/utils/verifySubjectOwnership.js` before saving. This confirms the subject exists **and** belongs to `req.userId`, returning a 404 if not (or a 400 for a malformed id). This prevents a user from referencing another user's subject on their own data. Attendance validates subject ownership inline in `attendanceController.js` (it already needed to look up the subject to perform the upsert). `Subject` update itself uses an explicit field allow-list rather than trusting the raw request body, so a client can't smuggle a `userId` reassignment through `PATCH /api/subjects/:id`.

## MongoDB Techniques Demonstrated (file-by-file)

1. **CRUD** — every controller in `backend/controllers/`
2. **Embedded documents** — `Task.subtasks` in `backend/models/Task.js`
3. **ObjectId references** — `userId`/`subjectId` fields throughout `backend/models/`
4. **Aggregation pipelines** — `backend/controllers/analyticsController.js`
5. **Single-field indexes** — `backend/models/Task.js` (`userId`), `StudySession.js` (`subjectId`), `Exam.js` (`examDate`), etc.
6. **Compound index** — `TaskSchema.index({ userId: 1, status: 1, deadline: 1 })` in `backend/models/Task.js`
7. **Text index** — `NoteSchema.index({ title: 'text', content: 'text' })` in `backend/models/Note.js`, queried in `backend/controllers/noteController.js`
8. **Schema validation** — `required`, `enum`, `min`/`max`, regex — throughout `backend/models/`
9. **Multi-document transactions** — `backend/services/transactionService.js`
10. **Pagination** — `backend/controllers/taskController.js` and `noteController.js` (`page`/`limit`/`skip`/`limit()`, with `pagination` metadata in the response)
11. **Projection** — `.select(...)` in `taskController.js`'s `listTasks`
12. **Upsert** — `backend/controllers/attendanceController.js`'s `markAttendance`
13. **Array operations** — `$push`/`$pull`/`$set`/`$elemMatch` in `backend/controllers/taskController.js`'s subtask endpoints
