# TypeMe Supabase

All database SQL lives in **`typeme-master.sql`** — apply it top to bottom,
in one go, on an empty Supabase project (Dashboard SQL editor or `psql`).

Live-project checklist (cannot be done from this repo): enable Anonymous
Sign-Ins if guest flow is wanted, verify the `fonts` bucket is private,
run the two-user RLS isolation test, wire the Razorpay webhook to update
`subscriptions`/`payments` via service role, and confirm production hosting
serves the `.well-known` association files with correct content types.

## Checkout intent (required for subscription rows)

`typeme-master.sql` already includes the pending-intent policies for fresh
projects. For the EXISTING live project, apply once in Dashboard → SQL
Editor:

  supabase/migrations/02-checkout-intent.sql

What changes: the app records each Pro checkout as a `pending`
subscription row owned by `auth.uid()` (visible immediately, phone-linked
via `profiles.phone`). Activation to `active` stays backend-only
(Razorpay webhook, service_role) — the contract is documented at the top
of that file. The app adopts backend-activated Pro automatically via
`get_my_entitlement()` on every login.
