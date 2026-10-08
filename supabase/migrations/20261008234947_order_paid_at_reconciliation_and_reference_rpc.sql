-- Reconcile only paid_at values supported by the audited offline-payment event.
-- Never fabricate a payment reference. Historical references must be entered from real
-- payment evidence through the owner/admin + MFA RPC below.

CREATE OR REPLACE FUNCTION public.azim_admin_attach_payment_reference(
  p_order_id uuid,
  p_reference text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_reference text := nullif(trim(coalesce(p_reference,'')), '');
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
BEGIN
  IF NOT private.has_azim_role(ARRAY['owner','admin']) THEN
    RAISE EXCEPTION USING message='ثبت مرجع پرداخت قبلی فقط برای مالک یا مدیر مجاز است.';
  END IF;
  IF coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION USING message='برای ثبت مرجع پرداخت، تأیید دومرحله‌ای لازم است.';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION USING message='شناسه سفارش معتبر نیست.';
  END IF;
  IF v_reference IS NULL OR char_length(v_reference)<3 OR char_length(v_reference)>160 THEN
    RAISE EXCEPTION USING message='مرجع واقعی پرداخت را وارد کنید (۳ تا ۱۶۰ نویسه).';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason)<5 OR char_length(v_reason)>500 THEN
    RAISE EXCEPTION USING message='دلیل ثبت مرجع باید بین ۵ تا ۵۰۰ نویسه باشد.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id=p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING message='سفارش پیدا نشد.';
  END IF;
  IF v_order.payment_method NOT IN ('phone','message') OR v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION USING message='این عملیات فقط برای سفارش پرداخت‌شده با روش تلفنی یا پیام مجاز است.';
  END IF;
  IF v_order.paid_at IS NULL THEN
    RAISE EXCEPTION USING message='زمان ثبت پرداخت هنوز با سابقهٔ معتبر تطبیق داده نشده است.';
  END IF;
  IF nullif(trim(coalesce(v_order.payment_reference,'')), '') IS NOT NULL THEN
    RAISE EXCEPTION USING message='برای این سفارش مرجع پرداخت از قبل ثبت شده است.';
  END IF;

  UPDATE public.orders
  SET payment_reference=v_reference, updated_at=now()
  WHERE id=v_order.id;

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata)
  VALUES(
    auth.uid(),
    'admin_payment_reference_reconciled',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'payment_status',v_order.payment_status,
      'payment_reference',v_reference,
      'reason',v_reason,
      'paid_at_preserved',v_order.paid_at,
      'payment_status_changed',false
    )
  );

  RETURN jsonb_build_object(
    'ok',true,'order_id',v_order.id,'order_code',v_order.order_code,
    'payment_status',v_order.payment_status,'payment_reference',v_reference,'paid_at',v_order.paid_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.azim_admin_attach_payment_reference(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.azim_admin_attach_payment_reference(uuid,text,text) TO authenticated;

WITH evidence AS (
  SELECT DISTINCT ON (entity_id)
    entity_id::uuid AS order_id,
    created_at AS audited_paid_at,
    id AS source_audit_id,
    actor_id AS source_actor_id
  FROM public.audit_logs
  WHERE entity='orders'
    AND action='telegram_offline_payment_status'
    AND metadata->>'payment_after'='paid'
  ORDER BY entity_id,created_at DESC,id DESC
),
repaired AS (
  UPDATE public.orders AS o
  SET paid_at=e.audited_paid_at
  FROM evidence AS e
  WHERE o.id=e.order_id
    AND o.payment_status='paid'
    AND o.payment_method IN ('phone','message')
    AND o.paid_at IS NULL
  RETURNING o.id,o.order_code,o.payment_reference,o.paid_at,e.source_audit_id,e.source_actor_id
)
INSERT INTO public.payment_events(
  order_id,event_type,status_before,status_after,actor_type,actor_id,idempotency_key,payload
)
SELECT
  r.id,
  'legacy_paid_at_reconciled',
  'paid',
  'paid',
  'system',
  NULL,
  'legacy-paid-at-reconcile:'||r.id::text,
  jsonb_build_object(
    'order_code',r.order_code,
    'paid_at',r.paid_at,
    'source_audit_id',r.source_audit_id,
    'source_actor_id',r.source_actor_id,
    'source','telegram_offline_payment_status audit record',
    'payment_reference_missing',r.payment_reference IS NULL,
    'payment_reference_fabricated',false
  )
FROM repaired r
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_events pe
  WHERE pe.idempotency_key='legacy-paid-at-reconcile:'||r.id::text
);
