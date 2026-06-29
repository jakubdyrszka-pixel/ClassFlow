<div align="center">
  <img src="./public/assets/pilates.png" alt="ClassFlow Hero" width="800" style="border-radius: 12px; margin-bottom: 20px;" />
  
  # ClassFlow

  **Comprehensive Studio Management for Fitness and Yoga.**
  
  [![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Stripe](https://img.shields.io/badge/Stripe-Payments-indigo?style=for-the-badge&logo=stripe)](https://stripe.com/)

</div>

---

ClassFlow is a software-as-a-service (SaaS) platform designed for fitness studios, yoga schools, and sports clubs. It provides scheduling, booking, and management tools to streamline operations for administrators, instructors, receptionists, and attendees.

---

## 💎 Features

* **Role-Based Access Control:** Distinct interfaces and permissions for Users, Instructors, Receptionists, and Administrators.
* **Booking & Scheduling:** Real-time class reservations, waitlist management, and recurring schedule rules (RRule).
* **Access Management:** Instant QR code-based check-ins for efficient front-desk operations.
* **Analytics:** Data visualization for class popularity, attendance, and revenue.
* **Payment Processing:** Integrated billing and subscription management via Stripe.

---

## 🚀 Architecture

This project is built using a modern, scalable TypeScript stack:

* **Framework:** Next.js 16 (React 19)
* **Styling:** Tailwind CSS v4, Shadcn UI
* **Database:** PostgreSQL with Prisma ORM
* **Authentication:** Clerk
* **Real-time Synchronization:** Pusher
* **Caching & Rate Limiting:** Upstash Redis
* **Storage:** Vercel Blob
* **Payments:** Stripe
* **Email:** Resend

---

## 🛠️ Local Development

### Prerequisites

* Node.js (v18 or higher recommended)
* PostgreSQL database
* API keys for Clerk, Stripe, Pusher, Upstash Redis, and Resend

### Setup Instructions

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and populate it with your specific service keys.

3. **Initialize the Database:**
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
