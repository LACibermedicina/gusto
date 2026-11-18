-- GUSTO · 004 · Camada OS v0.1.0-alpha (grafos, notas, comunidade, IA, LGPD) · by m3d.pro
-- Idempotente o bastante para reexecução manual; o runner registra em schema_migrations.

-- ===== Funcionalidades novas (autorizáveis por usuário via user_feature_overrides) =====
INSERT INTO features(code,label) VALUES
  ('os_graph','Grafo de funcionalidades'),
  ('notes','Notas da agenda'),
  ('chat','Chat da comunidade'),
  ('video','Videochamada'),
  ('avatar','Assistente 3D'),
  ('i18n_ai','Tradução contextual por IA')
ON CONFLICT DO NOTHING;

-- ===== LGPD: consentimentos versionados (base legal art. 7º, I e art. 8º) =====
CREATE TABLE IF NOT EXISTS lgpd_consents(
  user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('terms','ai_processing','chat_history','video')),
  granted    boolean NOT NULL,
  version    text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, purpose));
CREATE TABLE IF NOT EXISTS lgpd_requests(
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('export','delete')),
  status     text NOT NULL DEFAULT 'done',
  at         timestamptz NOT NULL DEFAULT now());

-- ===== Grafo de funcionalidades (nós e conexões, por usuário) =====
CREATE TABLE IF NOT EXISTS os_graphs(
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Meu grafo' CHECK (length(name) BETWEEN 1 AND 80),
  data       jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name));

-- ===== Notas cruzadas da agenda =====
CREATE TABLE IF NOT EXISTS os_notes(
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  day        date NOT NULL,
  title      text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body       text NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS os_notes_owner_day ON os_notes(owner_id, day);
CREATE TABLE IF NOT EXISTS os_note_links(
  a uuid NOT NULL REFERENCES os_notes ON DELETE CASCADE,
  b uuid NOT NULL REFERENCES os_notes ON DELETE CASCADE,
  PRIMARY KEY(a,b), CHECK (a < b));

-- ===== Comunidade: salas e mensagens (retenção limitada, ver CHAT_RETENTION_DAYS) =====
CREATE TABLE IF NOT EXISTS chat_rooms(
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  title      text NOT NULL,
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chat_messages(
  id         bigserial PRIMARY KEY,
  room_id    uuid NOT NULL REFERENCES chat_rooms ON DELETE CASCADE,
  author_id  uuid REFERENCES users ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  at         timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS chat_messages_room_at ON chat_messages(room_id, at DESC);
INSERT INTO chat_rooms(slug,title) VALUES ('geral','Geral'),('receitas','Receitas'),('entregas','Entregas')
ON CONFLICT DO NOTHING;

-- ===== Cache de tradução por IA (só textos de interface/conteúdo, sem identificação do usuário) =====
CREATE TABLE IF NOT EXISTS ai_translation_cache(
  lang       text NOT NULL CHECK (lang IN ('pt','en','es','zh','hi')),
  src_hash   text NOT NULL,
  translated text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(lang, src_hash));

-- ===== Gamificação do assistente =====
CREATE TABLE IF NOT EXISTS os_xp(
  user_id    uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  xp         int NOT NULL DEFAULT 0 CHECK (xp >= 0),
  muted      boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now());
