<div align="center">
  <img src="./public/assets/pilates.png" alt="ClassFlow Hero" width="800" style="border-radius: 12px; margin-bottom: 20px;" />
  
  # 🌟 ClassFlow 

  **Zdefiniuj na nowo zarządzanie studiem fitness i jogi.**
  
  [![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Stripe](https://img.shields.io/badge/Stripe-Payments-indigo?style=for-the-badge&logo=stripe)](https://stripe.com/)

</div>

---

Witaj w **ClassFlow** – przestrzeni, gdzie pot spotyka się z perfekcją, a codzienność zamienia się w pasję. Nie jesteśmy kolejną powolną aplikacją do rezerwacji. Jesteśmy bezkompromisowym, nowoczesnym systemem SaaS stworzonym, by eliminować tarcie operacyjne i dostarczać **Doświadczenie Premium** zarówno dla klientów, jak i administracji.

> *"ClassFlow to majstersztyk technologiczny. Środowisko, które zdejmuje z Ciebie ciężar organizacji, pozwalając skupić się w 100% na treningu i biznesie."*

---

## 🚀 Architektura i Technologia

ClassFlow to projekt zbudowany bez kompromisów, wykorzystujący najnowocześniejszy dostępny stack technologiczny, aby zapewnić absolutną niezawodność, wydajność i natychmiastową responsywność.

* ⚡ **Frontend i SSR:** Najnowszy **Next.js 16.2** z **React 19**, zapewniający błyskawiczny Server-Side Rendering i zoptymalizowane Web Vitals.
* 🎨 **Styling:** **Tailwind CSS v4** w połączeniu z komponentami **Shadcn UI** i **Base UI** dla zniewalającego, płynnego i wysoce kontrastowego interfejsu (WCAG AA).
* 🗄️ **Baza Danych i ORM:** **PostgreSQL** zarządzany przez **Prisma 7.8**, gwarantujący pełne bezpieczeństwo typów (Type-Safety) i absolutny brak *race-conditions* przy rezerwacjach.
* 🔐 **Autoryzacja i Bezpieczeństwo:** Niezawodny **Clerk** do zarządzania tożsamościami i RBAC (Role-Based Access Control) dla 4 ról (Użytkownik, Instruktor, Recepcja, Admin).
* 📡 **Real-time i Zdarzenia:** Zastosowanie **Pusher** do synchronizacji stanów na żywo oraz Webhooków obsługiwanych przez **Svix**.
* 💳 **Płatności:** Pełna, bezpieczna integracja z systemem **Stripe**.
* 🚀 **Edge & Cache:** **Upstash Redis** do błyskawicznego cachowania i ratelimitingu, oraz **Vercel Blob** do przechowywania mediów.
* ✉️ **Komunikacja:** Integracja z **Resend** dla pewnej i szybkiej dostarczalności maili transakcyjnych.

---

## 💎 Kluczowe Funkcjonalności

ClassFlow to kompletny ekosystem stworzony z myślą o 4 głównych aktorach:

### 👤 Dla Użytkowników (Klubowiczów)
* **Rezerwacje Bez Tarcia:** Zapisz się na zajęcia w 3 sekundy.
* **Smart Pass (Kod QR):** Bezobsługowe wejścia. Twój telefon to Twój klucz do klubu.

### 🏋️ Dla Instruktorów
* **Zarządzanie na bieżąco:** Podgląd list obecności, szybkie anulacje i notatki z sesji w interfejsie perfekcyjnie dostosowanym do urządzeń mobilnych.

### 🛎️ Dla Recepcji
* **Frictionless Velocity:** Błyskawiczny skaner QR (`html5-qrcode`) pozwalający na odprawę klientów w ułamku sekundy, nawet w godzinach szczytu.
* **Instant UI:** Zero przeładowań strony – akcje wykonują się natychmiast.

### 👑 Dla Administratorów (Właścicieli)
* **Głęboka Analityka:** Zaawansowane wizualizacje przychodów i popularności zajęć napędzane przez bibliotekę **Recharts**.
* **Pełna Kontrola:** Potężny kreator harmonogramów obsługujący zaawansowane, powtarzalne reguły (RRule) oraz pełen CRUD dla lokalizacji i kadr.

---

## 🛠️ Uruchomienie Lokalne (Dla Deweloperów)

Chcesz zobaczyć ten technologiczny cud na własnym komputerze? Rozpoczęcie pracy jest banalnie proste:

1. **Sklonuj repozytorium** i zainstaluj pakiety:
   ```bash
   npm install
   ```

2. **Skonfiguruj środowisko:**
   Utwórz plik `.env` na podstawie `.env.example` i uzupełnij klucze API (Postgres, Clerk, Stripe, Pusher, Redis, Resend).

3. **Zbuduj schemat bazy i uruchom seed:**
   ```bash
   npx prisma db push
   npx tsx --env-file=.env prisma/seed.ts
   ```

4. **Wystartuj aplikację:**
   ```bash
   npm run dev
   ```
   Aplikacja będzie dostępna pod `http://localhost:3000`.

---

<div align="center">
  <i>ClassFlow - Technologia w służbie Twojego ciała.</i>
</div>
