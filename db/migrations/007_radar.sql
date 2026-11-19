-- GUSTO · 007 · Radar público: popularidade anônima e vínculo ficha ↔ receita do app · by m3d.pro
ALTER TABLE infograficos ADD COLUMN IF NOT EXISTS receita_id uuid REFERENCES recipes ON DELETE SET NULL;
-- Popularidade: só contagem diária de aberturas da ficha (sem IP, sem usuário, sem localização).
CREATE TABLE IF NOT EXISTS infografico_visitas(
  slug text NOT NULL REFERENCES infograficos(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  dia  date NOT NULL DEFAULT current_date,
  n    int  NOT NULL DEFAULT 0,
  PRIMARY KEY(slug, dia));
