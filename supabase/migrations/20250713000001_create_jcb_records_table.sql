-- Create JCB records table
CREATE TABLE IF NOT EXISTS jcb_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    mobile_number TEXT,
    work_date DATE,
    details JSONB NOT NULL DEFAULT '[]',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_received DECIMAL(10,2) DEFAULT 0,
    advance_amount DECIMAL(10,2) DEFAULT 0,
    old_balance TEXT,
    old_balance_reason TEXT,
    old_balance_status TEXT CHECK (old_balance_status IN ('paid', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for better performance
CREATE INDEX IF NOT EXISTS idx_jcb_records_created_at ON jcb_records(created_at DESC);

-- Create index on name for search functionality
CREATE INDEX IF NOT EXISTS idx_jcb_records_name ON jcb_records(name);

-- Create index on mobile_number for search functionality
CREATE INDEX IF NOT EXISTS idx_jcb_records_mobile_number ON jcb_records(mobile_number);

-- Create index on equipment_type from details JSONB
CREATE INDEX IF NOT EXISTS idx_jcb_records_equipment_type ON jcb_records USING BTREE ((details->>'equipment_type'));

-- Create index on work_date for date filtering
CREATE INDEX IF NOT EXISTS idx_jcb_records_work_date ON jcb_records(work_date);

-- Enable Row Level Security (RLS)
ALTER TABLE jcb_records ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to access all records
CREATE POLICY "Allow authenticated users to access JCB records" ON jcb_records
    FOR ALL USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_jcb_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_jcb_records_updated_at
    BEFORE UPDATE ON jcb_records
    FOR EACH ROW
    EXECUTE FUNCTION update_jcb_records_updated_at();
