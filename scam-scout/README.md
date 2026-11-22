# Scam Scout

A game that trains people to spot phishing emails, scam texts and fake calls.

- `app/`: the Expo app for iOS and Android (Expo Router, TypeScript).
- `server/`: the backend (Fastify + Node's built-in SQLite, TypeScript).

## Run it locally

You need Node 22.13 or newer.

### 1. Start the backend

```bash
cd server
cp .env.example .env      # then set JWT_SECRET
npm install
npm run dev               # http://localhost:4000
```

`npm test` runs the API tests.

### 2. Start the app

```bash
cd app
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm install
npx expo start
```

Then press `i` for the iOS simulator or `a` for the Android emulator.

- **On a real phone:** set `EXPO_PUBLIC_API_URL` to your computer's LAN address, for example `http://192.168.1.20:4000`.
- **Android emulator:** it reaches your computer at `10.0.2.2`, which is the app's default on Android.
- **Expo Go vs a development build:** Apple and Google sign-in need a development build (`npx expo run:ios`, `npx expo run:android`, or `eas build --profile development`). Email sign-up works in Expo Go.

## How the game works

| Mode | Rounds | Rules |
|---|---|---|
| Phishing Emails, Scam Messages, Scam Calls | 10 | You see right or wrong after each round. |
| Daily challenge | 10 texts | 3-minute clock. |
| Marathon | Endless | Ends after 3 wrong in a row. A right answer resets the count. |
| Ranked | 15 mixed | 20-minute clock, Guide locked, right or wrong hidden until the match ends. The higher score wins ELO. A draw moves no ELO and offers a rematch. |
| Casual duel | 10 mixed | Against a friend, no ELO. |

Scoring: right call +60, plus right reason +40 (only when the call is right).

All scoring happens on the server. Answers are never sent to the app before a round is answered.

### Ranked

- **Placements:** your rank appears after 5 placement matches.
- **Matchmaking:** pairs players within an ELO window that widens the longer they wait.
- **Practice bot:** with `MATCH_BOTS=1`, anyone waiting alone for 15 seconds is paired with ScoutBot. Use this for development only.

## Before going live

- **Secrets:** set a long random `JWT_SECRET` and turn off `MATCH_BOTS` and `DEV_EMAIL_LINKS`.
- **Email:** hook an email provider into `issueLink` in `server/src/routes/auth.ts`. Confirmation and reset links are currently only printed to the log.
- **Google sign-in:** create OAuth client IDs. Put them in the app's `.env` and in the server's `GOOGLE_CLIENT_IDS`.
- **Apple sign-in:** turn on "Sign in with Apple" for the bundle ID (`com.scamscout.app`, set in `app/app.json`) and set `APPLE_BUNDLE_ID` on the server.
- **Database:** the SQLite file is fine for one server. Move to Postgres if you need several.
