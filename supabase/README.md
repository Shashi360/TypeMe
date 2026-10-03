# TypeMe Supabase — migrations & apply guide

## Apply order

1. `migrations/20261004000000_typeme_core_tables.sql` — tables, constraints,
   indexes, `updated_at` + auto-profile triggers.
2. `migrations/20261004000001_typeme_rls_policies.sql` — `ENABLE ROW LEVEL
   SECURITY`, ownership policies, `get_my_entitlement()`, private `fonts`
   bucket + Storage policies.

Apply with the Supabase CLI (`supabase db push`) or paste each file, in
order, into the Dashboard SQL editor. Both files are idempotent where
PostgreSQL allows (`IF NOT EXISTS` / `OR REPLACE` / `ON CONFLICT`); trigger
creation assumes a fresh project (migrations run once via the tracker).

## What was validated without a live project

- Every DDL statement (tables, constraints, indexes) executes cleanly
  (pg-mem harness).
- Unique + check constraints enforced (duplicate glyph rejected, bad plan
  rejected).
- `plpgsql` trigger bodies, `CREATE POLICY`, and `GRANT/REVOKE ON FUNCTION`
  are valid PostgreSQL but outside pg-mem's grammar — they REQUIRE the live
  project test below before production.

## Required live-project checklist (cannot be done from this repo)

- [ ] Enable Anonymous Sign-Ins (Dashboard → Auth → Providers) if guest
      flow is wanted; note RLS already isolates anon UIDs.
- [ ] Create the `fonts` bucket as private (migration inserts it as
      private; verify in Storage settings).
- [ ] Serve `apple-app-site-association` / `assetlinks.json` from
      `public/.well-known/` with correct content types on production hosting.
- [ ] Two-user RLS test (§59 of the task): A↔B isolation, no self-promote
      to Pro, guest isolation, claim flow via backend only.
- [ ] Razorpay webhook → service-role update of `subscriptions` +
      `payments` rows; frontend never writes them.
- [ ] pg_cron (or scheduled Edge Function) for abandoned-anon cleanup IF
      wanted — not enabled by these migrations.

## Deliberate schema decisions

- No separate `variants` table: variants are per-character alternates stored
  as `glyphs.variant_number` rows (0 = Main). A second table would duplicate
  ownership.
- No `days_remaining` column: always derived from `expires_at`.
- No `guest_claim` function: ownership transfer without a backend verifier
  would be a privilege-escalation footgun; the backend must own it.
- No admin role table: none exists in the app; add one only with a real
  admin requirement.
