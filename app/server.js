// GUSTO API · Express + PostgreSQL · by m3d.pro
import express from "express";import pg from "pg";import bcrypt from "bcryptjs";import crypto from "crypto";import helmet from "helmet";import rateLimit from "express-rate-limit";import path from "path";import{fileURLToPath}from"url";
const{DATABASE_URL,PORT=3000,CODE_SECRET,NODE_ENV}=process.env;
if(!CODE_SECRET||CODE_SECRET.length<32)throw new Error("Defina CODE_SECRET com 32+ caracteres");
const pool=new pg.Pool({connectionString:DATABASE_URL}),q=(t,p)=>pool.query(t,p);
class E extends Error{constructor(s,m){super(m);this.s=s}}
async function tx(fn){const c=await pool.connect();try{await c.query("BEGIN");const r=await fn(c);await c.query("COMMIT");return r}catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}}
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const mkcode=(oid,kind)=>String(parseInt(crypto.createHmac("sha256",CODE_SECRET).update(oid+"|"+kind).digest("hex").slice(0,8),16)%1e6).padStart(6,"0"); // código derivado: nunca guardado em texto puro
const ah=f=>(a,b,c)=>f(a,b,c).catch(c),one=r=>r.rows[0];
const au=(c,actor,action,entity,id,detail)=>c.query("insert into audit_log(actor,action,entity,entity_id,detail) values($1,$2,$3,$4,$5)",[actor,action,entity,id,detail||null]);
const hist=(c,oid,st,by)=>c.query("insert into order_status_history(order_id,status,by_user) values($1,$2,$3)",[oid,st,by]);
const ROLES=["client","cook","courier","inspector"];
const A=ah(async(req,res,next)=>{const m=/gusto_sid=([a-f0-9]{64})/.exec(req.headers.cookie||"");if(!m)throw new E(401,"Não autenticado");
 const u=one(await q(`select u.id,u.username,u.display_name,u.is_root,u.must_change_password,array(select role::text from user_roles where user_id=u.id) roles from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and not s.revoked and s.expires_at>now() and u.is_active`,[sha(m[1])]));
 if(!u)throw new E(401,"Sessão inválida");req.u=u;req.tok=sha(m[1]);
 if(u.must_change_password&&!["/auth/password","/me"].includes(req.path))throw new E(403,"Troque a senha inicial");next()});
const need=r=>(req,res,next)=>(r!="inspector"&&req.u.is_root)||req.u.roles.includes(r)?next():next(new E(403,"Papel não autorizado"));
const root=(req,res,next)=>req.u.is_root?next():next(new E(403,"Apenas root"));
const feat=f=>ah(async(req,res,next)=>{if(!one(await q("select can_use($1,$2) ok",[req.u.id,f])).ok)throw new E(403,"Funcionalidade não autorizada");next()});
const permit=async(uid,kind)=>{if(!(await q("select 1 from registrations where user_id=$1 and kind=$2 and status='approved' and valid_until>=current_date",[uid,kind])).rowCount)throw new E(403,"Sem autorização sanitária/operacional válida")};
const fee=async c=>Number(one(await c.query("select value from price_table where code='broker_fee'")).value)/100;
const price=async code=>Number(one(await q("select value from price_table where code=$1",[code])).value);
// ===== PAGAMENTOS POR LINK: provedores, liquidação e webhook =====
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sigOk=(raw,sig)=>{const w=process.env.WEBHOOK_SECRET;if(!w||!sig)return false;const h=crypto.createHmac("sha256",w).update(raw).digest("hex");return sig.length==h.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(h))};
// Cada provedor (Pix/cartão) tem assinatura e formato próprios: ajuste verify() e charge() ao escolhido.
const providers={
 mock:{name:"mock",verify:(r,h)=>sigOk(r,h["x-signature"]),charge:async l=>({ref:"mock_"+l.id,pix_code:"MOCK-"+l.id.slice(0,8)})},
 http:{name:"http",verify:(r,h)=>sigOk(r,h["x-signature"]),charge:async l=>{
  const r=await fetch(process.env.PSP_API_URL,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.PSP_API_KEY},body:JSON.stringify({amount:Number(l.amount_brl),currency:"BRL",external_reference:l.id,description:l.description,notification_url:process.env.PUBLIC_URL+"/webhooks/http",expires_at:l.expires_at})});
  if(!r.ok)throw new E(502,"Falha no provedor de pagamento");const d=await r.json();return{ref:String(d.id),pay_url:d.pay_url,pix_code:d.pix_code}}}};
