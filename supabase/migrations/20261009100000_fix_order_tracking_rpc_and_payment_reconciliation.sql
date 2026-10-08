BEGIN;

-- Order tracking uses the private implementation, which reads protected order
-- tables. Run the narrow public wrapper with its owner privileges, not the
-- caller's anon privileges. The wrapper still delegates identity checks to
-- private.azim_order_status(order_code, mobile).
ALTER FUNCTION public.azim_order_status(text, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.azim_order_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.azim_order_status(text, text) TO anon, authenticated;

-- Reconcile paid_at only from an existing audited Telegram transition that
-- explicitly records payment_after='paid'. Never fabricate a payment reference.
WITH evidence AS (
  SELECT DISTINCT ON (entity_id)
    entity_id::uuid AS order_id,
    created_at AS audited_paid_at,
    id AS source_audit_id,
    actor_id AS source_actor_id
  FROM public.audit_logs
  WHERE entity = 'orders'
    AND action = 'telegram_offline_payment_status'
    AND metadata->>'payment_after' = 'paid'
  ORDER BY entity_id, created_at DESC, id DESC
),
repaired AS (
  UPDATE public.orders AS o
  SET paid_at = e.audited_paid_at
  FROM evidence AS e
  WHERE o.id = e.order_id
    AND o.payment_status = 'paid'
    AND o.payment_method IN ('phone', 'message')
    AND o.paid_at IS NULL
  RETURNING o.id, o.order_code, o.payment_reference, o.paid_at,
            e.source_audit_id, e.source_actor_id
)
INSERT INTO public.payment_events(
  order_id, event_type, status_before, status_after, actor_type, actor_id,
  idempotency_key, payload
)
SELECT
  r.id, 'legacy_paid_at_reconciled', 'paid', 'paid', 'system', NULL,
  'legacy-paid-at-reconcile:' || r.id::text,
  jsonb_build_object(
    'order_code', r.order_code,
    'paid_at', r.paid_at,
    'source_audit_id', r.source_audit_id,
    'source_actor_id', r.source_actor_id,
    'source', 'telegram_offline_payment_status audit record',
    'payment_reference_missing', r.payment_reference IS NULL,
    'payment_reference_fabricated', false
  )
FROM repaired AS r
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_events pe
  WHERE pe.idempotency_key = 'legacy-paid-at-reconcile:' || r.id::text
);

COMMIT;
