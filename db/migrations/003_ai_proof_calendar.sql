-- GUSTO · migração 003: receitas por IA (experimento), prova de conceito e calendário (rode depois da 002)
CREATE TYPE recipe_status AS ENUM ('experiment','in_proof','proven');
ALTER TABLE recipes ADD COLUMN is_ai boolean NOT NULL DEFAULT false, ADD COLUMN ai_prompt text, ADD COLUMN steps jsonb,
  ADD COLUMN status recipe_status NOT NULL DEFAULT 'in_proof';
CREATE TABLE recipe_feedback(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes ON DELETE CASCADE,
  order_id uuid UNIQUE REFERENCES orders,                   -- um feedback por pedido entregue
  user_id uuid NOT NULL REFERENCES users,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text,
  evidence_url text CHECK (evidence_url IS NULL OR evidence_url ~ '^https?://'),   -- vídeo ou foto da prova
  created_at timestamptz DEFAULT now());
CREATE TABLE calendar_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  recipe_id uuid REFERENCES recipes, order_id uuid REFERENCES orders,
  starts_at timestamptz NOT NULL,
  time_source text NOT NULL CHECK (time_source IN ('drop','selected','request_time','edited')),
  created_at timestamptz DEFAULT now(),
  CHECK (recipe_id IS NOT NULL OR order_id IS NOT NULL));
CREATE INDEX ON calendar_entries(user_id, starts_at);
INSERT INTO price_table(code,value,unit) VALUES ('proof_min_feedback',2,'count'),('proof_min_rating',4,'stars') ON CONFLICT DO NOTHING;
INSERT INTO features(code,label) VALUES ('ai','Assistente de IA'),('calendar','Calendário') ON CONFLICT DO NOTHING;

-- "provada" = feedbacks suficientes, média mínima e ao menos uma evidência (mídia no feedback ou tutorial de usuário)
CREATE FUNCTION refresh_recipe_status(p uuid) RETURNS void LANGUAGE sql AS $$
 UPDATE recipes r SET status = CASE
   WHEN f.n >= (SELECT value FROM price_table WHERE code='proof_min_feedback')
    AND f.avg >= (SELECT value FROM price_table WHERE code='proof_min_rating')
    AND (f.ev > 0 OR EXISTS (SELECT 1 FROM tutorials t WHERE t.recipe_id=r.id)) THEN 'proven'::recipe_status
   WHEN r.is_ai THEN 'experiment'::recipe_status ELSE 'in_proof'::recipe_status END
 FROM (SELECT count(*) n, coalesce(avg(rating),0) avg, count(evidence_url) ev FROM recipe_feedback WHERE recipe_id=p) f
 WHERE r.id=p $$;
CREATE FUNCTION trg_refresh() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM refresh_recipe_status(NEW.recipe_id); RETURN NEW; END $$;
CREATE TRIGGER fb_refresh  AFTER INSERT ON recipe_feedback FOR EACH ROW EXECUTE FUNCTION trg_refresh();
CREATE TRIGGER tut_refresh AFTER INSERT ON tutorials       FOR EACH ROW EXECUTE FUNCTION trg_refresh();
UPDATE recipes SET status='in_proof' WHERE NOT is_ai;
