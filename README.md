## Setup
pnpm install
cp .env.example .env

## Starting the app
Both apps at once:
pnpm dev

**Backend**
pnpm --filter api dev

Runs the Fastify API on `http://localhost:3000`. Check it's up with `curl http://localhost:3000/health`.

**Frontend**
pnpm --filter web dev (Runs on `http://localhost:5173`.)