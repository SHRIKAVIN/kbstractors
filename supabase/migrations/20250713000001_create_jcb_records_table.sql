-- This migration handles existing JCB records table
-- Add any missing columns if they don't exist
DO $$ 
BEGIN
    -- Add company_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'company_name') THEN
        ALTER TABLE jcb_records ADD COLUMN company_name TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Add driver_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'driver_name') THEN
        ALTER TABLE jcb_records ADD COLUMN driver_name TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Add mobile_number if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'mobile_number') THEN
        ALTER TABLE jcb_records ADD COLUMN mobile_number TEXT;
    END IF;
    
    -- Add work_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'work_date') THEN
        ALTER TABLE jcb_records ADD COLUMN work_date DATE;
    END IF;
    
    -- Add details if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'details') THEN
        ALTER TABLE jcb_records ADD COLUMN details JSONB NOT NULL DEFAULT '[]';
    END IF;
    
    -- Add total_amount if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'total_amount') THEN
        ALTER TABLE jcb_records ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
    END IF;
    
    -- Add amount_received if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'amount_received') THEN
        ALTER TABLE jcb_records ADD COLUMN amount_received DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add advance_amount if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'advance_amount') THEN
        ALTER TABLE jcb_records ADD COLUMN advance_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add old_balance if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'old_balance') THEN
        ALTER TABLE jcb_records ADD COLUMN old_balance TEXT;
    END IF;
    
    -- Add old_balance_reason if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'old_balance_reason') THEN
        ALTER TABLE jcb_records ADD COLUMN old_balance_reason TEXT;
    END IF;
    
    -- Add old_balance_status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'old_balance_status') THEN
        ALTER TABLE jcb_records ADD COLUMN old_balance_status TEXT CHECK (old_balance_status IN ('paid', 'pending'));
    END IF;
    
    -- Add created_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'created_at') THEN
        ALTER TABLE jcb_records ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jcb_records' AND column_name = 'updated_at') THEN
        ALTER TABLE jcb_records ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_jcb_records_created_at ON jcb_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jcb_records_driver_name ON jcb_records(driver_name);
CREATE INDEX IF NOT EXISTS idx_jcb_records_mobile_number ON jcb_records(mobile_number);
CREATE INDEX IF NOT EXISTS idx_jcb_records_equipment_type ON jcb_records USING BTREE ((details->>'equipment_type'));
CREATE INDEX IF NOT EXISTS idx_jcb_records_work_date ON jcb_records(work_date);

-- Enable Row Level Security (RLS)
ALTER TABLE jcb_records ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to access all records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'jcb_records' 
        AND policyname = 'Allow authenticated users to access JCB records'
    ) THEN
        CREATE POLICY "Allow authenticated users to access JCB records" ON jcb_records
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_jcb_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_jcb_records_updated_at ON jcb_records;
CREATE TRIGGER trigger_update_jcb_records_updated_at
    BEFORE UPDATE ON jcb_records
    FOR EACH ROW
    EXECUTE FUNCTION update_jcb_records_updated_at();
