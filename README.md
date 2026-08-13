# 🚜 KBS Tractors - Professional Rental Management System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Now-green?style=for-the-badge&logo=vercel)](https://kbstractors.vercel.app/)
[![React](https://img.shields.io/badge/React-18.3-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-2.0-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

> **A bilingual (Tamil/English) tractor & JCB rental management system with financial tracking, exports, and automated Supabase keep-alive**

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Live Demo](#-live-demo)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Installation](#-installation)
- [🔧 Configuration](#-configuration)
- [💓 Supabase Keep-Alive](#-supabase-keep-alive)
- [🔔 Push Notifications](#-push-notifications)
- [📱 Usage](#-usage)
- [🏗️ Project Structure](#️-project-structure)
- [📊 Database Schema](#-database-schema)
- [🚀 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

### 🚜 **Tractor Rental Management**
- Create, edit, and delete rental records
- Equipment types: Cage Wheel, Rotavator, Dipper, புழுதி, Mini
- Flexible measurements (acres, rounds, nadai)
- Mobile number capture with one-tap call links
- Person detail popup (flashcard) for quick customer overview
- Financial tracking for payments, pending amounts, and old balances
- Filter by equipment, status, date range, and customer name
- Export to Excel and PDF

### 🚧 **JCB Operations**
- Separate JCB dashboard (switch via top-right button)
- Company name, driver name, hours, and work date
- Hourly billing (₹1000/hour)
- Optional amount received and advance amount
- Mobile number and balance tracking
- Export and filtering support

### 🎨 **User Experience**
- Responsive design for desktop, tablet, and mobile
- Bilingual Tamil / English interface
- Real-time dashboard statistics
- Secure login with Supabase Auth

## 🚀 Live Demo

[![Live Demo Button](https://img.shields.io/badge/🚀%20Live%20Demo%20-%20Try%20Now%20→-brightgreen?style=for-the-badge&logo=vercel)](https://kbstractors.vercel.app/)

> **Demo Credentials:**
> - **Username:** `Bhaskaran`
> - **Password:** Contact administrator for access

## 🛠️ Tech Stack

### **Frontend**
- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- Lucide React icons
- jspdf / pdfmake / xlsx for exports
- React Helmet Async for SEO

### **Backend & Database**
- Supabase (PostgreSQL + Auth + RLS)
- Vercel serverless API (`/api/keep-alive`)

### **Automation**
- Vercel Cron daily keep-alive + Teams cards
- GitHub Actions keep-alive workflow (cron commented out; manual `workflow_dispatch` only)
- Optional Microsoft Teams webhook notifications

## 📦 Installation

### **Prerequisites**
- Node.js (v18 or higher recommended)
- npm
- Supabase account
- Vercel account (for production + keep-alive API)

### **Quick Start**

```bash
# Clone the repository
git clone https://github.com/SHRIKAVIN/kbstractors.git
cd kbstractors

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### **Environment Variables**

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For the keep-alive API on Vercel (server-side), also set:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # preferred (bypasses RLS)
# or SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY as fallback
# KEEP_ALIVE_TABLE=rental_records                  # optional, default shown
TEAMS_WEBHOOK_URL=your_teams_incoming_webhook_url  # Vercel Cron Teams cards
```

For Push Notifications on Vercel (server-side), see [🔔 Push Notifications](#-push-notifications) below.

## 🔧 Configuration

### **Supabase Setup**

1. Create a new Supabase project
2. Run the SQL migrations in `supabase/migrations/` (in order)
3. Configure Row Level Security policies
4. Add environment variables locally and on Vercel

### **Database Migrations**

```bash
# Apply migrations from supabase/migrations/ in chronological order:
# - turquoise_butterfly.sql          (base rental_records)
# - add_optional_fields...           (old balance fields)
# - add_mobile_number...             (mobile_number on rentals)
# - create_jcb_records_table.sql     (JCB system)
# - fix_jcb_records_name_nullable.sql
```

## 💓 Supabase Keep-Alive

Supabase free-tier projects pause after inactivity. This repo keeps the DB warm via:

1. **`/api/keep-alive`** — lightweight `SELECT` against Supabase
2. **Vercel Cron** — once daily at 03:00 UTC (`0 3 * * *`) + Teams success/failure cards
3. **GitHub Actions** — schedule commented out for now; manual `workflow_dispatch` still available

Hobby Vercel allows at most one cron per day. Vercel Cron Teams cards only fire on real cron requests.

### **Vercel env**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Keep-alive queries (bypasses RLS) |
| `TEAMS_WEBHOOK_URL` | Teams alerts from Vercel Cron |

### **GitHub Secrets**

| Secret | Required | Description |
|--------|----------|-------------|
| `VERCEL_DEPLOYMENT_URL` | Optional | App URL (defaults to `https://kbstractors.vercel.app/`) |
| `TEAMS_WEBHOOK_URL` | Optional | Microsoft Teams incoming webhook for success/failure cards |

### **Manual test**

```bash
curl -sL https://kbstractors.vercel.app/api/keep-alive
```

Expect `"success": true` and `"teams": { "sent": false, "reason": "Not a Vercel Cron request..." }` (manual pings skip Teams).

## 🔔 Push Notifications

Separate from the Teams keep-alive cards above. Web Push (VAPID) notifications fire on this device
whenever a rental/JCB record is created, updated, or deleted, and once a day for a digest of every
payment still pending 10+ days after its entry date. Tap the bell icon in the tractor or JCB header
to subscribe this device (grants OS notification permission).

### **Setup**

1. Run `supabase/migrations/20260813000000_create_push_notification_tables.sql` (adds
   `push_subscriptions` and `notification_sent`).
2. Generate a VAPID key pair: `npx web-push generate-vapid-keys`.
3. Add to `.env.local` (client) and Vercel project settings (server):

```env
# .env.local
VITE_VAPID_PUBLIC_KEY=BF...           # the "Public Key" from step 2

# Vercel → Settings → Environment Variables
VAPID_PUBLIC_KEY=BF...                # same public key
VAPID_PRIVATE_KEY=...                 # the "Private Key" from step 2 — keep secret
VAPID_SUBJECT=mailto:you@example.com
SUPABASE_SERVICE_ROLE_KEY=...         # already set for keep-alive; reused here
CRON_SECRET=...                       # optional — protects /api/pending-reminders
```

4. Redeploy. Log in, tap the bell — a row should appear in Supabase's `push_subscriptions` table.

### **How it works**

- `src/sw.ts` — service worker (built via `vite-plugin-pwa`) that shows the notification and focuses
  the app on click. Only active in production builds/`vite preview` (disabled in `vite dev`).
- `/api/send-push` — called by the client right after every rental/JCB create, update, or delete
  (`src/lib/pushNotify.ts` → `rentalService`/`jcbService`); broadcasts to every subscribed device.
- `/api/pending-reminders` — Vercel Cron, daily, digests every unpaid record older than 10 days
  (payer name + amount + days overdue), deduped so it sends at most once per day.

### **Vercel Cron**

```json
{ "path": "/api/pending-reminders", "schedule": "0 4 * * *" }
```

Added alongside the existing keep-alive cron in `vercel.json` — Hobby plans allow up to 100 cron jobs
per project as long as each runs at most once a day, so this doesn't affect the keep-alive schedule.

## 📱 Usage

### **Authentication**
- Username/password login via Supabase Auth
- Session management with automatic expiry handling

### **Tractor Dashboard**
1. Click **புதிய பதிவு** (New Record)
2. Enter customer name and optional mobile number
3. Add equipment lines (acres, rounds, type)
4. Set received amount / old balance as needed
5. Save — use filters and export from the dashboard

### **JCB Dashboard**
1. Click the **JCB** button (top right of tractor dashboard)
2. Enter company name, driver name, hours, and work date
3. Optionally set amount received and advance
4. Switch back with the **Tractor** button

### **Record Details**
- Click the person icon on a rental row to open the detail flashcard popup
- Tap a mobile number to dial (`tel:`)

## 🏗️ Project Structure

```
kbstractors/
├── api/
│   └── keep-alive.ts           # Vercel serverless keep-alive endpoint
├── .github/workflows/
│   └── keep-alive.yml          # Keep-alive + Teams (cron disabled; manual only)
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx       # Tractor dashboard + view switch
│   │   ├── DataTable.tsx       # Rental table + person flashcard trigger
│   │   ├── RentalForm.tsx      # Tractor rental form
│   │   ├── JCBDashboard.tsx    # JCB operations dashboard
│   │   ├── JCBDataTable.tsx    # JCB records table
│   │   ├── JCBForm.tsx         # JCB entry form
│   │   ├── RecordDetailsPopup.tsx
│   │   ├── LoginForm.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── SEO.tsx
│   ├── hooks/
│   │   └── useAuth.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Tractor Supabase client/services
│   │   ├── jcb-supabase.ts     # JCB Supabase services
│   │   └── localStorage.ts
│   ├── types/
│   │   ├── rental.ts
│   │   └── jcb.ts
│   └── utils/
│       ├── calculations.ts
│       ├── jcb-calculations.ts
│       ├── export.ts
│       └── analytics.ts
├── supabase/migrations/        # SQL migrations
├── public/                     # Static assets, icons, SEO files
└── vercel.json                 # SPA rewrites + daily Cron (/api/keep-alive)
```

## 📊 Database Schema

### **rental_records**
```sql
rental_records (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  mobile_number text,
  details jsonb,              -- acres, equipment_type, rounds, nadai
  total_amount numeric,
  received_amount numeric,
  old_balance text,
  old_balance_status text,    -- 'paid' | 'pending'
  old_balance_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
```

### **jcb_records**
```sql
jcb_records (
  id uuid PRIMARY KEY,
  company_name text NOT NULL,
  driver_name text NOT NULL,
  mobile_number text,
  work_date date,
  details jsonb,              -- hours, equipment_type ('JCB')
  total_amount numeric NOT NULL,
  amount_received numeric DEFAULT 0,
  advance_amount numeric DEFAULT 0,
  old_balance text,
  old_balance_reason text,
  old_balance_status text,    -- 'paid' | 'pending'
  created_at timestamptz,
  updated_at timestamptz
)
```

### **Equipment Types**
- Tractor: Cage Wheel, Rotavator, Dipper, புழுதி, Mini
- JCB: JCB (hourly)

## 🚀 Deployment

### **Vercel**
1. Connect the GitHub repository to Vercel
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for keep-alive)
   - `TEAMS_WEBHOOK_URL` (for Vercel Cron Teams cards)
3. Deploy — pushes to `main` deploy automatically
4. Confirm Cron Jobs: path `/api/keep-alive`, schedule `0 3 * * *`
5. Confirm keep-alive: `https://your-app.vercel.app/api/keep-alive`

### **GitHub Actions**
1. (Optional) Add `VERCEL_DEPLOYMENT_URL` secret
2. (Optional) Add `TEAMS_WEBHOOK_URL` for Teams alerts
3. Cron schedule is commented out; run manually via **Actions → Keep Supabase Database Active → Run workflow**

### **Performance**
- Vite production build with code splitting
- CDN delivery via Vercel
- SPA rewrites configured in `vercel.json` (API routes excluded)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push and open a Pull Request

### **Code Standards**
- TypeScript for all new code
- Follow existing ESLint / Prettier conventions
- Prefer bilingual UI labels where users see text
- Update README when adding features or workflows

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- React, Supabase, Tailwind CSS, and Vercel teams

## 📞 Support

- **Website:** [https://kbstractors.vercel.app/](https://kbstractors.vercel.app/)
- **Email:** shrikavinkbs@gmail.com

---

<div align="center">

**Made with ❤️ for the agricultural community**

</div>
