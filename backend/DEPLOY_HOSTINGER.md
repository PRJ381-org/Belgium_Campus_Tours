# Deploying the PRJ381 backend to Hostinger

This is one Node application. It serves **both** the API the VR headsets talk to
and the staff dashboard, from the same folder and the same process. There is no
separate site to upload for the dashboard.

Target: Hostinger Cloud Hosting, **Node.js Selector** (CloudLinux), which runs the
app under **Phusion Passenger**.

---

## Before you start

You need three values. They are **not** in the zip and must never be committed:

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (includes the password) |
| `JWT_SECRET` | Any long random string. Signs dashboard login sessions. |
| `CORS_ORIGIN` | The dashboard's public URL, e.g. `https://prj381.example.com` |

Get them from whoever manages the Atlas cluster. `.env.example` in the zip lists
them with comments.

> **Do not create a `.env` file on the server.** Set these in hPanel instead
> (step 4). hPanel-set variables are injected by Passenger and are what the app
> reads in production.

---

## 1. Create the Node application in hPanel

hPanel → **Advanced** → **Node.js** → *Create Application*

| Field | Value |
|---|---|
| Node.js version | **20 or newer** |
| Application mode | `Production` |
| Application root | e.g. `domains/yourdomain.com/prj381` |
| Application URL | the domain or subdomain the dashboard will live on |
| Application startup file | `src/index.js` |

`src/index.js` is the startup file, **not** `app.js`. Getting this wrong is the
most common cause of "the app won't start".

Leave the page open — you'll need the *Application root* path and the
**"Enter to the virtual environment"** command it shows you.

---

## 2. Upload and extract

Upload `prj381-backend.zip` into the **Application root** you just set, then
extract it there.

After extracting, the application root must look like this — with
`package.json` at the **top level**, not inside a subfolder:

```
prj381/
  package.json
  package-lock.json
  .env.example
  DEPLOY_HOSTINGER.md
  src/
    index.js
    app.js
    ...
  public/          <- the dashboard (built React site)
    index.html
    login.html
    dashboard.html
    assets/        <- images
    static/        <- bundled JS/CSS
```

There is no `client/` folder on the server. `client/` is the React source code;
it is built into `public/` before shipping and is never uploaded.

If you instead see `prj381/prj381-backend/package.json`, the zip was extracted
one level too deep. Move the contents up a level.

---

## 3. Install dependencies

The zip is **slim** — it deliberately contains no `node_modules`. Dependencies
must be installed on the server so they match the server's Node version.

Easiest: in hPanel's Node.js page, press **Run NPM Install**.

Or over SSH — you must activate the app's virtual environment first, otherwise
you install against the wrong Node:

```bash
# Copy this exact line from the hPanel Node.js page ("Enter to the virtual environment")
source /home/USERNAME/nodevenv/domains/yourdomain.com/prj381/20/bin/activate
cd ~/domains/yourdomain.com/prj381

npm ci --omit=dev
```

`npm ci` installs the exact versions pinned in `package-lock.json`. `--omit=dev`
skips test and build tooling, which the server does not need.

If `npm ci` complains that the lockfile is out of sync, use
`npm install --omit=dev` instead.

---

## 4. Set the environment variables

hPanel → Node.js → your app → **Environment variables**. Add:

