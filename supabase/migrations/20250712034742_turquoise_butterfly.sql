/*
  # Create rental records table

  1. New Tables
    - `rental_records`
      - `id` (uuid, primary key)
      - `name` (text, customer name)
      - `acres` (numeric, land area)
      - `equipment_type` (text, type of equipment)
      - `rounds` (numeric, number of rounds)
      - `total_amount` (numeric, total calculated amount)
      - `received_amount` (numeric, amount received)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `rental_records` table
    - Add policy for authenticated users to manage records
*/

CREATE TABLE IF NOT EXISTS rental_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  acres numeric NOT NULL CHECK (acres > 0),
  equipment_type text NOT NULL CHECK (equipment_type IN ('Cage Wheel', 'Rotator')),
  rounds numeric NOT NULL CHECK (rounds > 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  received_amount numeric NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rental_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users"
  ON rental_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);