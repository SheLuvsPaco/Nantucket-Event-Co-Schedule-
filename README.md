# Nantucket Event Co. Operations

This is a role-based Progressive Web App (PWA) for Nantucket Event Co. tent-rental operations. It replaces a season-long WhatsApp schedule and separate paper pack lists with one structured source of truth.

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
- Installable phone experience with standalone display, home-screen icons, automatic service-worker updates, cached static assets, and a safe offline fallback

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
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
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

The Vercel Turso marketplace integration provides `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN`; the app supports those names automatically.

Run migrations against the configured database:

```bash
npm run db:migrate
```

Then seed only if the deployment needs demo/initial accounts:

```bash
npm run db:seed
```

To copy an existing database into a newly migrated, empty database, set
`SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, and
`TARGET_DATABASE_AUTH_TOKEN`, then run `npm run db:copy`. The command refuses
to overwrite a populated target and verifies every copied table count.

Do not use a local `file:` database on Vercel because serverless filesystems are not persistent.

Copy `.env.production.example` into the production platform’s environment
settings. Do not commit a real `.env.production` file. The browser and API
calls use same-origin relative paths, so the app does not require a hardcoded
production base URL.

Inventory and vehicle uploads are stored in the project’s public Vercel Blob
store. The upload route accepts JPG, PNG, WebP, GIF, and AVIF images up to 4 MB,
uses collision-safe filenames, and removes replaced or abandoned managed
uploads when they are no longer referenced by the database.

## PWA behavior

The PWA implementation uses the Next.js App Router manifest convention and a
small first-party service worker. It intentionally does not cache authenticated
HTML, API responses, uploads, or mutations. This prevents one employee’s
schedule from being exposed to another account on a shared device.

Cached resources are limited to:

- The offline fallback shell
- PWA icons and the company logo
- Versioned Next.js JavaScript, CSS, and fonts
- Same-origin application images

Build and start the production app for PWA testing:

```bash
npm run build
npm run start:3003
```

Then verify in browser developer tools:

1. **Application → Manifest:** name, icons, theme colors, start URL, and
   standalone display are recognized.
2. **Application → Service Workers:** `/sw.js` is activated and controlling the
   page.
3. Enable **Offline** and navigate or refresh. The branded offline shell should
   load without exposing cached schedule data.

Service workers require HTTPS outside `localhost`. Opening a LAN address over
plain HTTP is not a valid install test on most phones. Use the deployed HTTPS
URL or an HTTPS development tunnel for real-device installation.

On iPhone/iPad, open the HTTPS site in Safari and use **Share → Add to Home
Screen**. On Android, use the browser’s **Install app** or **Add to Home
Screen** action.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run pwa:verify
```

Or run the full gate:

```bash
npm run check
```

## Data-safety choices

Inventory, vehicles, and team accounts are archived/deactivated instead of physically deleted. This preserves historical event records and prevents old schedules from becoming unreadable. Events themselves can be deleted by admin or owner users.
