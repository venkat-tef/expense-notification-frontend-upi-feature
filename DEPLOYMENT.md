# Deployment guide

## Prerequisites

- Node.js 18+ and npm
- A Firebase project with **Firestore** and **Anonymous Authentication** enabled
- Firebase CLI: `npm install -g firebase-tools`

## 1. Install dependencies

```bash
npm install
```

## 2. Add your Firebase config

Edit both:
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

and paste in the values from **Firebase Console → Project Settings → Your apps → SDK setup and configuration**.

## 3. Develop locally

```bash
ng serve
```

## 4. Log in to Firebase & link the project

```bash
firebase login
firebase use --add
```
Select your Firebase project and give it the alias `default`
(or update `.firebaserc` with your project id directly).

## 5. Deploy Firestore rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 6. Build for production

```bash
ng build --configuration production
```
This outputs to `dist/roommate-manager/browser`, which matches the
`hosting.public` path already set in `firebase.json`.

## 7. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

Or do build + deploy in one step:

```bash
npm run deploy
```

## 8. (First time only) Initialize Firebase in a fresh clone

If you're starting from this exported source without a `.firebaserc` pointing
at your project:

```bash
firebase init
```
- Choose **Firestore** and **Hosting**.
- Use existing `firestore.rules` / `firestore.indexes.json`.
- Public directory: `dist/roommate-manager/browser`
- Configure as a single-page app: **Yes**
- Set up automatic builds/deploys with GitHub: optional

Then deploy as in step 7.
