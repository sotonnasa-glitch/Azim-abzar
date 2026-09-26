import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_IDS = (Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") ?? "").split(",").map(v => v.trim()).filter(Boolean);
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};

async function sendTelegram(chatId: string, text: string) {
  const res = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,text})});
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) throw new Error(data.description ?? "Telegram API error");
}
function clean(v: unknown,max=3000){return String(v??"").trim().slice(0,max)||"—";}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return new Response("method not allowed",{status:405,headers:cors});
  if(!BOT_TOKEN || !ADMIN_IDS.length) return new Response(JSON.stringify({ok:false,error:"Telegram notification secrets are not configured"}),{status:503,headers:{"content-type":"application/json",...cors}});
  try{
    const b=await req.json();
    const msg="🔔 درخواست مشاوره جدید — عظیم ابزار\n\n👤 نام: "+clean(b.full_name,120)+"\n📱 موبایل: "+clean(b.mobile,60)+"\n📌 موضوع: "+clean(b.subject,180)+"\n🏭 کارگاه / زمینه کاری: "+clean(b.business,180)+"\n\n🛠 شرح درخواست:\n"+clean(b.details)+"\n\n🕐 زمان ثبت: "+new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date());
    const results=await Promise.allSettled(ADMIN_IDS.map(id=>sendTelegram(id,msg)));
    const failed=results.filter(x=>x.status==="rejected").length;
    if(failed===results.length) throw new Error("ارسال به تلگرام ناموفق بود");
    return new Response(JSON.stringify({ok:true,sent:results.length-failed,failed}),{status:200,headers:{"content-type":"application/json",...cors}});
  }catch(e){return new Response(JSON.stringify({ok:false,error:String(e?.message??e)}),{status:500,headers:{"content-type":"application/json",...cors}});}
});