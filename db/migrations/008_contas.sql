-- 008 · cadastro aberto e entrada com provedores externos (Google, X, Apple, Microsoft)
CREATE TABLE IF NOT EXISTS os_identidades(
  provedor text NOT NULL CHECK (provedor IN ('google','x','apple','microsoft')),
  sujeito text NOT NULL,                       -- "sub" do provedor (estável por app); nunca o e-mail
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  email text,                                  -- só informativo (LGPD: exportado e apagado com a conta)
  criado timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provedor, sujeito));
CREATE INDEX IF NOT EXISTS os_identidades_user ON os_identidades(user_id);
-- Estado do fluxo OAuth: hash do state, verificador PKCE e nonce; uso único, expira em 10 min.
CREATE TABLE IF NOT EXISTS os_oauth_estados(
  state text PRIMARY KEY, provedor text NOT NULL, verificador text NOT NULL, nonce text NOT NULL,
  vincular uuid REFERENCES users ON DELETE CASCADE, criado timestamptz NOT NULL DEFAULT now());
-- Contas criadas por provedor externo não têm senha conhecida pelo usuário (eliminação LGPD confirma pelo nome de usuário).
ALTER TABLE users ADD COLUMN IF NOT EXISTS senha_local boolean NOT NULL DEFAULT true;
