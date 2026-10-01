import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const HAS_NEW_SECRET_KEY = Boolean(Deno.env.get("SUPABASE_SECRET_KEYS"));
const SERVICE_KEY = (() => {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
    const parsed = JSON.parse(raw);
    if (parsed?.default) return String(parsed.default);
  } catch {}
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
})();

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_IDS = (Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") ?? "")
  .split(",").map(v => v.trim()).filter(Boolean);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-azim-internal-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"content-type":"application/json; charset=utf-8", ...cors},
  });
}
function clean(v: unknown, max = 3000) { return String(v ?? "").trim().slice(0, max) || "—"; }
function adminHeaders(extra: Record<string,string>={}) {
  return {apikey:SERVICE_KEY, ...(HAS_NEW_SECRET_KEY ? {} : {Authorization:"Bearer "+SERVICE_KEY}), ...extra};
}
async function rest(path:string, init:RequestInit={}) {
  const r=await fetch(SUPABASE_URL+path,{...init,headers:adminHeaders((init.headers??{}) as Record<string,string>)});
  const body=await r.json().catch(()=>null);
  return {r,body};
}
async function rpc(name:string,payload:Record<string,unknown>) {
  const q=await rest("/rest/v1/rpc/"+name,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  if(!q.r.ok) throw new Error("RPC_FAILED:"+name);
  return q.body;
}
async function secret(name:string) {
  return String(await rpc("azim_notification_get_secret",{p_name:name}) ?? "");
}
async function sendTelegram(chatId:string,text:string) {
  const res=await fetch("https://api.telegram.org/bot"+BOT_TOKEN+"/sendMessage",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:chatId,text}),
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) throw new Error(clean(data?.description ?? "Telegram API error",500));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return response({ok:false,error:"METHOD_NOT_ALLOWED"},405);

  try{
    if(!BOT_TOKEN || !ADMIN_IDS.length){
      return response({ok:false,error:"Telegram notification secrets are not configured"},503);
    }
    const expected=await secret("azim_notification_internal_token");
    const provided=String(req.headers.get("x-azim-internal-token")??"");
    if(!expected || !provided || provided!==expected){
      return response({ok:false,error:"UNAUTHORIZED"},401);
    }

    const b=await req.json();
    const msg=
      "🔔 درخواست مشاوره جدید — عظیم ابزار\n\n"+
      "👤 نام: "+clean(b.full_name,120)+"\n"+
      "📱 موبایل: "+clean(b.mobile,60)+"\n"+
      "✉️ ایمیل: "+clean(b.email,180)+"\n"+
      "📌 موضوع: "+clean(b.subject,180)+"\n"+
      "🏭 کارگاه / زمینه کاری: "+clean(b.business,180)+"\n"+
      (b.product_id ? "🧰 محصول مرتبط: "+clean(b.product_id,100)+"\n" : "")+
      "\n🛠 شرح درخواست:\n"+clean(b.details)+ "\n\n"+
      "🕐 زمان ثبت: "+new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date());

    const results=await Promise.allSettled(ADMIN_IDS.map(id=>sendTelegram(id,msg)));
    const failed=results.filter(x=>x.status==="rejected").length;
    if(failed===results.length) throw new Error("ارسال به تلگرام ناموفق بود");

    return response({ok:true,sent:results.length-failed,failed});
  }catch(e){
    return response({ok:false,error:clean((e as any)?.message??e,800)},500);
  }
});