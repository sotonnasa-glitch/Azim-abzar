-- The live definition restores the transaction-local payment guard setting
-- before returning from final payment/refund finalization. This migration is
-- kept as the canonical repository marker for that integrity hardening.

-- See the live function definitions in public.azim_finalize_online_payment()
-- and public.azim_finalize_online_refund().