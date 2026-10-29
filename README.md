# TODA GO — Cantilan Pilot (Web App)

A starter project for the TODA GO tricycle booking concept. It includes a passenger/driver mode, OpenStreetMap-based map, Supabase auth, driver GPS updates while the driver page is open, booking requests, accept/reject controls, and realtime refreshes.

**This is a pilot starter, not a production-ready transport platform.** It needs project credentials, security review, real-device tests, and push-notification setup before public use.

## 1. What you need

- A computer for initial setup (Windows, Mac, or Linux)
- Node.js 20 or newer
- A free Supabase project: https://supabase.com
- A browser with internet access
- For GPS: serve the app over HTTPS (localhost is also allowed during development)

## 2. Set up the database

1. Create a new Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase/schema.sql` from this project, copy all of it, and run it in SQL Editor.
4. In Supabase project settings, make sure email/password authentication is enabled.
5. In **Project Settings / API** (or Connect), copy the project URL and the publishable/anon key. Do not use a service-role key in browser code.

## 3. Run locally

```bash
npm install
cp .env.example .env
```

Open `.env` and set:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Then:

```bash
npm run dev
```

Open the local URL shown in the terminal. For testing booking, create two separate accounts in two browser sessions: one passenger and one driver. The driver should open Driver mode, save a profile, grant location permission, then go online.

## 4. Deploy the web app

### Netlify or Vercel

1. Upload this project to a private GitHub repository.
2. Import the repository in Netlify or Vercel.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the host dashboard.
6. Deploy, then open the HTTPS URL on your phone.
7. In Supabase Auth URL Configuration, add the deployed site URL to **Site URL** and allowed **Redirect URLs** as appropriate.

You can also deploy through Replit by importing/uploading the project files and setting the same environment variables. Never paste secret service-role keys into client-side environment variables.

## 5. Current limitations / next work

- Map starts at an approximate Cantilan town-center coordinate. It is not an official pickup point. Map tiles come from OpenStreetMap.
- Driver location updates while the driver page is open and permission is granted. Mobile browsers may suspend GPS when backgrounded.
- The demo lists online drivers and lets a signed-in passenger request a ride. The current SQL update policy is intentionally a basic pilot policy and is **not enough for public production**; use a server-side atomic claim function, validate driver eligibility, and enforce a strict booking state machine before public use.
- The current in-app notice is not a push notification. For push notifications, add a service worker plus Web Push/FCM or a supported notification service, with server-side sending.
- No fare calculation, route ETA, payments, identity verification, driver license validation, customer support workflow, or emergency feature is implemented.
- Add rate limits, audit logs, data retention rules, privacy notice/consent, and abuse prevention before launch.
- Only collect/share location during an explicit active driver session, and stop tracking when the driver goes offline.

## 6. Suggested pilot test

1. Test with one trusted driver account and one passenger account.
2. Confirm that only consenting drivers share location.
3. Test request → accept/reject → status update using two phones.
4. Test slow/no internet, GPS denied, page refresh, duplicate requests, and signing out.
5. Ask a small group of local drivers and passengers to test before inviting the public.