const PV=providers[process.env.PAYMENTS_PROVIDER||"mock"];
async function settle(c,l,ev){const amt=Number(ev.amount),bad=l.status=="cancelled"||amt!=Number(l.amount_brl);
 const p=one(await c.query("insert into payments(link_id,provider,provider_ref,amount_brl,status,raw) values($1,$2,$3,$4,$5,$6) on conflict(provider,provider_ref) do nothing returning id",[l.id,l.provider,l.provider_ref,amt,bad?"refund_needed":"received",ev]));
 if(!p)return;if(bad){await au(c,null,"paylink.refund_needed","payment_link",l.id,{amt});return}
 let fe=0;
 if(l.purpose=="topup")await c.query("update wallets set brl=brl+$1 where user_id=$2",[amt,l.creator]);
 else if(l.purpose=="charge"){fe=+(amt*Number(one(await c.query("select value from price_table where code='paylink_fee'")).value)/100).toFixed(2);await c.query("update wallets set brl=brl+$1 where user_id=$2",[amt-fe,l.creator])}
 else{await c.query("update wallets set credits=credits+$1 where user_id=$2",[l.credits,l.creator]);await c.query("insert into ledger(user_id,kind,amount,memo) values($1,'credits_purchase',$2,'link')",[l.creator,l.credits])}
 await c.query("update payments set fee_brl=$2 where id=$1",[p.id,fe]);await c.query("update payment_links set status='paid',paid_at=now() where id=$1",[l.id]);await au(c,null,"paylink.paid","payment_link",l.id,{amt,fe})}
async function applyEvent(name,ev){await tx(async c=>{if(!(await c.query("insert into webhook_events(provider,event_id,payload) values($1,$2,$3) on conflict do nothing",[name,String(ev.id),ev])).rowCount||ev.type!="payment.paid")return;
 const l=one(await c.query("select * from payment_links where id=$1 and provider=$2 and provider_ref=$3 for update",[ev.external_reference,name,String(ev.provider_ref)]));if(!l)throw new E(404,"Cobrança desconhecida");await settle(c,l,ev)})}
const webhook=async(req,res)=>{const pv=providers[req.params.provider];if(!pv)throw new E(404,"Provedor desconhecido");if(!Buffer.isBuffer(req.body)||!pv.verify(req.body,req.headers))throw new E(401,"Assinatura inválida");
 let ev;try{ev=JSON.parse(req.body.toString("utf8"))}catch{throw new E(400,"JSON inválido")}await applyEvent(pv.name,ev);res.json({ok:true})};
const app=express();app.set("trust proxy",1);app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'","https://cdnjs.cloudflare.com"],scriptSrcAttr:["'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:"],connectSrc:["'self'","https://overpass-api.de"],frameAncestors:["'none'"],objectSrc:["'none'"],...(process.env.COOKIE_SECURE=="0"?{upgradeInsecureRequests:null}:{})}}}));app.use((req,res,n)=>{res.setHeader("Permissions-Policy","geolocation=(self)");n()});app.post("/webhooks/:provider",express.raw({type:"*/*",limit:"100kb"}),ah(webhook));app.use(express.json({limit:"100kb"}));
app.use((req,res,n)=>req.method!="GET"&&!req.is("json")?res.status(415).json({error:"Envie JSON (proteção CSRF)"}):n());

// ===== AUTENTICAÇÃO =====
app.post("/auth/login",rateLimit({windowMs:60000,max:20}),ah(async(req,res)=>{
 const u=one(await q("select * from users where username=$1",[String(req.body.username||"").toLowerCase()]));
 if(u?.locked_until&&u.locked_until>new Date())throw new E(429,"Conta temporariamente bloqueada");
 if(!(u&&u.is_active&&await bcrypt.compare(String(req.body.password||""),u.password_hash))){
  if(u)await q("update users set failed_logins=case when failed_logins+1>=5 then 0 else failed_logins+1 end,locked_until=case when failed_logins+1>=5 then now()+interval '15 minutes' else locked_until end where id=$1",[u.id]);
  throw new E(401,"Usuário ou senha inválidos")}
 const t=crypto.randomBytes(32).toString("hex");
 await q("insert into sessions(user_id,token_hash,ip,user_agent,expires_at) values($1,$2,$3,$4,now()+interval '8 hours')",[u.id,sha(t),req.ip,req.get("user-agent")]);
 await q("update users set failed_logins=0,locked_until=null where id=$1",[u.id]);await au(pool,u.id,"login","user",u.id);
 res.setHeader("Set-Cookie",`gusto_sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.COOKIE_SECURE=="0"?"":"; Secure"}`);
 res.json({ok:true,must_change_password:u.must_change_password})}));
app.post("/auth/logout",A,ah(async(req,res)=>{await q("update sessions set revoked=true where token_hash=$1",[req.tok]);res.setHeader("Set-Cookie","gusto_sid=; Max-Age=0; Path=/");res.json({ok:true})}));
app.post("/auth/password",A,ah(async(req,res)=>{const{old,next}=req.body;if(String(next||"").length<8)throw new E(400,"Nova senha com 8+ caracteres");
 const u=one(await q("select password_hash from users where id=$1",[req.u.id]));if(!await bcrypt.compare(String(old||""),u.password_hash))throw new E(401,"Senha atual incorreta");
 await q("update users set password_hash=$2,must_change_password=false where id=$1",[req.u.id,await bcrypt.hash(next,12)]);
 await q("update sessions set revoked=true where user_id=$1 and token_hash<>$2",[req.u.id,req.tok]);res.json({ok:true})}));
app.get("/me",A,(req,res)=>res.json(req.u));

