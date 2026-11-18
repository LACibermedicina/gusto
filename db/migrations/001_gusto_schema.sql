-- GUSTO · esquema PostgreSQL 15+ · by m3d.pro
-- Antes de rodar:  SET app.root_initial_password = '<senha inicial do root>';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- v0.1.0: necessário para EXCLUDE com uuid (kitchen_rentals)

CREATE TYPE role_code AS ENUM ('client','cook','courier','inspector');
CREATE TYPE order_status AS ENUM ('requested','cooking','ready','pickup','in_route','delivered','cancelled');
CREATE TYPE reg_status AS ENUM ('draft','pending','approved','rejected','revoked','expired');
CREATE TYPE ledger_kind AS ENUM ('reward','escrow_hold','escrow_release','fee','market_buy','market_sell','rental','loan','adjust');

-- ===== 1. IDENTIDADE, CREDENCIAIS E PERMISSÕES =====
CREATE TABLE users(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9._-]{3,20}$'),
  display_name text NOT NULL,
  password_hash text NOT NULL,                 -- bcrypt via crypt(); nunca texto puro
  is_root boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX one_root ON users(is_root) WHERE is_root;
CREATE TABLE user_roles(user_id uuid REFERENCES users ON DELETE CASCADE, role role_code, granted_by uuid REFERENCES users, PRIMARY KEY(user_id,role));
CREATE TABLE features(code text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT true);  -- liga/desliga global
CREATE TABLE user_feature_overrides(user_id uuid REFERENCES users ON DELETE CASCADE, feature text REFERENCES features, allowed boolean NOT NULL, set_by uuid REFERENCES users, set_at timestamptz DEFAULT now(), PRIMARY KEY(user_id,feature));
CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, ip inet, user_agent text, created_at timestamptz DEFAULT now(), expires_at timestamptz NOT NULL, revoked boolean DEFAULT false);
CREATE TABLE audit_log(id bigserial PRIMARY KEY, actor uuid REFERENCES users, action text NOT NULL, entity text, entity_id text, detail jsonb, ip inet, at timestamptz DEFAULT now());
CREATE INDEX ON audit_log(actor, at DESC);

CREATE FUNCTION can_use(p_user uuid, p_feature text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT is_root FROM users WHERE id=p_user),false)
      OR ((SELECT enabled FROM features WHERE code=p_feature)
          AND COALESCE((SELECT allowed FROM user_feature_overrides WHERE user_id=p_user AND feature=p_feature),true)
          AND (SELECT is_active FROM users WHERE id=p_user)) $$;

-- ===== 2. PERFIL, DIETAS E CALENDÁRIO =====
CREATE TABLE profiles(user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, phone text, address text, home geography(Point,4326), locale text DEFAULT 'pt-BR');
CREATE TABLE diets(code text PRIMARY KEY, label text);
CREATE TABLE user_diets(user_id uuid REFERENCES users ON DELETE CASCADE, diet text REFERENCES diets, PRIMARY KEY(user_id,diet));
CREATE TABLE menu_plan(user_id uuid REFERENCES users ON DELETE CASCADE, day date, slot text, recipe_id uuid, PRIMARY KEY(user_id,day,slot));

-- ===== 3. RECEITAS, INGREDIENTES, GRAFO E TUTORIAIS =====
CREATE TABLE ingredients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL, kcal_100g numeric, protein_100g numeric, carb_100g numeric, fat_100g numeric);
CREATE TABLE recipes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid REFERENCES users, title text NOT NULL, kind text, origin text, health_notes text,
  prep_minutes int, kcal int, protein_g numeric, carb_g numeric, fat_g numeric, packaging_note text, conservation_note text, image_data text, created_at timestamptz DEFAULT now());
CREATE TABLE recipe_ingredients(recipe_id uuid REFERENCES recipes ON DELETE CASCADE, ingredient_id uuid REFERENCES ingredients, quantity text, PRIMARY KEY(recipe_id,ingredient_id));
CREATE TABLE recipe_diets(recipe_id uuid REFERENCES recipes ON DELETE CASCADE, diet text REFERENCES diets, PRIMARY KEY(recipe_id,diet));
CREATE TABLE recipe_variations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid NOT NULL REFERENCES recipes ON DELETE CASCADE, name text NOT NULL, change_note text, UNIQUE(recipe_id,name));
CREATE TABLE recipe_edges(src uuid REFERENCES recipes ON DELETE CASCADE, dst uuid REFERENCES recipes ON DELETE CASCADE, relation text CHECK (relation IN ('similar','derived_from','pairs_with')), weight real DEFAULT 1, PRIMARY KEY(src,dst,relation));   -- alimenta o mapa 3D
CREATE TABLE tutorials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid NOT NULL REFERENCES recipes ON DELETE CASCADE, variation_id uuid REFERENCES recipe_variations, author_id uuid NOT NULL REFERENCES users, title text, url text NOT NULL CHECK (url ~ '^https?://'), created_at timestamptz DEFAULT now());
CREATE TABLE stores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, location geography(Point,4326));
CREATE TABLE store_items(store_id uuid REFERENCES stores ON DELETE CASCADE, ingredient_id uuid REFERENCES ingredients, price numeric, PRIMARY KEY(store_id,ingredient_id));
CREATE TABLE shopping_items(user_id uuid REFERENCES users ON DELETE CASCADE, ingredient_id uuid REFERENCES ingredients, done boolean DEFAULT false, PRIMARY KEY(user_id,ingredient_id));

