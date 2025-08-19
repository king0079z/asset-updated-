-- Update existing tickets that don't have a displayId
-- This will generate a displayId for each ticket in the format TKT-YYYYMMDD-XXXX

-- First, create a function to generate the display ID
CREATE OR REPLACE FUNCTION generate_ticket_display_id(created_date TIMESTAMP) 
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    count_for_day INTEGER;
    sequential_number TEXT;
BEGIN
    -- Format the date part as YYYYMMDD
    date_part := TO_CHAR(created_date, 'YYYYMMDD');
    
    -- Count tickets created on the same day
    SELECT COUNT(*) INTO count_for_day
    FROM "Ticket"
    WHERE DATE_TRUNC('day', "createdAt") = DATE_TRUNC('day', created_date);
    
    -- Format sequential number with leading zeros
    sequential_number := LPAD(count_for_day::TEXT, 4, '0');
    
    -- Return the formatted display ID
    RETURN 'TKT-' || date_part || '-' || sequential_number;
END;
$$ LANGUAGE plpgsql;

-- Update tickets that don't have a displayId
UPDATE "Ticket"
SET "displayId" = generate_ticket_display_id("createdAt")
WHERE "displayId" IS NULL;

-- Drop the function after use
DROP FUNCTION generate_ticket_display_id;