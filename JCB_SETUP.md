# KBS JCB System Setup

This document describes the new JCB system that has been added to the KBS Tractors application.

## Overview

The JCB system is a replica of the tractor system, specifically designed for JCB operations with the following key differences:

1. **Required Fields**: Company Name, Driver Name, Hours Driven, Total Amount
2. **Optional Fields**: Amount Received, Advance Amount (not mandatory)
3. **Equipment Type**: Only JCB (₹1000 per hour)
4. **Professional Navigation**: Small JCB/Tractor buttons in top right corner for easy switching

## New Components

### 1. JCB Types (`src/types/jcb.ts`)
- `JCBDetail`: Interface for JCB work details (hours, equipment type - JCB only)
- `JCBRecord`: Main interface for JCB records with company and driver info
- `JCBUser`: User interface for JCB system

### 2. JCB Calculations (`src/utils/jcb-calculations.ts`)
- Equipment rate: JCB (₹1000 per hour)
- Currency formatting functions

### 3. JCB Supabase Service (`src/lib/jcb-supabase.ts`)
- CRUD operations for JCB records
- Database service layer for JCB operations

### 4. JCB Form (`src/components/JCBForm.tsx`)
- Entry form for JCB records with required fields
- Company name and driver name fields (required)
- Equipment type: JCB only
- Hours input for billing (₹1000 per hour)
- Amount received and advance amount (optional)

### 5. JCB Data Table (`src/components/JCBDataTable.tsx`)
- Display JCB records in a table format
- Status indicators and action buttons

### 6. JCB Dashboard (`src/components/JCBDashboard.tsx`)
- Complete dashboard for JCB operations
- Statistics cards and filtering
- Small Tractor button in top right for navigation

## Database Schema

### JCB Records Table (`jcb_records`)
```sql
CREATE TABLE jcb_records (
    id UUID PRIMARY KEY,
    company_name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    mobile_number TEXT,
    work_date DATE,
    details JSONB NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_received DECIMAL(10,2) DEFAULT 0,
    advance_amount DECIMAL(10,2) DEFAULT 0,
    old_balance TEXT,
    old_balance_reason TEXT,
    old_balance_status TEXT CHECK (old_balance_status IN ('paid', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Key Features

### 1. Navigation Between Systems
- **Tractor Dashboard**: Blue theme with small JCB button in top right
- **JCB Dashboard**: Orange theme with small Tractor button in top right
- **Small Size**: Compact buttons that don't interfere with main content

### 2. JCB Form Features
- Company name (required)
- Driver name (required)
- Mobile number (optional)
- Work date selection
- Equipment type: JCB only
- Hours input for billing (₹1000 per hour)
- Amount received (optional)
- Advance amount (optional)
- Old balance handling

### 3. Billing System
- Fixed hourly rate: ₹1000 per hour for JCB
- Automatic calculation of total amount
- Optional amount received and advance amount tracking
- Old balance management

### 4. Filtering and Search
- Equipment type filtering (JCB only)
- Status filtering (paid/pending)
- Company search
- Date range filtering
- Old balance status filtering

## Usage

### Switching Between Systems
1. **From Tractor to JCB**: Click the small JCB button (Construction icon) in the top right corner
2. **From JCB to Tractor**: Click the small Tractor button (Truck icon) in the top right corner

### Creating JCB Records
1. Navigate to JCB Dashboard
2. Click "புதிய JCB பதிவு" (New JCB Record)
3. Fill in required fields: company name, driver name
4. Add equipment details (JCB, hours)
5. Enter amount received and advance amount (optional)
6. Save the record

### Managing JCB Records
- View all JCB records in the data table
- Edit existing records
- Delete records
- Filter and search records by company
- Export data (when export functionality is added)

## Migration

To set up the JCB system in your Supabase database:

1. Run the migration file: `supabase/migrations/20250713000001_create_jcb_records_table.sql`
2. The table will be created with proper indexes and RLS policies
3. The system will be ready to use immediately

## Styling

- **Tractor System**: Blue theme (`bg-blue-600`, `border-blue-200`)
- **JCB System**: Orange theme (`bg-orange-600`, `border-orange-200`)
- **Navigation Buttons**: Small, compact buttons in top right corner
- Consistent 3D effects and modern UI design
- Responsive design for mobile and desktop

## Future Enhancements

- Export functionality for JCB records
- Advanced reporting and analytics
- Integration with tractor system for combined operations
- Mobile app support
- Multi-language support expansion

## Notes

- The JCB system maintains the same professional look and feel as the tractor system
- All Tamil language labels are preserved for consistency
- Navigation buttons are small and positioned in the top right for easy access
- The system uses a simplified structure with only JCB equipment type
- Company name and driver name are required fields for better record keeping
- Amount fields are optional, making the form more flexible for different business scenarios