-- ===== 4. REGISTROS, ESPAÇOS, INSPEÇÃO E PERMISSÕES SANITÁRIAS =====
CREATE TABLE kitchens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users, name text, location geography(Point,4326), rent_per_hour numeric, rentable boolean DEFAULT false);
CREATE TABLE kitchen_equipment(kitchen_id uuid REFERENCES kitchens ON DELETE CASCADE, item text, PRIMARY KEY(kitchen_id,item));
CREATE TABLE registrations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users, kind role_code NOT NULL CHECK (kind IN ('cook','courier')), kitchen_id uuid REFERENCES kitchens,
  document_no text, food_handling_course boolean, dish_categories text, delivery_method text, packaging_type text, vehicle_plate text, media_url text,
  status reg_status NOT NULL DEFAULT 'draft', requested_at timestamptz, reviewed_by uuid REFERENCES users, reviewed_at timestamptz, reject_reason text,
  permit_no text UNIQUE, valid_until date);
CREATE TABLE checklist_items(id serial PRIMARY KEY, kind role_code, label text NOT NULL);
CREATE TABLE registration_checks(registration_id uuid REFERENCES registrations ON DELETE CASCADE, item_id int REFERENCES checklist_items, declared boolean DEFAULT false, confirmed_by_inspector boolean DEFAULT false, PRIMARY KEY(registration_id,item_id));
CREATE INDEX ON registrations(status, kind);

-- ===== 5. PEDIDOS, PREÇOS, EMBALAGEM, ENTREGA E CÓDIGOS =====
CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES users, recipe_id uuid NOT NULL REFERENCES recipes, variation_id uuid REFERENCES recipe_variations,
  preferred_cook uuid REFERENCES users, cook_id uuid REFERENCES users, courier_id uuid REFERENCES users, status order_status NOT NULL DEFAULT 'requested',
  cook_price numeric, courier_price numeric, eta_minutes int, delivery_to geography(Point,4326), notes text, created_at timestamptz DEFAULT now());
CREATE INDEX ON orders(status, created_at);
CREATE TABLE order_status_history(id bigserial PRIMARY KEY, order_id uuid REFERENCES orders ON DELETE CASCADE, status order_status, by_user uuid REFERENCES users, at timestamptz DEFAULT now());
CREATE TABLE order_packaging(order_id uuid PRIMARY KEY REFERENCES orders ON DELETE CASCADE, container text, instructions text, locked boolean DEFAULT false);
CREATE TABLE packaging_slots(id bigserial PRIMARY KEY, order_id uuid REFERENCES orders ON DELETE CASCADE, slot_name text, item_label text, is_drink boolean DEFAULT false);
CREATE TABLE order_checklist(order_id uuid REFERENCES orders ON DELETE CASCADE, step text, done boolean DEFAULT false, PRIMARY KEY(order_id,step));
CREATE TABLE order_media(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders ON DELETE CASCADE, phase text CHECK (phase IN ('setup_before','during','after','result')), url text, uploaded_by uuid REFERENCES users);
CREATE TABLE handoff_codes(order_id uuid REFERENCES orders ON DELETE CASCADE, kind text CHECK (kind IN ('pickup','delivery')), code_hash text NOT NULL, qr_payload text, attempts int DEFAULT 0, validated_at timestamptz, validated_by uuid REFERENCES users, PRIMARY KEY(order_id,kind));
CREATE TABLE route_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), courier_id uuid REFERENCES users, order_id uuid REFERENCES orders, path geography(LineString,4326), distance_km numeric, traffic_factor numeric, planned_at timestamptz DEFAULT now());
CREATE TABLE courier_positions(courier_id uuid REFERENCES users, at timestamptz DEFAULT now(), pos geography(Point,4326), PRIMARY KEY(courier_id,at));

