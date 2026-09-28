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

const EVENT_LABELS: Record<string,string> = {
  order_created:"ثبت سفارش",
  payment_paid:"پرداخت موفق",
  payment_failed:"پرداخت ناموفق",
  order_confirmed:"تأیید سفارش",
  order_processing:"شروع پردازش",
  order_shipped:"ارسال سفارش",
  order_delivered:"تحویل سفارش",
  order_cancelled:"لغو سفارش",
  return_requested:"ثبت مرجوعی",
  return_approved:"تأیید مرجوعی",
  return_rejected:"رد مرجوعی",
  refund_paid:"استرداد وجه"
};

const DEFAULT_EVENTS: Record<string,boolean> = {
  order_created:true,payment_paid:true,payment_failed:true,order_confirmed:true,
  order_processing:false,order_shipped:true,order_delivered:true,order_cancelled:true,
  return_requested:true,return_approved:true,return_rejected:true,refund_paid:true
};

const DEFAULT_SMS: Record<string,string> = {
  order_created:"عظیم ابزار | سفارش {{order_code}} ثبت شد. مبلغ: {{total}} تومان.",
  payment_paid:"عظیم ابزار | پرداخت سفارش {{order_code}} با موفقیت انجام شد.",
  payment_failed:"عظیم ابزار | پرداخت سفارش {{order_code}} ناموفق بود. در صورت نیاز دوباره تلاش کنید.",
  order_confirmed:"عظیم ابزار | سفارش {{order_code}} تأیید شد.",
  order_processing:"عظیم ابزار | سفارش {{order_code}} در حال پردازش است.",
  order_shipped:"عظیم ابزار | سفارش {{order_code}} ارسال شد. کد رهگیری: {{tracking_code}}",
  order_delivered:"عظیم ابزار | سفارش {{order_code}} تحویل شد.",
  order_cancelled:"عظیم ابزار | سفارش {{order_code}} لغو شد.",
  return_requested:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} ثبت شد.",
  return_approved:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید شد.",
  return_rejected:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید نشد.",
  refund_paid:"عظیم ابزار | مبلغ مرجوعی سفارش {{order_code}} ثبت و برای استرداد آماده شد."
};

const DEFAULT_EMAIL: Record<string,string> = {
  order_created:"سفارش {{order_code}} شما در عظیم ابزار ثبت شد. مبلغ سفارش: {{total}} تومان.",
  payment_paid:"پرداخت سفارش {{order_code}} شما با موفقیت ثبت شد.",
  payment_failed:"پرداخت سفارش {{order_code}} موفق نشد. در صورت نیاز دوباره تلاش کنید.",
  order_confirmed:"سفارش {{order_code}} شما در عظیم ابزار تأیید شد.",
  order_processing:"سفارش {{order_code}} شما در حال پردازش است.",
  order_shipped:"سفارش {{order_code}} شما ارسال شد. کد رهگیری: {{tracking_code}}.",
  order_delivered:"سفارش {{order_code}} شما تحویل شد.",
  order_cancelled:"سفارش {{order_code}} لغو شد.",
  return_requested:"درخواست مرجوعی سفارش {{order_code}} ثبت شد.",
  return_approved:"درخواست مرجوعی سفارش {{order_code}} تأیید شد.",
  return_rejected:"درخواست مرجوعی سفارش {{order_code}} رد شد.",
  refund_paid:"وضعیت استرداد مبلغ سفارش {{order_code}} به‌روزرسانی شد."
};

