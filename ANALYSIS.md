# Codebase Analysis Summary

## PROJECT: bolpur-mart
## STACK: Next.js 14.2.16 + TypeScript + Tailwind CSS + Radix UI (shadcn/ui)
## ROUTER: App Router
## DATABASE: Firebase (Firestore & Realtime Database) - **Unified**
- `lib/db.ts` is now a unified wrapper for Firebase services.
- Vercel Postgres/Drizzle removed to simplify architecture.
- RTDB handles messages.
- Firestore handles products, carts, orders, and services.

## AUTHENTICATION: Firebase Auth (Session Cookies) - **Robust**
- `hooks/useAuth.tsx` provides global auth state and synchronization.
- Middleware provides secure route guarding using session cookies.
- Admin SDK handles sensitive operations in API routes.

## FEATURES:
- **Chat**: RTDB-based messaging.
- **E-commerce**: Product catalog, Cart, Wishlist, Orders (Firestore).
- **Notifications**: Firebase Cloud Messaging (FCM).
- **AI Integration**: Google Generative AI (Gemini).
- **Media**: Cloudinary & Firebase Storage ready.

## FIREBASE STATUS: Completed Integration
- Singletons for Client (`lib/firebase-client.ts`) and Admin (`lib/firebase-admin.ts`).
- Security rules defined in `firestore.rules` and `firebase.rules`.
- Environment template provided in `.env.example`.

## NEXT STEPS:
- **UI Migration**: Replace any remaining S3 upload components with Firebase Storage.
- **Testing**: Verify FCM token registration and background notifications.
- **Deployment**: Deploy security rules to Firebase Console.
