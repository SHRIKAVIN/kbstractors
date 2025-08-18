-- Fix legacy `name` column on jcb_records to prevent NOT NULL violations
-- If `name` exists, prefer migrating its data into `driver_name` and then drop it.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns 
		WHERE table_name = 'jcb_records' AND column_name = 'name'
	) THEN
		-- If driver_name does not exist, rename `name` -> `driver_name`
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns 
			WHERE table_name = 'jcb_records' AND column_name = 'driver_name'
		) THEN
			ALTER TABLE jcb_records RENAME COLUMN name TO driver_name;
		ELSE
			-- Backfill data where driver_name is empty/null
			UPDATE jcb_records 
			SET driver_name = COALESCE(NULLIF(driver_name, ''), name)
			WHERE name IS NOT NULL;
			-- Drop legacy column
			ALTER TABLE jcb_records DROP COLUMN name;
		END IF;
	END IF;
END $$;
