# Firebase Integration Task List

- [x] Analyze codebase and identify dependencies
- [x] Set up Firebase Client SDK singleton (`lib/firebase-client.ts`)
- [x] Set up Firebase Admin SDK singleton (`lib/firebase-admin.ts`)
- [x] Implement `AuthProvider` and `useAuth` hook (`hooks/useAuth.tsx`)
- [x] Create API route for session management (`app/api/auth/login/route.ts`)
- [x] Enhance middleware for route protection (`middleware.ts`)
- [x] Create secure user info API (`app/api/users/me/route.ts`)
- [x] Define Firestore security rules (`firestore.rules`)
- [x] Define RTDB security rules (`firebase.rules`)
- [x] Consolidate `lib/db.ts` to use Firebase
- [x] Cleanup redundant/broken auth files
- [x] Update project documentation (`ANALYSIS.md`, `.env.example`)
- [x] Fix Zod type errors in `schema.ts`
- [x] Fix lint errors in `firebase-services.ts`
- [ ] Migrate S3 uploads to Firebase Storage (Pending location of `ChatWindow.jsx`)
