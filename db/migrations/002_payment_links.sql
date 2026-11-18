-- GUSTO · migração 002: pagamentos por link (rode depois de gusto_schema.sql)
CREATE TYPE paylink_status  AS ENUM ('open','processing','paid','expired','cancelled');
CREATE TYPE paylink_purpose AS ENUM ('topup','charge','credits');   -- saldo R$, cobrança de serviço, compra de créditos
ALTER TYPE ledger_kind ADD VALUE IF NOT EXISTS 'credits_purchase';

CREATE TABLE payment_links(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,                       -- só o hash do token vai ao banco
  creator uuid NOT NULL REFERENCES users,
  purpose paylink_purpose NOT NULL,
  amount_brl numeric(12,2) NOT NULL CHECK (amount_brl BETWEEN 1 AND 10000),
  credits numeric CHECK (credits > 0),
  description text, order_id uuid REFERENCES orders,
  status paylink_status NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL,
  provider text NOT NULL, provider_ref text UNIQUE, pay_url text, pix_code text,
  paid_at timestamptz, created_at timestamptz DEFAULT now());
CREATE INDEX ON payment_links(creator, created_at DESC);
CREATE TABLE payments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES payment_links,
  provider text NOT NULL, provider_ref text NOT NULL,
  amount_brl numeric(12,2) NOT NULL, fee_brl numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('received','refund_needed')),  -- refund_needed: link cancelado ou valor divergente
  raw jsonb, created_at timestamptz DEFAULT now(),
  UNIQUE(provider, provider_ref));
CREATE TABLE webhook_events(provider text, event_id text, received_at timestamptz DEFAULT now(), payload jsonb, PRIMARY KEY(provider,event_id));  -- idempotência
INSERT INTO features(code,label) VALUES ('paylink','Pagamentos por link') ON CONFLICT DO NOTHING;
INSERT INTO price_table(code,value,unit) VALUES ('credit_rate_brl',1.00,'brl/credit'),('paylink_fee',2.0,'percent') ON CONFLICT DO NOTHING;
