# TypeMe Supabase

All database SQL lives in **`typeme-master.sql`** — apply it top to bottom,
in one go, on an empty Supabase project (Dashboard SQL editor or `psql`).

Live-project checklist (cannot be done from this repo): enable Anonymous
Sign-Ins if guest flow is wanted, verify the `fonts` bucket is private,
run the two-user RLS isolation test, wire the Razorpay webhook to update
`subscriptions`/`payments` via service role, and confirm production hosting
serves the `.well-known` association files with correct content types.
