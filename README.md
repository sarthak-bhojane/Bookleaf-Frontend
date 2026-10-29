# BookLeaf Author Support Portal

A React + Node application for author publishing dashboards and an operations ticket queue. The sample dataset is seeded on first API startup (10 authors and 18 books). Authors can sign in to see only their own books and tickets; the operations account can triage every ticket and send reviewed replies.

## Run locally

Requirements: Node.js 18.17+ and npm.

```sh
npm install
Copy-Item .env.example .env
# Set JWT_SECRET to a long, random value in .env before sharing the app.
npm run dev
```

Create React App serves the UI at `http://localhost:3000`; the API is at `http://localhost:4000/api`. CRA proxies `/api` to Node during development. `npm start` starts only the CRA frontend, while `npm run start:api` starts only the API; `npm run dev` starts both. The first API startup initializes `server/data/store.json`; subsequent startups keep ticket activity in that local file. Remove only that generated file if you intentionally want to restore the original demo seed.

### Demo logins

| Portal | Email | Password |
| --- | --- | --- |
| Author | `priya.sharma@email.com` | `bookleaf123` |
| Author | `rohit.kapoor@email.com` | `bookleaf123` |
| Author | `ananya.reddy@email.com` | `bookleaf123` |
| Operations | `admin@bookleaf.com` | `admin123` |

All 10 seeded authors use `bookleaf123`. These are evaluation/demo credentials only; replace the authentication and credential-management approach before production use.

## Architecture and AI

- **Client:** Create React App (`react-scripts`), React, and responsive CSS. It uses one authenticated app shell and role-aware navigation, with separate author and operations workflows.
- **API:** Express REST routes in `server/index.js`; authentication is a signed 12-hour JWT, and passwords are stored as bcrypt hashes. Authorization is enforced in the API, not trusted to the UI. Authors can only retrieve their own books/tickets; internal notes are omitted from all author responses.
- **Persistence:** A small atomic-write JSON store avoids requiring a database for the take-home demo and persists tickets across local restarts. Uploaded attachments are kept as private files under `server/data/attachments`; downloads require authentication and ticket ownership or operations access. It is intentionally single-process and not suitable for concurrent production instances.
- **AI model:** Optional OpenAI Chat Completions using `gpt-4o-mini` by default. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the server `.env`; keys stay on the server and are never sent to the browser. The model is called once during ticket creation to classify category/priority and when an operator opens a ticket to prepare an editable reply draft. The operator can also request a fresh draft.
- **Prompt and cost strategy:** Classification sends only the new subject and description and requests a constrained JSON result. Drafting sends the current ticket fields, author name, selected book title, and a short category-specific Knowledge Base excerpt; it does not resend other tickets or full conversation history. Drafts are capped at 300 generated tokens, appear as editable text, and are never sent without an operator review.
- **Graceful degradation:** Without a key, or when the provider times out, returns an error, or produces invalid output, the API records a local-rule classification and provides a policy-guided draft. Ticket creation does not depend on AI availability. The admin can edit the draft, change classification/priority, or write a reply from scratch.
- **Near-real-time updates:** Both portals refresh ticket lists every seven seconds; this keeps the demo simple without a persistent WebSocket service.

## API

All routes are prefixed by `/api`. Except for health and login, requests require `Authorization: Bearer <token>`. JSON errors use `{ "error": { "code": "...", "message": "..." } }`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API health check |
| `POST` | `/auth/login` | Public | Sign in with `{ "email", "password" }`; returns JWT and public user |
| `GET` | `/auth/me` | Authenticated | Current account profile |
| `GET` | `/books` | Authenticated | Author’s books; operations account sees all books |
| `GET` | `/authors` | Operations | List author profiles |
| `GET` | `/tickets?status=&category=&priority=&q=` | Authenticated | Own tickets for authors; all tickets for operations |
| `POST` | `/tickets` | Author | Create a `multipart/form-data` request with `bookId`, `subject`, `description`, and optional `attachment` file (PDF/PNG/JPG/WEBP, up to 5 MB) |
| `GET` | `/tickets/:id` | Ticket owner or operations | Ticket detail; internal notes are operations-only |
| `GET` | `/tickets/:id/attachments/:attachmentId` | Ticket owner or operations | Download a ticket attachment |
| `PATCH` | `/tickets/:id` | Operations | Change `{ "status", "category", "priority", "assignToMe" }` |
| `POST` | `/tickets/:id/messages` | Operations | Send author-visible `{ "text" }`; open tickets move to In Progress |
| `POST` | `/tickets/:id/notes` | Operations | Add an internal-only `{ "text" }` note |
| `POST` | `/tickets/:id/draft` | Operations | Generate or locally fall back to a draft; returns `{ "draft", "source" }` |

Ticket list query filters accept `Open`, `In Progress`, `Resolved`, `Closed`; the six categories in the assignment; and `Critical`, `High`, `Medium`, `Low`. Unsupported values return a validation error.

## Build and run

```sh
npm run build
npm run serve
```

For local production testing, start the API with `npm run serve` and serve the generated `build/` directory with a static host.

For production, configure a strong `JWT_SECRET`, `CLIENT_ORIGIN`, and (if using AI) `OPENAI_API_KEY`. A production deployment should use a managed database, secret manager, secure password reset, rate limiting, structured logs, and HTTPS.

## Known limitations

- The JSON persistence store and local attachment files are for a single local/demo process, not multi-instance deployment; back up `server/data` to retain demo activity and uploads. Attachment files are excluded from version control.
- Attachments are limited to one PDF, PNG, JPG, or WEBP file up to 5 MB per ticket.
- Authentication uses seeded demo passwords and has no registration, OTP, or password reset.
- Updates use seven-second polling rather than push/WebSockets.
- Drafts are prepared when an operations agent opens a ticket, remain editable, and require review before sending; the rules fallback is deliberately conservative and can be overridden.
- No live deployment is included because deployment credentials/target were not supplied.

## Assignment approach

See [APPROACH.md](./APPROACH.md) for the brief prioritization and production evolution note.
