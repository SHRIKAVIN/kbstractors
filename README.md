# 🚜 KBS Tractors - Professional Rental Management System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Now-green?style=for-the-badge&logo=vercel)](https://kbstractors.vercel.app/)
[![React](https://img.shields.io/badge/React-18.0.0-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-4.0-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-2.0-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

> **A comprehensive tractor rental and sales management system built with modern web technologies**

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Live Demo](#-live-demo)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Installation](#-installation)
- [🔧 Configuration](#-configuration)
- [📱 Usage](#-usage)
- [🏗️ Project Structure](#️-project-structure)
- [🎨 UI/UX Features](#-uiux-features)
- [🔒 Security Features](#-security-features)
- [📊 Database Schema](#-database-schema)
- [🧪 Testing](#-testing)
- [🚀 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

### 🎯 **Core Functionality**
- **📝 Rental Record Management** - Create, edit, and delete rental records
- **💰 Financial Tracking** - Monitor payments, pending amounts, and total revenue
- **🔍 Advanced Filtering** - Filter by equipment type, status, date range, and customer name
- **📊 Real-time Statistics** - Live dashboard with key business metrics
- **📤 Export Capabilities** - Export data to Excel and PDF formats

### 🛠️ **Equipment Management**
- **🚜 Multiple Equipment Types** - Cage Wheel, Rotavator, Dipper, புழுதி, Mini
- **📏 Flexible Measurements** - Support for acres, rounds, and nadai (steps)
- **💡 Automatic Calculations** - Real-time cost calculations based on equipment rates
- **🔄 Dynamic Pricing** - Configurable rates for different equipment types

### 👥 **Customer Management**
- **👤 Customer Profiles** - Store and manage customer information
- **💰 Balance Tracking** - Track old balances and payment history
- **📋 Payment Status** - Monitor paid vs pending amounts
- **🔍 Search & Filter** - Quick customer lookup and filtering

### 🎨 **User Experience**
- **📱 Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **🌐 Bilingual Support** - Tamil and English interface
- **⚡ Fast Performance** - Optimized with Vite and modern React patterns
- **🎯 Intuitive Interface** - Clean, professional design with excellent UX

## 🚀 Live Demo

**Experience the full application live:**

[![Live Demo Button](https://img.shields.io/badge/🚀%20Live%20Demo%20-%20Try%20Now%20→-brightgreen?style=for-the-badge&logo=vercel)](https://kbstractors.vercel.app/)

> **Demo Credentials:**
> - **Username:** `Bhaskaran`
> - **Password:** Contact administrator for access

## 🛠️ Tech Stack

### **Frontend**
- **⚛️ React 18** - Modern React with hooks and functional components
- **📘 TypeScript** - Type-safe development with enhanced IDE support
- **🎨 Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **⚡ Vite** - Lightning-fast build tool and development server
- **📱 Responsive Design** - Mobile-first approach with Tailwind CSS

### **Backend & Database**
- **🔥 Supabase** - Open-source Firebase alternative with PostgreSQL
- **🗄️ PostgreSQL** - Robust, scalable database
- **🔐 Row Level Security** - Advanced security policies
- **🔄 Real-time Subscriptions** - Live data updates

### **Development Tools**
- **🔧 ESLint** - Code linting and formatting
- **📦 npm** - Package management
- **🌐 React Router** - Client-side routing
- **📄 React Helmet** - Document head management for SEO

## 📦 Installation

### **Prerequisites**
- Node.js (v16 or higher)
- npm or yarn
- Supabase account

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

Create a `.env.local` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🔧 Configuration

### **Supabase Setup**

1. **Create a new Supabase project**
2. **Set up the database schema** 
3. **Configure Row Level Security policies**
4. **Add environment variables to your project**

### **Database Migration**

```sql
-- Run the migration files in supabase/migrations/
-- This will set up all necessary tables and policies
```

## 📱 Usage

### **Authentication**
- Secure login system with username/password
- Session management with Supabase Auth
- Automatic logout on session expiry

### **Dashboard Overview**
- **📊 Statistics Cards** - View total records, amounts, and pending balances
- **🔍 Quick Filters** - Filter data by various criteria
- **📤 Export Options** - Download data in Excel or PDF format
- **🔄 Refresh Data** - Real-time data updates

### **Adding Rental Records**
1. Click **"புதிய பதிவு"** (New Record) button
2. Fill in customer details
3. Add equipment details (acres, rounds, equipment type)
4. Set received amount
5. Save the record

### **Managing Records**
- **✏️ Edit** - Modify existing records
- **🗑️ Delete** - Remove records (with confirmation)
- **🔍 Filter** - Use advanced filtering options
- **📊 Export** - Download filtered data

## 🏗️ Project Structure

```
kbstractors/
├── 📁 src/
│   ├── 📁 components/          # React components
│   │   ├── Dashboard.tsx      # Main dashboard
│   │   ├── DataTable.tsx      # Data display table
│   │   ├── LoginForm.tsx      # Authentication form
│   │   ├── RentalForm.tsx     # Rental record form
│   │   └── SEO.tsx           # SEO management
│   ├── 📁 hooks/              # Custom React hooks
│   │   └── useAuth.tsx       # Authentication hook
│   ├── 📁 lib/                # Utility libraries
│   │   ├── supabase.ts       # Supabase client
│   │   └── localStorage.ts   # Local storage utilities
│   ├── 📁 types/              # TypeScript type definitions
│   │   └── rental.ts         # Rental record types
│   ├── 📁 utils/              # Utility functions
│   │   ├── analytics.ts      # Analytics utilities
│   │   ├── calculations.ts   # Business logic calculations
│   │   └── export.ts         # Export functionality
│   └── 📁 assets/             # Static assets
├── 📁 supabase/               # Database migrations
├── 📁 public/                 # Public assets
└── 📄 Configuration files
```

## 🎨 UI/UX Features

### **Design Principles**
- **🎯 User-Centered Design** - Intuitive interface for business users
- **📱 Mobile-First Approach** - Responsive design for all devices
- **♿ Accessibility** - WCAG compliant with proper ARIA labels
- **🎨 Consistent Design System** - Unified color scheme and typography

### **Visual Elements**
- **🎨 Professional Color Scheme** - Blue and gray theme
- **📊 Data Visualization** - Clear statistics and progress indicators
- **🔍 Interactive Elements** - Hover effects and smooth transitions
- **📱 Touch-Friendly** - Optimized for mobile interaction

## 🔒 Security Features

### **Authentication & Authorization**
- **🔐 Secure Login** - Username/password authentication
- **🛡️ Row Level Security** - Database-level access control
- **⏰ Session Management** - Automatic session expiry
- **🚪 Secure Logout** - Proper session cleanup

### **Data Protection**
- **🔒 Encrypted Connections** - HTTPS/TLS encryption
- **🛡️ Input Validation** - Client and server-side validation
- **🚫 XSS Protection** - Sanitized user inputs
- **📊 Audit Trail** - Track data modifications

## 📊 Database Schema

### **Core Tables**

```sql
-- Rental Records
rental_records (
  id: uuid PRIMARY KEY,
  name: text NOT NULL,
  details: jsonb,
  total_amount: numeric,
  received_amount: numeric,
  old_balance: text,
  old_balance_status: text,
  old_balance_reason: text,
  created_at: timestamp,
  updated_at: timestamp
)
```

### **Equipment Types**
- **Cage Wheel** - ₹400/சால்
- **Rotavator** - ₹500/சால்
- **Dipper** - ₹500/நடை
- **புழுதி** - ₹400/சால்
- **Mini** - ₹450/சால்

## 🧪 Testing

### **Test Coverage**
- **🧪 Unit Tests** - Component and utility function testing
- **🔍 Integration Tests** - API and database integration
- **🌐 E2E Tests** - Full user workflow testing
- **📱 Cross-Browser Testing** - Chrome, Firefox, Safari, Edge

### **Test IDs**
All components include comprehensive `data-testid` attributes for reliable testing:

```jsx
// Example test selectors
<button data-testid="add-record-button">Add Record</button>
<input data-testid="customer-name-input" />
<div data-testid="total-amount-value">₹5,000</div>
```

## 🚀 Deployment

### **Vercel Deployment**
1. **Connect Repository** - Link your GitHub repository to Vercel
2. **Configure Environment** - Add Supabase environment variables
3. **Deploy** - Automatic deployment on push to main branch

### **Environment Setup**
```bash
# Production environment variables
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_supabase_anon_key
```

### **Performance Optimization**
- **⚡ Code Splitting** - Lazy loading for better performance
- **📦 Bundle Optimization** - Minimized and compressed assets
- **🌐 CDN Delivery** - Global content delivery network
- **📱 PWA Ready** - Progressive web app capabilities

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### **Development Workflow**
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Code Standards**
- **📝 TypeScript** - Use TypeScript for all new code
- **🎨 Prettier** - Follow consistent code formatting
- **🔍 ESLint** - Maintain code quality standards
- **📚 Documentation** - Update README and code comments

### **Testing Requirements**
- **✅ Unit Tests** - Add tests for new functionality
- **✅ Integration Tests** - Test component interactions
- **✅ E2E Tests** - Verify user workflows

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **React Team** - For the amazing React framework
- **Supabase Team** - For the excellent backend-as-a-service platform
- **Tailwind CSS** - For the utility-first CSS framework
- **Vercel** - For seamless deployment and hosting

## 📞 Support

- **🌐 Website:** [https://kbstractors.vercel.app/](https://kbstractors.vercel.app/)
- **📧 Email:**  shrikavinkbs@gmail.com


---

<div align="center">

**Made with ❤️ for the agricultural community**


</div>
