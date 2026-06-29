# ClassFlow

ClassFlow is a comprehensive software-as-a-service (SaaS) platform designed for fitness studios, yoga schools, and sports clubs. It provides scheduling, booking, and management tools to streamline operations for administrators, instructors, receptionists, and attendees.

## Features

- **Role-Based Access Control:** Distinct interfaces and permissions for Users, Instructors, Receptionists, and Administrators.
- **Booking & Scheduling:** Real-time class reservations, waitlist management, and recurring schedule rules (RRule).
- **Access Management:** Instant QR code-based check-ins for efficient front-desk operations.
- **Analytics:** Data visualization for class popularity, attendance, and revenue.
- **Payment Processing:** Integrated billing and subscription management via Stripe.

## Architecture

This project is built using a modern TypeScript stack:

- **Framework:** Next.js 16 (React 19)
- **Styling:** Tailwind CSS v4, Shadcn UI
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Clerk
- **Real-time Synchronization:** Pusher
- **Caching & Rate Limiting:** Upstash Redis
- **Storage:** Vercel Blob
- **Payments:** Stripe
- **Email:** Resend

## Local Development

### Prerequisites

- Node.js
- PostgreSQL database
- API keys for Clerk, Stripe, Pusher, Upstash Redis, and Resend.

### Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory and populate it with your specific service keys (refer to the required variables in your application).

3. **Database Initialization:**
   Synchronize the database schema and populate it with initial seed data:
   ```bash
   npx prisma db push
   npx tsx --env-file=.env prisma/seed.ts
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.
