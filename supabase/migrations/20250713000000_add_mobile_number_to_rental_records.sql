-- Add mobile number field to rental records
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_records' AND column_name = 'mobile_number') THEN
        ALTER TABLE rental_records ADD COLUMN mobile_number text;
        
        -- Add constraint to ensure mobile number is exactly 10 digits when provided
        ALTER TABLE rental_records ADD CONSTRAINT check_mobile_number_length 
          CHECK (mobile_number IS NULL OR (mobile_number ~ '^[0-9]{10}$'));
    END IF;
END $$;

-- Mobile number is optional (not required)
-- ALTER TABLE rental_records ALTER COLUMN mobile_number SET NOT NULL;