// ===== ADMIN (root): usuários, funções e funcionalidades =====
const ad=express.Router();ad.use(A,root);
ad.get("/users",ah(async(req,res)=>res.json((await q(`select u.id,username,display_name,is_active,is_root,array(select role::text from user_roles where user_id=u.id) roles,coalesce((select json_object_agg(feature,allowed) from user_feature_overrides where user_id=u.id),'{}') overrides from users u order by created_at`)).rows)));
ad.post("/users",ah(async(req,res)=>{const{username,display_name,password,roles}=req.body;
 if(!/^[a-z0-9._-]{3,20}$/.test(username||"")||String(password||"").length<8||!Array.isArray(roles)||!roles.length||roles.some(r=>!ROLES.includes(r)))throw new E(400,"Dados inválidos");
 const id=await tx(async c=>{const u=one(await c.query("insert into users(username,display_name,password_hash,created_by,must_change_password) values($1,$2,$3,$4,true) returning id",[username,display_name||username,await bcrypt.hash(password,12),req.u.id]));
  for(const r of roles)await c.query("insert into user_roles(user_id,role,granted_by) values($1,$2,$3)",[u.id,r,req.u.id]);
  await c.query("insert into wallets(user_id) values($1)",[u.id]);await au(c,req.u.id,"user.create","user",u.id,{roles});return u.id});res.status(201).json({id})}));
ad.patch("/users/:id",ah(async(req,res)=>{await q("update users set is_active=$2 where id=$1 and not is_root",[req.params.id,!!req.body.is_active]);if(!req.body.is_active)await q("update sessions set revoked=true where user_id=$1",[req.params.id]);await au(pool,req.u.id,"user.active","user",req.params.id,req.body);res.json({ok:true})}));
ad.put("/users/:id/roles",ah(async(req,res)=>{const r=req.body.roles;if(!Array.isArray(r)||r.some(x=>!ROLES.includes(x)))throw new E(400,"Funções inválidas");
 await tx(async c=>{await c.query("delete from user_roles where user_id=$1",[req.params.id]);for(const x of r)await c.query("insert into user_roles values($1,$2,$3)",[req.params.id,x,req.u.id]);await au(c,req.u.id,"user.roles","user",req.params.id,{r})});res.json({ok:true})}));
ad.post("/users/:id/reset-password",ah(async(req,res)=>{if(String(req.body.password||"").length<8)throw new E(400,"Senha com 8+ caracteres");
 await q("update users set password_hash=$2,must_change_password=true where id=$1",[req.params.id,await bcrypt.hash(req.body.password,12)]);await q("update sessions set revoked=true where user_id=$1",[req.params.id]);await au(pool,req.u.id,"user.reset","user",req.params.id);res.json({ok:true})}));
ad.put("/users/:id/features/:code",ah(async(req,res)=>{await q("insert into user_feature_overrides(user_id,feature,allowed,set_by) values($1,$2,$3,$4) on conflict(user_id,feature) do update set allowed=$3,set_by=$4,set_at=now()",[req.params.id,req.params.code,!!req.body.allowed,req.u.id]);await au(pool,req.u.id,"feature.user","user",req.params.id,{f:req.params.code,a:!!req.body.allowed});res.json({ok:true})}));
ad.put("/features/:code",ah(async(req,res)=>{await q("update features set enabled=$2 where code=$1",[req.params.code,!!req.body.enabled]);await au(pool,req.u.id,"feature.global","feature",req.params.code,req.body);res.json({ok:true})}));
ad.put("/prices/:code",ah(async(req,res)=>{await q("update price_table set value=$2,set_by=$3,set_at=now() where code=$1",[req.params.code,Number(req.body.value),req.u.id]);res.json({ok:true})}));
ad.get("/audit",ah(async(req,res)=>res.json((await q("select * from audit_log order by id desc limit 200")).rows)));
app.use("/admin",ad);

// ===== RECEITAS E TUTORIAIS =====
app.get("/recipes",A,ah(async(req,res)=>res.json((await q("select id,title,kind,origin,prep_minutes,kcal,status,is_ai from recipes order by created_at desc")).rows)));
app.get("/recipes/:id",A,ah(async(req,res)=>{const r=one(await q("select * from recipes where id=$1",[req.params.id]));if(!r)throw new E(404,"Não encontrada");
 const[i,v,t,s]=await Promise.all([q("select i.name,ri.quantity from recipe_ingredients ri join ingredients i on i.id=ri.ingredient_id where recipe_id=$1",[r.id]),q("select id,name,change_note from recipe_variations where recipe_id=$1",[r.id]),q("select id,variation_id,title,url,author_id from tutorials where recipe_id=$1",[r.id]),q("select dst,relation,weight from recipe_edges where src=$1",[r.id])]);
 res.json({...r,ingredients:i.rows,variations:v.rows,tutorials:t.rows,related:s.rows})}));
