-- Add optional fields for a second set of rental details
ALTER TABLE rental_records ADD COLUMN acres2 numeric;
ALTER TABLE rental_records ADD COLUMN equipment_type2 text CHECK (equipment_type2 IN ('Cage Wheel', 'Rotator'));
ALTER TABLE rental_records ADD COLUMN rounds2 numeric;