| Name | Value |
|---|---|
| `MONGODB_URI` | *(the Atlas string)* |
| `JWT_SECRET` | *(the long random string)* |
| `CORS_ORIGIN` | *(the dashboard's public URL)* |
| `NODE_ENV` | `production` |

Do **not** set `PORT`. Passenger assigns it and passes it in; overriding it stops
the app being reachable.

### Optional: Microsoft sign-in

Only needed for "Sign in with Microsoft". Leaving them unset is fine — the rest
of the app works normally.

| Name | Needed for |
|---|---|
| `MS_CLIENT_ID`, `MS_TENANT_ID` | "Sign in with Microsoft" on the dashboard |

The Open Day feedback form needs no extra settings: responses are stored in
MongoDB alongside leads and analytics. (It used to read a Google Sheet, which
needed Google service-account keys; that has been removed.)

`CORS_ORIGIN` accepts a comma-separated list if you need more than one origin,
e.g. `https://prj381.example.com,https://www.prj381.example.com`. It controls
which *websites* may call the API from a browser. The headsets are unaffected by
it — they send no `Origin` header.

---

## 5. Restart

hPanel → Node.js → **Restart**.

Over SSH, the equivalent is:

```bash
mkdir -p tmp && touch tmp/restart.txt
```

Passenger watches that file and reloads on the next request. You must restart
after any environment-variable change — they are read once at startup.

---

## 6. Check it worked

Visit `https://your-app-url/health`. You should get JSON like:

```json
{
  "status": "ok",
  "version": "0.2.0",
  "env": "production",
  "db": "connected",
  "startedAt": "2026-08-26T09:00:00.000Z"
}
```

Check these three things:

- **`"db": "connected"`** — the app reached Atlas. If this says `disconnected` or
  `connecting`, see troubleshooting below. Note the app starts and serves the
  dashboard *regardless* of the database, so reaching this page at all already
  tells you Passenger, the startup file and `npm ci` are all correct.
- **`"version"`** matches the version in `package.json` you uploaded. This is how
  you confirm the new code actually replaced the old.
- **`"startedAt"`** is a few seconds ago, i.e. the restart really happened.

Then visit `https://your-app-url/` — you should land on the dashboard login page.

---

## Troubleshooting

**`"db": "disconnected"` in /health — expect this on the very first boot**

The app is running but cannot reach MongoDB. On a brand-new host this is the
*likely* first result, and it is not a broken deployment. Almost always one of:

1. Atlas **Network Access** does not allow the server's IP. The allowlist was
   written for the old Azure deployment, so Hostinger's outbound IP is not on it
   yet. Add it in Atlas → Network Access.
2. `MONGODB_URI` is wrong, or was set but the app was not restarted afterwards.

**You do not need to restart after fixing the Atlas allowlist.** The app retries
in the background — first after 5s, backing off to every 60s — so it picks the
database up on its own within a minute of Atlas being fixed. Watch `/health`
flip to `"connected"`.

Every failed attempt is logged to `stderr.log` and says so plainly:

```
MongoDB connection attempt 3 failed: <reason> | retrying in 20000ms | the app is
still serving requests and /health will report db:"disconnected" until this succeeds
```

(You *do* still need to restart after changing `MONGODB_URI` itself — env vars
are read once at startup.)

**Passenger error page instead of the dashboard**

This means the process did not start at all — and since a database failure no
longer stops startup, the cause is something else. Check `stderr.log` in the
application root. Most likely: `npm ci` was not run, or the startup file is not
set to `src/index.js`.

**API calls return 503 "Database unavailable"**

This is what a database outage is supposed to look like. The app is up, the
dashboard is served, and the endpoints that need MongoDB say so immediately
instead of hanging. Fix the connection (above) and the 503s stop on their own.

Not everything 503s: `/health`, the dashboard itself and `/api/auth/me` keep
working, because none of them touch MongoDB.

**The dashboard loads but every panel shows an error**

The dashboard calls the API on its own origin, so this normally means the API is
up but the database is not — check `/health` first.

---

## Maintenance scripts (optional — not part of deployment)

These ship in the zip but **nothing runs them automatically**. Both report what
they would do and change nothing unless you add `--apply`. Run them from the
application root, inside the activated virtual environment.

```bash
# Backfill the "source" field on leads created before that field existed.
node src/scripts/migrate-leads.js            # report only
node src/scripts/migrate-leads.js --apply

# Create the stricter database indexes (unique keys, 12-month telemetry expiry).
node src/scripts/enable-indexes.js           # preflight report only
node src/scripts/enable-indexes.js --apply
```

`enable-indexes.js` checks the existing data first and refuses to build a unique
index that current rows would violate, telling you which rows are at fault. It
is not required for the app to work — the app runs correctly without any of it.

> Run `migrate-leads.js` **before** `enable-indexes.js`, and read the dry-run
> output both times. `enable-indexes.js --apply` adds a 12-month expiry to
> telemetry, which deletes analytics events older than that. Leads are never
> given an expiry.

---

## Rolling back

The old Azure deployment is still in place and untouched. Its GitHub Actions
workflow no longer runs automatically; it can be triggered by hand from the
repository's **Actions** tab if we need to fall back to it.

---

## Rebuilding the zip

From the `backend/` folder of the repository:

```bash
npm install          # once
npm run build:client # rebuilds public/ from the React source in client/
npm test             # should pass before you ship anything
npm run package      # writes dist/prj381-backend.zip
```

`public/` is committed already built, so if you only changed backend code you
can skip `build:client`. Never edit files in `public/` by hand — they are
overwritten on the next build. Edit `client/` instead.

The build refuses to produce a zip containing a `.env` file, and checks that
`package.json`, `src/index.js` and `public/index.html` are where Passenger and
Express expect them.

To bundle dependencies instead of installing on the server (only needed if SSH
and NPM Install are both unavailable):

```bash
npm run package -- --with-modules
```