const DEFAULT_SUBJECTS: Record<string,string> = {
  order_created:"ثبت سفارش {{order_code}} | عظیم ابزار",
  payment_paid:"پرداخت موفق سفارش {{order_code}} | عظیم ابزار",
  payment_failed:"پرداخت ناموفق سفارش {{order_code}} | عظیم ابزار",
  order_confirmed:"تأیید سفارش {{order_code}} | عظیم ابزار",
  order_processing:"در حال پردازش سفارش {{order_code}} | عظیم ابزار",
  order_shipped:"ارسال سفارش {{order_code}} | عظیم ابزار",
  order_delivered:"تحویل سفارش {{order_code}} | عظیم ابزار",
  order_cancelled:"لغو سفارش {{order_code}} | عظیم ابزار",
  return_requested:"ثبت درخواست مرجوعی {{order_code}} | عظیم ابزار",
  return_approved:"تأیید مرجوعی {{order_code}} | عظیم ابزار",
  return_rejected:"وضعیت مرجوعی {{order_code}} | عظیم ابزار",
  refund_paid:"وضعیت استرداد {{order_code}} | عظیم ابزار"
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8"}});
}
function clean(v:unknown,max=2000){return String(v??"").trim().slice(0,max);}
function adminHeaders(extra:Record<string,string>={}){return{apikey:SERVICE_KEY,...(HAS_NEW_SECRET_KEY?{}:{Authorization:"Bearer "+SERVICE_KEY}),...extra};}
async function rest(path:string,init:RequestInit={}){
  const r=await fetch(SUPABASE_URL+path,{...init,headers:adminHeaders((init.headers??{}) as Record<string,string>)});
  const body=await r.json().catch(()=>null);
  return{r,body};
}
async function rpc(name:string,payload:Record<string,unknown>){
  const q=await rest("/rest/v1/rpc/"+name,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  if(!q.r.ok) throw new Error("RPC_FAILED:"+name);
  return q.body;
}
async function secret(name:string){return String(await rpc("azim_notification_get_secret",{p_name:name})??"");}
async function settings(){
  const q=await rest("/rest/v1/notification_settings?select=*&id=eq.true&limit=1");
  const row=Array.isArray(q.body)?q.body[0]:null;
  return row?{
    ...row,
    events:{...DEFAULT_EVENTS,...(row.events&&typeof row.events==="object"?row.events:{})},
    templates:{
      sms:{...DEFAULT_SMS,...(row.templates?.sms&&typeof row.templates.sms==="object"?row.templates.sms:{})},
      email:{...DEFAULT_EMAIL,...(row.templates?.email&&typeof row.templates.email==="object"?row.templates.email:{})}
    },
    email_subjects:{...DEFAULT_SUBJECTS,...(row.email_subjects&&typeof row.email_subjects==="object"?row.email_subjects:{})}
  }:{
    sms_enabled:false,sms_provider:"kavenegar",sms_sender:"",
    email_enabled:false,email_provider:"resend",email_from:"",
    events:DEFAULT_EVENTS,templates:{sms:DEFAULT_SMS,email:DEFAULT_EMAIL},email_subjects:DEFAULT_SUBJECTS
  };
}
function maskRecipient(v:string){
  const x=clean(v,200);
  if(x.includes("@")) return x.replace(/^(.).+(@.+)$/,"$1***$2");
  return x.length>=7?x.slice(0,4)+"****"+x.slice(-3):"****";
}
function changed(old:any,next:any,key:string){
  if(!old) return true;
  return String(old?.[key]??"")!==String(next?.[key]??"");
}
function became(old:any,next:any,key:string,values:string[]){
  const n=String(next?.[key]??"");
  const o=String(old?.[key]??"");
  return values.includes(n)&&o!==n;
}
function orderEvents(record:any,old:any){
  const out:string[]=[];
  if(!old) out.push("order_created");
  if(changed(old,record,"payment_status")&&String(record.payment_status)==="paid") out.push("payment_paid");
  if(changed(old,record,"payment_status")&&String(record.payment_status)==="failed") out.push("payment_failed");
  if(became(old,record,"status",["confirmed"])) out.push("order_confirmed");
  if(became(old,record,"status",["processing"])) out.push("order_processing");
  if(
    became(old,record,"status",["shipped"]) ||
    became(old,record,"shipping_status",["shipped"]) ||
    (!old?.tracking_code && record?.tracking_code)
  ) out.push("order_shipped");
  if(became(old,record,"status",["delivered"]) || became(old,record,"shipping_status",["delivered"])) out.push("order_delivered");
  if(became(old,record,"status",["cancelled"])) out.push("order_cancelled");
  return [...new Set(out)];
}
function returnEvents(record:any,old:any){
  const out:string[]=[];
  if(!old) out.push("return_requested");
  if(became(old,record,"status",["requested"]) && old) out.push("return_requested");
  if(became(old,record,"status",["approved"])) out.push("return_approved");
  if(became(old,record,"status",["rejected","declined","cancelled"])) out.push("return_rejected");
  if(became(old,record,"refund_status",["refunded"]) || became(old,record,"status",["refunded"])) out.push("refund_paid");
  return [...new Set(out)];
}
function valueFor(record:any,ret:any,key:string){
  const order=record||{};
  const map:Record<string,string>={
    customer_name:clean(order.customer_name,120),
    order_code:clean(order.order_code,80),
    total:new Intl.NumberFormat("fa-IR").format(Number(order.total||0)),
    tracking_code:clean(order.tracking_code,120)||"در حال آماده‌سازی",
    tracking_url:clean(order.tracking_url,400),
    status:clean(order.status,60),
    refund_amount:new Intl.NumberFormat("fa-IR").format(Number(ret?.refund_amount||0)),
    return_id:clean(ret?.id,80)
  };
  return map[key]??"";
}
function renderTemplate(template:string,record:any,ret:any){
  return clean(template,4000).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi,(_,k)=>valueFor(record,ret,String(k).toLowerCase()));
}
async function kavenegar(apiKey:string,receptor:string,message:string,sender:string){
  const p=new URLSearchParams({receptor,message});
  if(sender)p.set("sender",sender);
  const r=await fetch("https://api.kavenegar.com/v1/"+encodeURIComponent(apiKey)+"/sms/send.json",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:p.toString()});
  const body=await r.json().catch(()=>({}));
  const item=Array.isArray(body?.entries)?body.entries[0]:null;
  if(!r.ok||!item||![1,2].includes(Number(item.status))) throw new Error(clean(item?.statustext??"KAVENEGAR_SEND_FAILED",500));
  return{provider_message_id:item?.messageid==null?null:String(item.messageid),provider_status:item?.status==null?null:String(item.status),cost:item?.cost==null?null:Number(item.cost)};
}
async function resend(apiKey:string,to:string,from:string,subject:string,text:string){
  const html="<div dir=\"rtl\" style=\"font-family:Tahoma,Arial,sans-serif;line-height:2\">"+text.split("\n").map(x=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")).join("<br>")+"</div>";
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+apiKey},body:JSON.stringify({from,to:[to],subject,html,text})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.id) throw new Error(clean(body?.message??body?.name??"RESEND_SEND_FAILED",500));
  return{provider_message_id:String(body.id),provider_status:"sent",cost:null};
}
async function existingLog(dedupe:string){
  const q=await rest("/rest/v1/notification_logs?select=id,status,attempts&dedupe_key=eq."+encodeURIComponent(dedupe)+"&limit=1");
  return Array.isArray(q.body)?q.body[0]??null:null;
}
async function beginLog(payload:any){
  const existing=await existingLog(payload.dedupe_key);
  if(existing?.status==="sent" || existing?.status==="pending") return null;
  if(existing?.id){
    const q=await rest("/rest/v1/notification_logs?id=eq."+encodeURIComponent(String(existing.id)),{
      method:"PATCH",headers:{"content-type":"application/json","prefer":"return=minimal"},
      body:JSON.stringify({status:"pending",attempts:Number(existing.attempts||0)+1,error:null})
    });
    if(q.r.ok)return String(existing.id);
    return null;
  }
  const q=await rest("/rest/v1/notification_logs",{
    method:"POST",headers:{"content-type":"application/json","prefer":"return=representation"},
    body:JSON.stringify(payload)
  });
  if(!q.r.ok) return null;
  return Array.isArray(q.body)?String(q.body[0]?.id||""):null;
}
async function patchLog(id:string,patch:any){
  await rest("/rest/v1/notification_logs?id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{"content-type":"application/json","prefer":"return=minimal"},
    body:JSON.stringify(patch)
  });
}
async function deliver(channel:string,event:string,settingsRow:any,record:any,ret:any,orderId:string|null){
  if(settingsRow.events?.[event]===false)return;
  const isSms=channel==="sms";
  const recipient=isSms?clean(record?.customer_mobile,60):clean(record?.customer_email,200);
  if(!recipient)return;
  if(isSms&&!settingsRow.sms_enabled)return;
  if(!isSms&&!settingsRow.email_enabled)return;

  const provider=isSms?"kavenegar":"resend";
  const dedupe=(ret?.id||orderId||record?.id||"unknown")+":"+event+":"+channel;
  const existingId=await beginLog({
    order_id:orderId,
    customer_id:record?.customer_id||null,
    event,
    channel,
    recipient_masked:maskRecipient(recipient),
    provider,
    status:"pending",
    message:null,
    attempts:1,
    dedupe_key:dedupe,
    metadata:{label:EVENT_LABELS[event]||event,return_id:ret?.id||null}
  });
  if(!existingId)return;

  const message=renderTemplate(isSms?String(settingsRow.templates.sms?.[event]??""):String(settingsRow.templates.email?.[event]??""),record,ret);
  if(!message){
    await patchLog(existingId,{status:"skipped",message:null,error:"EMPTY_TEMPLATE"});
    return;
  }

  let lastError="";
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const result=isSms
        ? await kavenegar(await secret("azim_sms_api_key"),recipient,message,clean(settingsRow.sms_sender,30))
        : await resend(await secret("azim_resend_api_key"),recipient,clean(settingsRow.email_from,250),renderTemplate(String(settingsRow.email_subjects?.[event]??""),record,ret),message);
      await patchLog(existingId,{
        status:"sent",
        message,
        provider_message_id:result.provider_message_id,
        provider_status:result.provider_status,
        cost:result.cost,
        attempts:attempt,
        sent_at:new Date().toISOString(),
        error:null
      });
      return;
    }catch(e){
      lastError=clean((e as any)?.message??e,800);
      await patchLog(existingId,{attempts:attempt,error:lastError});
      if(attempt<3) await new Promise(r=>setTimeout(r,300*attempt));
    }
  }
  await patchLog(existingId,{status:"failed",message,error:lastError,attempts:3});
}
async function getOrder(id:string){
  const q=await rest("/rest/v1/orders?select=id,order_code,customer_id,customer_name,customer_mobile,customer_email,total,status,payment_status,shipping_status,tracking_code,tracking_url,created_at&id=eq."+encodeURIComponent(id)+"&limit=1");
  return Array.isArray(q.body)?q.body[0]??null:null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok");
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const expected=await secret("azim_notification_internal_token");
    const provided=String(req.headers.get("x-azim-internal-token")??"");
    if(!expected||!provided||provided!==expected)return json({ok:false,error:"UNAUTHORIZED"},401);

    const body=await req.json();
    const kind=clean(body?.kind,20);
    const record=body?.record??null;
    const old=body?.old_record??null;
    const op=clean(body?.operation,20);
    if(!record)return json({ok:false,error:"MISSING_RECORD"},400);

    const cfg=await settings();
    let events:string[]=[];
    let order:any=record;
    let ret:any=null;

    if(kind==="return"){
      ret=record;
      order=await getOrder(String(record.order_id));
      if(!order)return json({ok:false,error:"ORDER_NOT_FOUND"},404);
      events=returnEvents(record,old);
      const targets=["sms","email"];
      for(const event of events)for(const ch of targets)await deliver(ch,event,cfg,order,ret,String(order.id));
      return json({ok:true,kind,operation:op,events});
    }

    events=orderEvents(record,old);
    const targets=["sms","email"];
    for(const event of events)for(const ch of targets)await deliver(ch,event,cfg,order,null,String(order.id));
    return json({ok:true,kind:"order",operation:op,events});
  }catch(e){
    return json({ok:false,error:clean((e as any)?.message??e,800)},500);
  }
});