app.post("/recipes",A,feat("rec_new"),ah(async(req,res)=>{const b=req.body;if(!b.title)throw new E(400,"Título obrigatório");
 const id=await tx(async c=>{const r=one(await c.query("insert into recipes(author_id,title,kind,origin,health_notes,prep_minutes,kcal,protein_g,carb_g,fat_g,packaging_note,conservation_note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",[req.u.id,b.title,b.kind,b.origin,b.health_notes,b.prep_minutes,b.kcal,b.protein_g,b.carb_g,b.fat_g,b.packaging_note,b.conservation_note]));
  for(const n of b.ingredients||[]){const i=one(await c.query("insert into ingredients(name) values($1) on conflict(name) do update set name=excluded.name returning id",[String(n).trim().toLowerCase()]));await c.query("insert into recipe_ingredients(recipe_id,ingredient_id) values($1,$2) on conflict do nothing",[r.id,i.id])}
  for(const v of b.variations||[])await c.query("insert into recipe_variations(recipe_id,name,change_note) values($1,$2,$3)",[r.id,v.name,v.change_note]);
  const rw=await price("reward_recipe");await c.query("update wallets set credits=credits+$1 where user_id=$2",[rw,req.u.id]);await c.query("insert into ledger(user_id,kind,amount,memo) values($1,'reward',$2,'receita')",[req.u.id,rw]);return r.id});res.status(201).json({id})}));
