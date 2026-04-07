-- H17: Create compliance_notes table

CREATE TABLE IF NOT EXISTS compliance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_item_id UUID REFERENCES compliance_items(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT CHECK (note_type IN ('user_note', 'ai_response', 'status_change', 'reminder')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_notes_item_id ON compliance_notes(compliance_item_id);

-- RLS — admin only
ALTER TABLE compliance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to compliance_notes"
  ON compliance_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
