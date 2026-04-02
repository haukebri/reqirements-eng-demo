# RequirementsAI

An agentic requirements engineering platform powered by LLMs. Facilitates structured knowledge extraction (facts, questions, inferences, contradictions) through multi-agent conversation.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Install root dev dependencies (Playwright etc.)
npm install

# Install backend dependencies
cd backend && npm install

# Create a .env file in backend/
cp backend/.env.example backend/.env
# Fill in DATABASE_URL and MISTRAL_API_KEY
```

### Run

```bash
# Start the backend (compiles TS and runs migrations on first start)
cd backend
npm run dev
```

The app is available at `http://localhost:3001`.

---

## Docker (Local)

Build and run the full stack (app + PostgreSQL) with Docker Compose:

```bash
MISTRAL_API_KEY=your_key docker compose up --build
```

The app is available at `http://localhost:3001`.

---

## Hosting on CapRover

[CapRover](https://caprover.com/) is a self-hosted PaaS that deploys Docker-based apps with zero config overhead. The `captain-definition` file in this repository's root tells CapRover to build using the existing `Dockerfile`.

### 1. Install CapRover on a VPS

Follow the [official CapRover installation guide](https://caprover.com/docs/get-started.html). You need:

- A VPS with at least 1 GB RAM (2 GB recommended)
- Docker installed
- Ports 80, 443, and 3000 open

```bash
# On your VPS:
docker run -p 80:80 -p 443:443 -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /captain:/captain \
  caprover/caprover
```

Then visit `http://<your-vps-ip>:3000` to complete the setup wizard.

### 2. Create a PostgreSQL app

In the CapRover dashboard:

1. Go to **One-Click Apps** and deploy **PostgreSQL**.
2. Note the app name (e.g., `postgresql`) and the credentials you set.
3. Your internal database URL will be:

```
postgres://<user>:<password>@srv-captain--postgresql:5432/<dbname>
```

> CapRover apps on the same server communicate via the `srv-captain--<app-name>` hostname.

### 3. Create the RequirementsAI app

In the CapRover dashboard:

1. Go to **Apps** → **Create New App**.
2. Name it (e.g., `requirements-ai`). Enable **Has Persistent Data** only if needed.
3. Go to the app's **App Configs** tab and set the following environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgres://<user>:<password>@srv-captain--postgresql:5432/<dbname>` |
| `MISTRAL_API_KEY` | Your Mistral API key |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |

4. In **HTTP Settings**, set the container port to `3001` and enable **Force HTTPS** if you have a domain configured.

### 4. Deploy

**Option A — CapRover CLI (recommended)**

```bash
# Install the CapRover CLI
npm install -g caprover

# Deploy from your local machine
caprover deploy
```

The CLI will ask for your CapRover URL, password, and app name. It then packages the repository and deploys it. CapRover reads `captain-definition` and builds with the `Dockerfile`.

**Option B — GitHub webhook / tarball upload**

- Zip the repository root (excluding `node_modules`) and upload via the CapRover dashboard under **Deployment** → **Upload Tarball**.

### 5. Database migrations

Migrations run automatically on each container start via the Docker `CMD`:

```
node backend/dist/src/db/migrate.js && node backend/dist/src/index.js
```

No manual migration step is needed after deploying.

### 6. Verify

After deployment, visit your CapRover app URL. You should see the RequirementsAI interface.

Check logs in the CapRover dashboard under **Apps** → **requirements-ai** → **App Logs** if the app fails to start.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MISTRAL_API_KEY` | Yes | API key for Mistral AI (LLM orchestration) |
| `NODE_ENV` | No | Set to `production` for production builds |
| `PORT` | No | HTTP port (default: `3001`) |

---

## Architecture

See [docs/architecture/adr-001-tech-stack.md](docs/architecture/adr-001-tech-stack.md) for full technology decisions.

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (served as static files from the backend) |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| LLM | Mistral AI |
| Real-time | Server-Sent Events (SSE) |
| Container | Docker (multi-stage build) |