app.post("/recipes/:id/tutorials",A,feat("tut"),ah(async(req,res)=>{if(!/^https?:\/\//.test(req.body.url||""))throw new E(400,"URL https obrigatória");
 await q("insert into tutorials(recipe_id,variation_id,author_id,title,url) values($1,$2,$3,$4,$5)",[req.params.id,req.body.variation_id||null,req.u.id,req.body.title,req.body.url]);
 const rw=await price("reward_post");await q("update wallets set credits=credits+$1 where user_id=$2",[rw,req.u.id]);res.status(201).json({ok:true})}));

// ===== REGISTROS E INSPEÇÃO =====
app.post("/registrations",A,ah(async(req,res)=>{const b=req.body;if(!["cook","courier"].includes(b.kind)||!req.u.roles.includes(b.kind))throw new E(403,"Tipo inválido para o seu perfil");
 const items=(await q("select id from checklist_items where kind=$1",[b.kind])).rows.map(r=>r.id),dec=new Set((b.declared||[]).map(Number));
 if(!b.document_no||items.some(i=>!dec.has(i)))throw new E(400,"Informe o documento e declare todos os itens");
 const id=await tx(async c=>{const g=one(await c.query("insert into registrations(user_id,kind,document_no,food_handling_course,dish_categories,delivery_method,packaging_type,vehicle_plate,media_url,status,requested_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',now()) returning id",[req.u.id,b.kind,b.document_no,!!b.food_handling_course,b.dish_categories,b.delivery_method,b.packaging_type,b.vehicle_plate,b.media_url]));
  for(const i of items)await c.query("insert into registration_checks(registration_id,item_id,declared) values($1,$2,true)",[g.id,i]);return g.id});res.status(201).json({id})}));
app.get("/inspections",A,need("inspector"),ah(async(req,res)=>res.json((await q("select r.*,(select json_agg(json_build_object('id',ci.id,'label',ci.label,'confirmed',rc.confirmed_by_inspector)) from registration_checks rc join checklist_items ci on ci.id=rc.item_id where rc.registration_id=r.id) checks from registrations r where status='pending' order by requested_at")).rows)));
app.post("/inspections/:id/review",A,need("inspector"),ah(async(req,res)=>{const{approve,confirmed=[],reason}=req.body,id=req.params.id;
 await tx(async c=>{const g=one(await c.query("select * from registrations where id=$1 and status='pending' for update",[id]));if(!g)throw new E(404,"Solicitação não encontrada");if(g.user_id==req.u.id)throw new E(403,"Não é possível aprovar o próprio registro");
  if(approve){const tot=one(await c.query("select count(*)::int n from checklist_items where kind=$1",[g.kind])).n;
   const r=await c.query("update registration_checks set confirmed_by_inspector=true where registration_id=$1 and item_id=any($2::int[])",[id,[...new Set(confirmed.map(Number))]]);
   if(r.rowCount<tot)throw new E(400,"Confirme todos os itens do checklist");
   await c.query("update registrations set status='approved',reviewed_by=$2,reviewed_at=now(),permit_no=$3,valid_until=current_date+interval '1 year' where id=$1",[id,req.u.id,(g.kind=="cook"?"PRP-":"ENT-")+crypto.randomInt(10000,99999)])}
  else await c.query("update registrations set status='rejected',reviewed_by=$2,reviewed_at=now(),reject_reason=$3 where id=$1",[id,req.u.id,reason||"Sem motivo informado"]);
  await au(c,req.u.id,approve?"permit.approve":"permit.reject","registration",id)});res.json({ok:true})}));

// ===== PEDIDOS =====
app.post("/orders",A,need("client"),ah(async(req,res)=>{const id=await tx(async c=>{const o=one(await c.query("insert into orders(client_id,recipe_id,variation_id,preferred_cook,notes) values($1,$2,$3,$4,$5) returning id",[req.u.id,req.body.recipe_id,req.body.variation_id||null,req.body.preferred_cook||null,req.body.notes]));
 for(const k of["pickup","delivery"])await c.query("insert into handoff_codes(order_id,kind,code_hash) values($1,$2,$3)",[o.id,k,sha(mkcode(o.id,k))]);await hist(c,o.id,"requested",req.u.id);return o.id});res.status(201).json({id})}));
app.get("/orders",A,ah(async(req,res)=>{const a=req.query.as;if(!req.u.is_root&&!req.u.roles.includes(a))throw new E(403,"Papel inválido");
 const w={client:"client_id=$1",cook:"(status='requested' or cook_id=$1)",courier:"(status='ready' or courier_id=$1)"}[a];if(!w)throw new E(400,"as=client|cook|courier");
 res.json((await q(`select o.*,r.title from orders o join recipes r on r.id=o.recipe_id where ${w} order by o.created_at desc limit 100`,[req.u.id])).rows)}));
const accept=kind=>[A,need(kind),ah(async(req,res)=>{const p=Number(req.body.price);if(!(p>0))throw new E(400,"Informe um preço maior que zero");await permit(req.u.id,kind);
 await tx(async c=>{const o=one(await c.query("select * from orders where id=$1 for update",[req.params.id]));if(!o)throw new E(404,"Pedido não encontrado");if(o.status!=(kind=="cook"?"requested":"ready"))throw new E(409,"Pedido indisponível");
  if(!(await c.query("update wallets set credits=credits-$1 where user_id=$2 and credits>=$1",[p,o.client_id])).rowCount)throw new E(402,"Cliente sem créditos suficientes");
  await c.query("insert into escrow_holds(order_id,payer,payee,amount) values($1,$2,$3,$4)",[o.id,o.client_id,req.u.id,p]);await c.query("insert into ledger(user_id,kind,amount,ref_order,memo) values($1,'escrow_hold',$2,$3,$4)",[o.client_id,-p,o.id,kind]);
  const st=kind=="cook"?"cooking":"pickup";await c.query(kind=="cook"?"update orders set cook_id=$2,cook_price=$3,status=$4 where id=$1":"update orders set courier_id=$2,courier_price=$3,status=$4 where id=$1",[o.id,req.u.id,p,st]);await hist(c,o.id,st,req.u.id)});res.json({ok:true})})];
app.post("/orders/:id/accept-cook",...accept("cook"));app.post("/orders/:id/accept-courier",...accept("courier"));
app.put("/orders/:id/packaging",A,need("client"),ah(async(req,res)=>{const{container,instructions,slots=[]}=req.body;
 await tx(async c=>{const o=one(await c.query("select * from orders where id=$1 and client_id=$2 for update",[req.params.id,req.u.id]));if(!o||!["requested","cooking"].includes(o.status))throw new E(409,"Embalagem não editável");
  await c.query("insert into order_packaging(order_id,container,instructions) values($1,$2,$3) on conflict(order_id) do update set container=$2,instructions=$3",[o.id,container,instructions]);await c.query("delete from packaging_slots where order_id=$1",[o.id]);
  for(const s of slots)await c.query("insert into packaging_slots(order_id,slot_name,item_label,is_drink) values($1,$2,$3,$4)",[o.id,s.slot_name,s.item_label,!!s.is_drink])});res.json({ok:true})}));
app.post("/orders/:id/ready",A,need("cook"),ah(async(req,res)=>{await tx(async c=>{const o=one(await c.query("update orders set status='ready' where id=$1 and cook_id=$2 and status='cooking' returning id",[req.params.id,req.u.id]));if(!o)throw new E(409,"Pedido não está em preparo");
 await c.query("update order_packaging set locked=true where order_id=$1",[o.id]);await hist(c,o.id,"ready",req.u.id)});res.json({ok:true})}));
app.get("/orders/:id/codes",A,ah(async(req,res)=>{const o=one(await q("select * from orders where id=$1",[req.params.id]));if(!o)throw new E(404,"Pedido não encontrado");
 const kind=o.client_id==req.u.id&&o.status=="in_route"?"delivery":o.cook_id==req.u.id&&["ready","pickup"].includes(o.status)?"pickup":null;if(!kind)throw new E(403,"Código indisponível agora");
 const c=mkcode(o.id,kind);res.json({kind,code:c,qr:`GUSTO|${kind=="delivery"?"ENTREGA":"COLETA"}|${o.id}|${c}`})}));
app.post("/orders/:id/scan",A,need("courier"),ah(async(req,res)=>{const kind=req.body.kind,sub=String(req.body.code||"").split("|").pop().trim();if(!["pickup","delivery"].includes(kind))throw new E(400,"kind inválido");
 const hc=one(await q("update handoff_codes set attempts=attempts+1 where order_id=$1 and kind=$2 and attempts<5 and validated_at is null returning *",[req.params.id,kind]));if(!hc)throw new E(429,"Código bloqueado ou já utilizado"); // tentativa contada fora da transação
 if(!crypto.timingSafeEqual(Buffer.from(sha(sub)),Buffer.from(hc.code_hash)))throw new E(400,"Código incorreto");
 await tx(async c=>{const o=one(await c.query("select * from orders where id=$1 for update",[req.params.id]));if(o.courier_id!=req.u.id)throw new E(403,"Pedido não é seu");if(o.status!=(kind=="pickup"?"pickup":"in_route"))throw new E(409,"Etapa incorreta");
  await c.query("update handoff_codes set validated_at=now(),validated_by=$3 where order_id=$1 and kind=$2",[o.id,kind,req.u.id]);const st=kind=="pickup"?"in_route":"delivered";await c.query("update orders set status=$2 where id=$1",[o.id,st]);await hist(c,o.id,st,req.u.id);
  if(st=="delivered"){const f=await fee(c);for(const h of(await c.query("update escrow_holds set released=true,released_at=now() where order_id=$1 and not released returning *",[o.id])).rows){const amt=Number(h.amount),fe=+(amt*f).toFixed(2),net=+(amt-fe).toFixed(2);
   await c.query("update wallets set credits=credits+$1 where user_id=$2",[net,h.payee]);await c.query("insert into ledger(user_id,kind,amount,ref_order) values($1,'escrow_release',$2,$4),(null,'fee',$3,$4)",[h.payee,net,fe,o.id])}}});res.json({ok:true})}));

// ===== CARTEIRA E CORRETORA =====
app.get("/wallet",A,ah(async(req,res)=>res.json({wallet:one(await q("select credits,brl from wallets where user_id=$1",[req.u.id])),ledger:(await q("select kind,amount,memo,at from ledger where user_id=$1 order by id desc limit 50",[req.u.id])).rows})));
app.get("/market",A,feat("mk"),ah(async(req,res)=>res.json((await q("select id,seller,qty,price_brl,created_at from market_offers where open order by price_brl")).rows)));
app.post("/market/offers",A,feat("mk"),ah(async(req,res)=>{const qty=Number(req.body.qty),p=Number(req.body.price_brl);if(!(qty>0&&p>0))throw new E(400,"Dados inválidos");
 const id=await tx(async c=>{if(!(await c.query("update wallets set credits=credits-$1 where user_id=$2 and credits>=$1",[qty,req.u.id])).rowCount)throw new E(402,"Créditos insuficientes");
  await c.query("insert into ledger(user_id,kind,amount,memo) values($1,'market_sell',$2,'oferta')",[req.u.id,-qty]);return one(await c.query("insert into market_offers(seller,qty,price_brl) values($1,$2,$3) returning id",[req.u.id,qty,p])).id});res.status(201).json({id})}));
app.post("/market/offers/:id/buy",A,feat("mk"),ah(async(req,res)=>{await tx(async c=>{const o=one(await c.query("select * from market_offers where id=$1 and open for update",[req.params.id]));if(!o||o.seller==req.u.id)throw new E(409,"Oferta indisponível");
 const cost=+(o.qty*o.price_brl).toFixed(2),f=await fee(c),fe=+(cost*f).toFixed(2);
 if(!(await c.query("update wallets set brl=brl-$1 where user_id=$2 and brl>=$1",[cost,req.u.id])).rowCount)throw new E(402,"Saldo em R$ insuficiente");
 await c.query("update wallets set brl=brl+$1 where user_id=$2",[cost-fe,o.seller]);await c.query("update wallets set credits=credits+$1 where user_id=$2",[o.qty,req.u.id]);
 await c.query("update market_offers set open=false where id=$1",[o.id]);await c.query("insert into market_trades(offer_id,buyer,qty,price_brl,fee_brl) values($1,$2,$3,$4,$5)",[o.id,req.u.id,o.qty,o.price_brl,fe]);
 await c.query("insert into ledger(user_id,kind,amount,memo) values($1,'market_buy',$2,'compra')",[req.u.id,o.qty])});res.json({ok:true})}));

// ===== FEED =====
app.get("/posts",A,feat("feed"),ah(async(req,res)=>res.json((await q("select p.*,u.display_name,(select coalesce(json_agg(json_build_object('author',cu.display_name,'body',c.body) order by c.created_at),'[]') from comments c join users cu on cu.id=c.author_id where c.post_id=p.id) comments from posts p join users u on u.id=p.author_id order by p.created_at desc limit 50")).rows)));
app.post("/posts",A,feat("feed"),ah(async(req,res)=>{if(!req.body.body)throw new E(400,"Texto obrigatório");const id=one(await q("insert into posts(author_id,body,media_url,recipe_id,order_id) values($1,$2,$3,$4,$5) returning id",[req.u.id,req.body.body,/^https?:\/\//.test(req.body.media_url||"")?req.body.media_url:null,req.body.recipe_id||null,req.body.order_id||null])).id;res.status(201).json({id})}));
app.post("/posts/:id/comments",A,feat("feed"),ah(async(req,res)=>{if(!req.body.body)throw new E(400,"Texto obrigatório");await q("insert into comments(post_id,author_id,body) values($1,$2,$3)",[req.params.id,req.u.id,req.body.body]);res.status(201).json({ok:true})}));

// ===== PAGAMENTOS POR LINK: criação (autenticado) e página pública =====
app.post("/payment-links",A,feat("paylink"),ah(async(req,res)=>{const b=req.body;if(!["topup","charge","credits"].includes(b.purpose))throw new E(400,"purpose inválido");
 let amt=Number(b.amount_brl),cr=null;if(b.purpose=="credits"){cr=Number(b.credits);if(!(cr>0))throw new E(400,"Informe os créditos");amt=+(cr*await price("credit_rate_brl")).toFixed(2)}
 if(!(amt>=1&&amt<=10000))throw new E(400,"Valor entre R$ 1 e R$ 10.000");
 const t=crypto.randomBytes(24).toString("base64url"),hrs=Math.min(Math.max(Number(b.expires_hours)||48,1),720);
 const l=one(await q("insert into payment_links(token_hash,creator,purpose,amount_brl,credits,description,order_id,expires_at,provider) values($1,$2,$3,$4,$5,$6,$7,now()+make_interval(hours=>$8::int),$9) returning id,expires_at",[sha(t),req.u.id,b.purpose,amt,cr,String(b.description||"").slice(0,140),b.order_id||null,hrs,PV.name]));
 await au(pool,req.u.id,"paylink.create","payment_link",l.id,{purpose:b.purpose,amt});res.status(201).json({id:l.id,url:`${process.env.PUBLIC_URL||""}/pay/${t}`,amount_brl:amt,expires_at:l.expires_at})})); // o token só aparece aqui
app.get("/payment-links",A,ah(async(req,res)=>res.json((await q("select id,purpose,amount_brl,credits,description,status,expires_at,paid_at from payment_links where creator=$1 order by created_at desc limit 100",[req.u.id])).rows)));
app.post("/payment-links/:id/cancel",A,ah(async(req,res)=>{const r=await q("update payment_links set status='cancelled' where id=$1 and creator=$2 and status='open'",[req.params.id,req.u.id]);if(!r.rowCount)throw new E(409,"Só links abertos e sem cobrança iniciada podem ser cancelados");res.json({ok:true})}));
const page=b=>`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Gusto · Pagamento</title><style>body{font:16px system-ui;margin:0;background:#fff8f0;color:#2b2118;display:grid;place-items:center;min-height:100vh}main{background:#fff;border:1px solid #f0e0d0;border-radius:16px;padding:24px;max-width:380px;width:92%}a.b{display:block;text-align:center;background:#e8590c;color:#fff;border-radius:999px;padding:12px;text-decoration:none;margin-top:16px}code{word-break:break-all;display:block;background:#f6ece0;padding:8px;border-radius:8px}@media(prefers-color-scheme:dark){body{background:#1c1612;color:#f5ebe0}main{background:#2a211b;border-color:#3d3028}code{background:#3d3028}}</style><main>${b}</main>`;
const byTok=async t=>{const l=one(await q("select pl.*,u.display_name from payment_links pl join users u on u.id=pl.creator where token_hash=$1",[sha(String(t))]));if(l&&l.status=="open"&&l.expires_at<new Date()){await q("update payment_links set status='expired' where id=$1 and status='open'",[l.id]);l.status="expired"}return l};
const pub=rateLimit({windowMs:60000,max:60});
app.get("/pay/:token",pub,ah(async(req,res)=>{const l=await byTok(req.params.token);if(!l)return res.status(404).send(page("<h2>Link inválido</h2>"));
 const m={paid:"✅ Pagamento confirmado. Obrigado!",expired:"⌛ Este link expirou.",cancelled:"🚫 Este link foi cancelado."}[l.status];
 res.send(page(`<h2>Gusto · cobrança</h2><p>${esc(l.display_name)}${l.description?": "+esc(l.description):""}</p><p style="font-size:28px;font-weight:700">R$ ${Number(l.amount_brl).toFixed(2).replace(".",",")}</p>${m?`<p>${m}</p>`:`<a class="b" href="/pay/${esc(encodeURIComponent(req.params.token))}/go">Pagar agora</a>`}`))}));
app.get("/pay/:token/go",pub,ah(async(req,res)=>{let l=await byTok(req.params.token);if(!l||!["open","processing"].includes(l.status))return res.redirect("/pay/"+encodeURIComponent(req.params.token));
 if(!l.provider_ref){const ch=await PV.charge(l);l=one(await q("update payment_links set provider_ref=$2,pay_url=$3,pix_code=$4,status='processing' where id=$1 and provider_ref is null returning *",[l.id,ch.ref,ch.pay_url||null,ch.pix_code||null]))||await byTok(req.params.token)}
 if(l.pay_url&&/^https:\/\//.test(l.pay_url))return res.redirect(l.pay_url);
 res.send(page(`<h2>Pague com Pix</h2><p>Copie o código no app do seu banco:</p><code>${esc(l.pix_code)}</code><p>A confirmação é automática.</p>`))}));
if(NODE_ENV!="production")app.post("/dev/mock-pay/:id",A,root,ah(async(req,res)=>{const l=one(await q("select * from payment_links where id=$1",[req.params.id]));if(!l?.provider_ref)throw new E(409,"Abra /pay/<token>/go antes");
 await applyEvent("mock",{id:"dev_"+crypto.randomUUID(),type:"payment.paid",external_reference:l.id,provider_ref:l.provider_ref,amount:Number(l.amount_brl)});res.json({ok:true})}));
// ===== IA (experimento), PROVA DE CONCEITO E CALENDÁRIO =====
app.post("/recipes/experiment",A,feat("ai"),ah(async(req,res)=>{const b=req.body;if(!b.title)throw new E(400,"Título obrigatório");
 const id=await tx(async c=>{const r=one(await c.query("insert into recipes(author_id,title,origin,health_notes,prep_minutes,kcal,protein_g,carb_g,fat_g,packaging_note,is_ai,ai_prompt,steps,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,'experiment') returning id",[req.u.id,b.title,b.origin,b.health_notes,b.prep_minutes,b.kcal,b.protein_g,b.carb_g,b.fat_g,b.packaging_note,String(b.ai_prompt||"").slice(0,500),JSON.stringify(b.steps||[])]));
  for(const n of b.ingredients||[]){const i=one(await c.query("insert into ingredients(name) values($1) on conflict(name) do update set name=excluded.name returning id",[String(n).trim().toLowerCase()]));await c.query("insert into recipe_ingredients(recipe_id,ingredient_id) values($1,$2) on conflict do nothing",[r.id,i.id])}
  for(const v of b.variations||[])await c.query("insert into recipe_variations(recipe_id,name,change_note) values($1,$2,$3)",[r.id,v.name,v.change_note]);return r.id});res.status(201).json({id})}));
app.post("/orders/:id/feedback",A,need("client"),ah(async(req,res)=>{const n=Number(req.body.rating);if(!(n>=1&&n<=5))throw new E(400,"Nota de 1 a 5");
 await tx(async c=>{const o=one(await c.query("select recipe_id from orders where id=$1 and client_id=$2 and status='delivered'",[req.params.id,req.u.id]));if(!o)throw new E(409,"Só pedidos entregues podem ser avaliados");
  await c.query("insert into recipe_feedback(recipe_id,order_id,user_id,rating,comment,evidence_url) values($1,$2,$3,$4,$5,$6)",[o.recipe_id,req.params.id,req.u.id,Math.round(n),String(req.body.comment||"").slice(0,500),/^https?:\/\//.test(req.body.evidence_url||"")?req.body.evidence_url:null])});res.status(201).json({ok:true})}));
app.get("/recipes/:id/feedback",A,ah(async(req,res)=>res.json((await q("select rating,comment,evidence_url,created_at from recipe_feedback where recipe_id=$1 order by created_at desc",[req.params.id])).rows)));
const TZ="America/Sao_Paulo",TS=`($4::date+coalesce($5::time,(now() at time zone '${TZ}')::time)) at time zone '${TZ}'`;
const cdt=b=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||""))throw new E(400,"Data inválida");const t=/^\d{2}:\d{2}$/.test(b.time||"")?b.time:null;return[b.date,t,t?(b.source=="drop"?"drop":"selected"):"request_time"]}; // sem hora = hora da solicitação
app.post("/calendar",A,feat("calendar"),ah(async(req,res)=>{const b=req.body;if(!b.recipe_id&&!b.order_id)throw new E(400,"Informe recipe_id ou order_id");const[d,t,src]=cdt(b);
 res.status(201).json(one(await q(`insert into calendar_entries(user_id,recipe_id,order_id,starts_at,time_source) values($1,$2,$3,${TS},$6) returning id,starts_at`,[req.u.id,b.recipe_id||null,b.order_id||null,d,t,src])))}));
app.get("/calendar",A,feat("calendar"),ah(async(req,res)=>res.json((await q("select id,recipe_id,order_id,starts_at,time_source from calendar_entries where user_id=$1 and starts_at>=coalesce($2::timestamptz,now()-interval '7 days') and starts_at<coalesce($3::timestamptz,now()+interval '60 days') order by starts_at",[req.u.id,req.query.from||null,req.query.to||null])).rows)));
app.patch("/calendar/:id",A,feat("calendar"),ah(async(req,res)=>{const[d,t,src]=cdt(req.body);const r=await q(`update calendar_entries set starts_at=${TS.replace("$4","$2").replace("$5","$3")},time_source=$5 where id=$1 and user_id=$4`,[req.params.id,d,t,req.u.id,src]);if(!r.rowCount)throw new E(404,"Entrada não encontrada");res.json({ok:true})}));
app.delete("/calendar/:id",A,feat("calendar"),ah(async(req,res)=>{await q("delete from calendar_entries where id=$1 and user_id=$2",[req.params.id,req.u.id]);res.json({ok:true})}));
app.get("/health",(req,res)=>res.json({ok:true}));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)),"public"),{maxAge:"1h"}));
app.use((e,req,res,next)=>{if(!e.s&&e.code!="23505")console.error(e);const s=e.s||(e.code=="23505"?409:500);res.status(s).json({error:e.s?e.message:e.code=="23505"?"Registro duplicado":"Erro interno"})});
app.listen(PORT,process.env.HOST||"127.0.0.1",()=>console.log("Gusto na porta "+PORT));
