# Codebase Analysis Summary

## PROJECT: bolpur-mart
## STACK: Next.js 14.2.16 + TypeScript + Tailwind CSS + Radix UI (shadcn/ui)
## ROUTER: App Router
## CURRENT DB: Firebase (Firestore & Realtime Database)
- Drizzle ORM and Vercel Postgres are present but commented out in `lib/db.ts`.
- RTDB is used for messages in `app/api/messages/[chatId]/route.ts`.
- Firestore is used for products, carts, orders, and services.

## CURRENT AUTH: Firebase Auth (Session Cookies)
- Middleware uses session cookies for auth guarding.
- `app/api/auth/login/route.ts` handles session creation.

## FEATURES:
- **Chat**: RTDB-based messaging.
- **E-commerce**: Product catalog, Cart, Wishlist, Orders (Firestore).
- **Notifications**: Firebase Cloud Messaging (FCM).
- **AI Integration**: Google Generative AI (Gemini).
- **Media**: Cloudinary for images/receipts.

## FIREBASE STATUS: Partial / Pre-integrated
- Many services exist in `lib/` but there's a need for a unified `useAuth` hook and more robust client/admin singletons.
- Security rules need to be explicitly defined.

## MIGRATION PLAN:
- **Prisma/Drizzle → Firestore/RTDB**: Already mostly done, but needs cleanup.
- **Admin SDK**: Ensure no double-init errors (singleton pattern).
- **Middleware**: Enhance with user role checking if needed.
- **Rules**: Generate `firebase.rules` and `firestore.rules`.
- **FCM**: Finalize service worker and token acquisition.
