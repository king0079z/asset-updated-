-- Enable Row Level Security on the Ticket table
ALTER TABLE "public"."Ticket" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to select only their own tickets
CREATE POLICY "Users can view their own tickets" 
ON "public"."Ticket"
FOR SELECT
USING (auth.uid()::text = "userId");

-- Create policy to allow users to insert their own tickets
CREATE POLICY "Users can create their own tickets" 
ON "public"."Ticket"
FOR INSERT
WITH CHECK (auth.uid()::text = "userId");

-- Create policy to allow users to update their own tickets
CREATE POLICY "Users can update their own tickets" 
ON "public"."Ticket"
FOR UPDATE
USING (auth.uid()::text = "userId");

-- Create policy to allow users to delete their own tickets
CREATE POLICY "Users can delete their own tickets" 
ON "public"."Ticket"
FOR DELETE
USING (auth.uid()::text = "userId");

-- Comment explaining the security enhancement
COMMENT ON TABLE "public"."Ticket" IS 'Tickets with Row Level Security enabled. Users can only access their own tickets.';