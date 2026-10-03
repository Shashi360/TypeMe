-- ================================================================
-- TYPEME migration 02 — checkout intent (demo-safe, production-shaped)
--
-- APPLY: Supabase Dashboard → SQL Editor → paste → Run (one click).
-- IDEMPOTENT: safe to re-run.
--
-- WHAT IT DOES
-- Lets an authenticated user record their OWN checkout intent:
--   subscriptions: INSERT/UPDATE own row while status stays 'pending'
--   payments:      INSERT own rows with non-verified statuses
-- It can NEVER self-activate Pro:
--   * no policy permits status 'active' from a browser JWT
--   * get_my_entitlement() honors active rows exclusively
-- Activation stays backend-only: your Razorpay webhook (service_role)
-- verifies the payment, then updates subscriptions -> active + payments ->
-- verified. Until that backend exists, the app keeps its local demo
-- activation AND leaves this auditable pending trace.
-- ================================================================

drop policy if exists "subscriptions_insert_own_pending" on public.subscriptions;
create policy "subscriptions_insert_own_pending"
  on public.subscriptions for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "subscriptions_update_own_pending" on public.subscriptions;
create policy "subscriptions_update_own_pending"
  on public.subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "payments_insert_own_initiated" on public.payments;
create policy "payments_insert_own_initiated"
  on public.payments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status in ('pending', 'failed', 'cancelled')
  );

-- ================================================================
-- BACKEND WEBHOOK CONTRACT (when Razorpay keys land)
-- 1. Create order (server): amount 9900 paise, currency INR, receipt uid.
-- 2. Verify signature (server, HMAC-SHA256, key_secret — never browser).
-- 3. service_role: payments -> verified + verified_at; subscriptions ->
--    status 'active', started_at/expires_at (+30d), razorpay ids stored.
-- 4. App reconciles on next load via get_my_entitlement() (already wired).
-- ================================================================
