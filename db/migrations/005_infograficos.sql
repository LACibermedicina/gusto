-- GUSTO · 005 · Infográficos gastronômicos públicos (fichas cognitivas em 4 quadrantes) · by m3d.pro
INSERT INTO features(code,label) VALUES ('infograficos','Gerar e publicar infográficos') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS infograficos(
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  titulo     text NOT NULL,
  categoria  text NOT NULL,
  conteudo   jsonb NOT NULL,
  publicado  boolean NOT NULL DEFAULT false,
  destaque   boolean NOT NULL DEFAULT false,
  origem     text NOT NULL DEFAULT 'equipe' CHECK (origem IN ('equipe','ia')),
  criado_por uuid REFERENCES users ON DELETE SET NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS infograficos_publicados ON infograficos(publicado, destaque DESC, atualizado_em DESC);
