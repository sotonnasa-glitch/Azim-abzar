-- Restore the protected order-tracking wrapper after private helper lockdown.
-- The private implementation still enforces the order-code + customer-mobile match
-- and existing rate limit; only this narrow wrapper is callable by customer clients.
ALTER FUNCTION public.azim_order_status(text, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.azim_order_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.azim_order_status(text, text) TO anon, authenticated;
