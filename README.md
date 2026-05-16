# Cooler Duty Web App

A Vercel-ready hostel cooler duty app for the Tuesday-to-Sunday roster:

- Monday: All off
- Tuesday: Abdullah
- Wednesday: Zulaqarnain
- Thursday: Huzefa
- Friday: Taqi
- Saturday: Ali
- Sunday: Mumtaz

The app shows the active 24-hour turn from 12:00 AM to the next 12:00 AM, a live countdown, roommate status, cooler level, check-ins, swap requests, admin reminders, and a private alarm for the person whose turn is active.

## Run Locally

Open `index.html` in a browser, or serve the folder:

```bash
node serve-preview.mjs
```

The app works in local demo mode by default. Data is saved in the browser and shared between tabs on the same device.

## Admin

Default admin PIN:

```text
7860
```

Change it in `app.js`:

```js
const ADMIN_PIN = "7860";
```

This PIN is only for roommate-level control in a static frontend. For stronger security later, move admin actions behind Firebase Auth or a Vercel serverless API.

## Real Multi-Phone Sync

For reminders and alarms to appear on every roommate's phone, connect Firebase Realtime Database:

1. Create a Firebase project.
2. Add a web app in Firebase.
3. Create a Realtime Database.
4. Copy the Firebase web config into `firebase-config.js`.
5. In development, you can use open test rules:

```json
{
  "rules": {
    "hostelCooler": {
      ".read": true,
      ".write": true
    }
  }
}
```

Use stricter rules before sharing publicly.

## Deploy To Vercel

1. Push this folder to GitHub.
2. Open Vercel and select **Add New Project**.
3. Import the GitHub repo.
4. Framework preset: **Other**.
5. Build command: leave empty.
6. Output directory: leave empty.
7. Deploy.

If Firebase is configured, the deployed app will sync reminders, check-ins, alarms, and roommate status across devices.
