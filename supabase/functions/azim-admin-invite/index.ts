import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=String(Deno.env.get("SUPABASE_URL")??"").replace(/\/+$/,"");
const SUPABASE_ANON_KEY=String(Deno.env.get("SUPABASE_ANON_KEY")??"");
const SERVICE_KEY=(()=>{try{const x=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}");if(x?.default)return String(x.default)}catch{}return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"")})();
const SITE_URL=String(Deno.env.get("AZIM_PUBLIC_SITE_URL")??"").replace(/\/+$/,"");

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8"}});}
function bearer(req:Request){const h=req.headers.get("authorization")??"";return h.replace(/^Bearer\s+/i,"").trim();}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers);h.set("apikey",SERVICE_KEY);h.set("Authorization","Bearer "+SERVICE_KEY);const r=await fetch(SUPABASE_URL+path,{...init,headers:h});const body=await r.json().catch(()=>null);return {r,body};}
async function authUser(token:string){const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+token}});const u=await r.json().catch(()=>null);return r.ok&&u?.id?u:null;}
function decode(token:string){try{const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(p+"=".repeat((4-p.length%4)%4)))}catch{return {}}}
async function caller(req:Request){
 const token=bearer(req); if(!token) throw new Error("AUTH_REQUIRED");
 const user=await authUser(token); if(!user) throw new Error("AUTH_INVALID");
 const claims=decode(token); if(String(claims?.aal??"aal1")!=="aal2") throw new Error("MFA_REQUIRED");
 const {r,body}=await rest("/rest/v1/admin_users?select=role,is_active&user_id=eq."+encodeURIComponent(user.id)+"&is_active=eq.true&limit=1");
 const row=r.ok&&Array.isArray(body)?body[0]:null;
 if(!row||!["owner","admin"].includes(String(row.role))) throw new Error("ADMIN_REQUIRED");
 return {user,role:String(row.role)};
}
Deno.serve(async req=>{
 if(req.method!=="POST") return json({ok:false,error:"Method not allowed"},405);
 try{
  if(!SUPABASE_URL||!SERVICE_KEY||!SUPABASE_ANON_KEY) return json({ok:false,error:"Server configuration error"},500);
  const c=await caller(req);
  const body=await req.json().catch(()=>({}));
  const email=String(body?.email??"").trim().toLowerCase();
  const role=String(body?.role??"sales").trim().toLowerCase();
  const name=String(body?.name??"").trim().slice(0,120);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ok:false,error:"EMAIL_INVALID"},400);
  if(!["admin","editor","sales"].includes(role)) return json({ok:false,error:"ROLE_INVALID"},400);
  if(c.role!=="owner"&&role==="admin") return json({ok:false,error:"ONLY_OWNER_CAN_INVITE_ADMIN"},403);

  const invite=await rest("/auth/v1/admin/generate_link",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({type:"invite",email,options:{data:{azim_role:role,name},redirectTo:SITE_URL?SITE_URL+"/admin.html":"admin.html"}})
  });
  if(!invite.r.ok){
    return json({ok:false,error:"INVITE_FAILED",detail:String(invite.body?.msg??invite.body?.message??invite.body?.error??"")},400);
  }
  const user=invite.body?.user??invite.body?.properties?.user??null;
  const userId=String(user?.id??"");
  if(!userId) return json({ok:false,error:"INVITE_USER_MISSING"},500);

  const existing=await rest("/rest/v1/admin_users?select=user_id&user_id=eq."+encodeURIComponent(userId)+"&limit=1");
  if(existing.r.ok && Array.isArray(existing.body) && existing.body.length){
    return json({ok:false,error:"ADMIN_RECORD_EXISTS"},409);
  }

  const ins=await rest("/rest/v1/admin_users",{
    method:"POST",
    headers:{"content-type":"application/json","Prefer":"return=minimal"},
    body:JSON.stringify({user_id:userId,role,is_active:true})
  });
  if(!ins.r.ok){
    await rest("/auth/v1/admin/users/"+encodeURIComponent(userId),{method:"DELETE"});
    return json({ok:false,error:"ADMIN_RECORD_CREATE_FAILED"},500);
  }
  await rest("/rest/v1/audit_logs",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({actor_id:c.user.id,action:"admin_invite",entity:"admin_users",entity_id:userId,metadata:{email,role}})
  });
  return json({ok:true,user_id:userId,email,role});
 }catch(e){
  const error=String((e as Error)?.message??e);
  const status=["AUTH_REQUIRED","AUTH_INVALID","MFA_REQUIRED","ADMIN_REQUIRED"].includes(error)?401:500;
  return json({ok:false,error},status);
 }
});