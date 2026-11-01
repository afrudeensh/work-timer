# Work Timer

Track daily working hours (8h target) and a weekly 40h timesheet.

- **Start day** starts the clock. Office time always runs.
- **Take a break** pauses *working* time only. **Resume work** continues it.
- Working time keeps running past 8h (shown as overtime).
- **Weekly report**: chart, timesheet, and the hours balance left for the 40h week.
- **Monthly and yearly reports**: totals, average per day, chart, weekly breakdown (month) and month-by-month table (year). Targets are 8h × Monday-to-Friday days; holidays and leave are not subtracted.

Stack: Angular 20, Supabase (Auth + Postgres with RLS), Chart.js, Netlify.

## Run locally
```bash
npm install
npm start        # http://localhost:4200
```

## Supabase
Tables `work_days` and `breaks` (row level security, each user sees only their own data) and the view `daily_summary` are already created.
Keys are in `src/app/supabase.config.ts` (publishable key, safe for the browser).
In Supabase: Authentication > URL Configuration, set **Site URL** to your Netlify URL so confirmation emails link correctly.

## Deploy (Netlify)
Push to GitHub, then Netlify > Add new site > Import from Git. `netlify.toml` already has the build command, publish folder (`dist/work-timer/browser`) and SPA redirect.

## Sign-in options
Email and password (with validation, show/hide password, forgot password) and Google.
In Supabase set: Authentication > URL Configuration > **Site URL** and **Redirect URLs** (add `http://localhost:4200` and your Netlify URL).
For Google: Authentication > Providers > Google, add a Google Cloud OAuth client ID and secret, and add the Supabase callback URL to the Google client.
To sign in straight after sign-up, turn off **Confirm email** (Authentication > Providers > Email).
