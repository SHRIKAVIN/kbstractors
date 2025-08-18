-- Add optional fields for a second set of rental details
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_records' AND column_name = 'acres2') THEN
        ALTER TABLE rental_records ADD COLUMN acres2 numeric;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_records' AND column_name = 'equipment_type2') THEN
        ALTER TABLE rental_records ADD COLUMN equipment_type2 text CHECK (equipment_type2 IN ('Cage Wheel', 'Rotator'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_records' AND column_name = 'rounds2') THEN
        ALTER TABLE rental_records ADD COLUMN rounds2 numeric;
    END IF;
END $$;