-- ===== 6. CARTEIRA, CUSTÓDIA E CORRETORA =====
CREATE TABLE wallets(user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, credits numeric NOT NULL DEFAULT 0 CHECK (credits >= 0), brl numeric NOT NULL DEFAULT 0 CHECK (brl >= 0));
CREATE TABLE ledger(id bigserial PRIMARY KEY, user_id uuid REFERENCES users, kind ledger_kind NOT NULL, amount numeric NOT NULL, ref_order uuid REFERENCES orders, memo text, at timestamptz DEFAULT now());
CREATE TABLE escrow_holds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders, payer uuid REFERENCES users, payee uuid REFERENCES users, amount numeric NOT NULL, released boolean DEFAULT false, released_at timestamptz);
CREATE TABLE price_table(code text PRIMARY KEY, value numeric NOT NULL, unit text, set_by uuid REFERENCES users, set_at timestamptz DEFAULT now());  -- recompensas, taxas, aluguéis
CREATE TABLE market_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seller uuid NOT NULL REFERENCES users, qty numeric CHECK (qty > 0), price_brl numeric CHECK (price_brl > 0), open boolean DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE market_trades(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid REFERENCES market_offers, buyer uuid REFERENCES users, qty numeric, price_brl numeric, fee_brl numeric, at timestamptz DEFAULT now());

-- ===== 7. RECURSOS, EMPRÉSTIMOS E LOCAÇÃO =====
CREATE TABLE lendable_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES users, name text, price_credits numeric, location geography(Point,4326), available boolean DEFAULT true);
CREATE TABLE loans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid REFERENCES lendable_items, borrower uuid REFERENCES users, from_at timestamptz, to_at timestamptz, returned boolean DEFAULT false);
CREATE TABLE kitchen_rentals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kitchen_id uuid REFERENCES kitchens, renter uuid REFERENCES users, period tstzrange NOT NULL, price_credits numeric, EXCLUDE USING gist (kitchen_id WITH =, period WITH &&));

-- ===== 8. FEED, COMENTÁRIOS E NOTIFICAÇÕES =====
CREATE TABLE posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES users, body text, media_url text, recipe_id uuid REFERENCES recipes, order_id uuid REFERENCES orders, created_at timestamptz DEFAULT now());
CREATE TABLE comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid REFERENCES posts ON DELETE CASCADE, author_id uuid REFERENCES users, body text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE notifications(id bigserial PRIMARY KEY, user_id uuid REFERENCES users ON DELETE CASCADE, body text, read boolean DEFAULT false, at timestamptz DEFAULT now());

-- ===== 9. SEMENTES =====
INSERT INTO features(code,label) VALUES ('feed','Feed e comentários'),('map','Mapa 3D'),('rec_new','Cadastrar receitas'),('tut','Tutoriais em vídeo'),('mk','Mercado de créditos'),('res','Espaços, itens e compras');
INSERT INTO diets VALUES ('vegano','Vegano'),('vegetariano','Vegetariano'),('sem-gluten','Sem glúten'),('sem-lactose','Sem lactose'),('low-carb','Low carb');
INSERT INTO price_table(code,value,unit) VALUES ('reward_recipe',10,'credits'),('reward_post',3,'credits'),('loan_item',2,'credits'),('rent_space_hour',15,'credits'),('broker_fee',8,'percent');
INSERT INTO checklist_items(kind,label) VALUES
 ('cook','Bancada lisa e higienizável'),('cook','Fogão e forno funcionando'),('cook','Geladeira/freezer com termômetro'),('cook','Pia com água potável e sabão'),
 ('cook','Lixeira com tampa e pedal'),('cook','EPIs: touca, luvas, avental'),('cook','Controle de pragas em dia'),('cook','Rotina de higienização registrada'),
 ('courier','Bag higienizada'),('courier','Caixa térmica/refrigerada'),('courier','Termômetro de alimentos'),('courier','Veículo em boas condições'),('courier','Documento válido');
-- superusuário: senha vinda da configuração, exige troca no primeiro acesso
INSERT INTO users(username,display_name,password_hash,is_root,must_change_password)
 VALUES ('root','Superusuário', crypt(current_setting('app.root_initial_password'), gen_salt('bf',12)), true, true);
INSERT INTO user_roles SELECT u.id, r FROM users u, unnest(ARRAY['client','cook','courier']::role_code[]) r WHERE u.is_root;  -- fiscal (inspector) só por atribuição do administrador
INSERT INTO wallets(user_id) SELECT id FROM users WHERE is_root;
-- login: SELECT id FROM users WHERE username=$1 AND is_active AND (locked_until IS NULL OR locked_until<now()) AND password_hash = crypt($2, password_hash);
