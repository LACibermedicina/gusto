-- 009 · vídeos dos pratos: reels (curtos), stories (24 h) e lives/tutoriais (longos ou links externos) por receita
CREATE TABLE IF NOT EXISTS os_videos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  slug text NOT NULL REFERENCES infograficos(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('reel','story','tutorial','live')),
  origem text NOT NULL CHECK (origem IN ('upload','gravacao','link')),
  status text NOT NULL DEFAULT 'enviando' CHECK (status IN ('enviando','publicado','oculto')),
  legenda text NOT NULL DEFAULT '' CHECK (length(legenda) <= 300),
  url_externa text CHECK (url_externa IS NULL OR url_externa ~ '^https://'),
  plataforma text,
  incorporar text,                      -- URL de player permitido (youtube-nocookie / vimeo) ou NULL
  mime text,
  tamanho bigint,                       -- bytes declarados
  recebidos bigint NOT NULL DEFAULT 0,  -- bytes já gravados (envio em partes)
  partes int NOT NULL DEFAULT 0,
  duracao_s numeric,
  vistas int NOT NULL DEFAULT 0,
  expira_em timestamptz,                -- stories: 24 h depois de publicados
  criado timestamptz NOT NULL DEFAULT now(),
  publicado timestamptz,
  CHECK ((origem = 'link') = (url_externa IS NOT NULL)));
CREATE INDEX IF NOT EXISTS os_videos_slug ON os_videos(slug, status, tipo);
CREATE INDEX IF NOT EXISTS os_videos_autor ON os_videos(autor);
INSERT INTO features(code,label) VALUES ('os_videos','Enviar vídeos dos pratos (reels, stories, tutoriais)') ON CONFLICT DO NOTHING;
