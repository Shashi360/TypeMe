# TypeMe Supabase

All database SQL lives in **`typeme-master.sql`** — apply it top to bottom,
in one go, on an empty Supabase project (Dashboard SQL editor or `psql`).
The file is fully re-runnable (drop-if-exists triggers/policies).

## Production authentication

Two paths, both ending in a REAL Supabase session (never a frontend fake):

1. REAL numbers — native Supabase phone auth, configured once in
   Dashboard → Authentication → Providers → Phone (Twilio credentials +
   SMS template). The app calls `signInWithOtp` / `verifyOtp` directly;
   no backend, no secrets in the bundle. Supabase enforces provider-side
   rate limits; the app keeps resend-cooldown/attempt-cap UX on top.

2. CONTROLLED TEST numbers (dev) — Edge Function
   `supabase/functions/verify-test-otp` verifies the code against the
   SERVER-side map and mints a real session via a single-use token_hash.
   Deploy, then set secrets, then point the dev `.env` at it:

   supabase functions deploy verify-test-otp
   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     TEST_OTP_MAP='{"+917760593180":"7760","+917760593181":"7761","+917760593182":"7762"}' \
     APP_ORIGIN='http://localhost:5173'

   VITE_TEST_NUMBERS="7760593180,7760593181,7760593182"
   VITE_TEST_AUTH_URL="https://rifdeflmatwsyvexevgs.supabase.co/functions/v1/verify-test-otp"

   Production builds NEVER take the bridge route (dev-gated in code), so
   test codes cannot work in a prod bundle even if listed.

Until the bridge is deployed, dev test-number login falls through to
native SMS (which fails closed without Twilio) — that failure IS the
honest signal, not a bug. Until Twilio is configured, real-number SMS
likewise fails closed with a plain error.

Live-project checklist (cannot be done from this repo): enable Anonymous
Sign-Ins if guest flow is wanted, verify the `fonts` bucket is private,
run the two-user RLS isolation test, wire the Razorpay webhook to update
`subscriptions`/`payments` via service role, and confirm production hosting
serves the `.well-known` association files with correct content types.

## Checkout intent (required for subscription rows)

`typeme-master.sql` is the ONLY SQL file — it already contains the
pending-intent policies. For the EXISTING live project, run just the
three NEW statements once in Dashboard → SQL Editor (from the master
file, Subscriptions/Payments section):

  create policy "subscriptions_insert_own_pending" ...
  create policy "subscriptions_update_own_pending" ...
  create policy "payments_insert_own_initiated" ...
  create policy "generated_fonts_insert_own" ...

What changes: the app records each Pro checkout as a `pending`
subscription row owned by `auth.uid()` (visible immediately, phone-linked
via `profiles.phone`). Activation to `active` stays backend-only
(Razorpay webhook, service_role) — the contract is documented in the
master file. The app adopts backend-activated Pro automatically via
`get_my_entitlement()` on every login.
