# Nantucket Event Co. Operations

This is a role-based web scheduling system for Nantucket Event Co. tent-rental operations. It replaces a season-long WhatsApp schedule and separate paper pack lists with one structured source of truth.

## MVP features

- Admin, owner, and staff accounts with role-based access
- iOS-inspired month calendar with multiple events per day
- Structured daily plans with flexible timeline entries
- Event pack lists connected to live inventory counts
- Staff assignments, individual call times, and instructions
- Vehicle, driver, destination, and load assignments
- Owner/admin inventory management with images, sizes, counts, and notes
- Admin team-account management
- Mobile-first staff field brief with oversized times and quantities
- Local SQLite-compatible libSQL database for development
- Environment-only deployment configuration; no absolute app URL is embedded in code

## Local setup

Requirements:

- Node.js 20.19+, 22.12+, or 24+
- npm

Install and initialize:

```bash
npm install
cp .env.example .env.local
npm run db:setup
npm run dev:3003
```

Open `http://localhost:3003`.

Port `3000` is currently used by a separate local project. The dedicated
`dev:3003` and `start:3003` commands avoid that collision without stopping or
modifying the other app.

The checked-out project already has a local `.env.local` and seeded database. Re-running `npm run db:seed` is safe: it skips seeding when users already exist.

## Demo accounts

Demo mode is controlled by `DEMO_MODE`. When enabled, the sign-in screen provides one-click account selection.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@porter.local` | `ChangeMeAdmin123!` |
| Owner | `owner@porter.local` | `ChangeMeOwner123!` |
| Staff | `staff@porter.local` | `ChangeMeStaff123!` |

Change all seed passwords before using real operational data. Set `DEMO_MODE="false"` in production.

## Environment configuration

All deployment-specific values live in environment variables:

- `APP_NAME`
- `COMPANY_NAME`
- `COMPANY_TIMEZONE`
- `COMPANY_WEBSITE_URL`
- `AUTH_SECRET`
- `SESSION_COOKIE_NAME`
- `DEMO_MODE`
- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`
- `SEED_*` account values

Generate a production authentication secret with:

```bash
openssl rand -hex 32
```

## Database and deployment

The app uses libSQL through Drizzle ORM.

For local development:

```env
DATABASE_URL="file:./porter.db"
DATABASE_AUTH_TOKEN=""
```

For a serverless production deployment, use a persistent remote libSQL database such as Turso:

```env
DATABASE_URL="libsql://your-database.turso.io"
DATABASE_AUTH_TOKEN="your-token"
```

Run migrations against the configured database:

```bash
npm run db:migrate
```

Then seed only if the deployment needs demo/initial accounts:

```bash
npm run db:seed
```

Do not use a local `file:` database on Vercel because serverless filesystems are not persistent.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Or run the full gate:

```bash
npm run check
```

## Data-safety choices

Inventory, vehicles, and team accounts are archived/deactivated instead of physically deleted. This preserves historical event records and prevents old schedules from becoming unreadable. Events themselves can be deleted by admin or owner users.
