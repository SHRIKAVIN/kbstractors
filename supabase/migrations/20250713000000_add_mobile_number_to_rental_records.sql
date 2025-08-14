-- Add mobile number field to rental records
ALTER TABLE rental_records ADD COLUMN mobile_number text;

-- Add constraint to ensure mobile number is exactly 10 digits
ALTER TABLE rental_records ADD CONSTRAINT check_mobile_number_length 
  CHECK (mobile_number IS NULL OR (mobile_number ~ '^[0-9]{10}$'));

-- Make mobile number required for new records
ALTER TABLE rental_records ALTER COLUMN mobile_number SET NOT NULL;
