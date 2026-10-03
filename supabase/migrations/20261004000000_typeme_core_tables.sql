-- TypeMe core tables (Supabase/Postgres).
-- Applies cleanly on an empty project. No destructive statements.
--
-- Data-model mapping notes (read before modifying):
-- - Strokes live in glyphs.stroke_data as JSONB arrays of [{x, y}] points,
--   matching the app's Stroke/Point model in src/types.ts. Main glyphs use
--   variant_number = 0; alternates use 1..3. There is deliberately NO
--   separate variants table: variants are per-character alternates, so a
--   second table would duplicate glyph ownership (see §14 decision log).
-- - A character's "saved" dot is glyphs.is_saved + saved_at, set only after
--   a successful write — never on selection.
-- - Blob font files are NOT stored in tables; tables hold Storage metadata
--   (file_path) pointing at the private `fonts` bucket (see next migration).

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'archived')),
  plan_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz,
  completed_at timestamptz
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);
create index if not exists projects_last_opened_at_idx on public.projects (last_opened_at desc nulls last);

-- ------------------------------------------------------------------ glyphs
-- One row per (project, character, variant). variant_number 0 = Main.
create table if not exists public.glyphs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  character text not null,
  variant_number integer not null default 0
    check (variant_number between 0 and 3),
  stroke_data jsonb not null default '[]'::jsonb,
  canvas_width integer,
  canvas_height integer,
  bitmap_width integer,
  bitmap_height integer,
  status text not null default 'empty'
    check (status in ('empty', 'good', 'warning', 'error')),
  is_saved boolean not null default false,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, character, variant_number)
);

create index if not exists glyphs_project_id_idx on public.glyphs (project_id);
create index if not exists glyphs_user_id_idx on public.glyphs (user_id);

-- --------------------------------------------------------- generated_fonts
create table if not exists public.generated_fonts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_job_id uuid,
  font_name text not null,
  format text not null default 'otf'
    check (format in ('otf', 'ttf')),
  file_path text,
  status text not null default 'ready'
    check (status in ('ready', 'expired', 'revoked')),
  version integer not null default 1,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_fonts_project_id_idx on public.generated_fonts (project_id);
create index if not exists generated_fonts_user_id_idx on public.generated_fonts (user_id);

-- ---------------------------------------------------------- generation_jobs
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'ready'
    check (status in ('idle', 'ready', 'validating', 'processing', 'completed', 'warning', 'failed', 'cancelled')),
  progress integer check (progress is null or (progress between 0 and 100)),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, status)
);

create index if not exists generation_jobs_project_id_idx on public.generation_jobs (project_id);
create index if not exists generation_jobs_user_id_idx on public.generation_jobs (user_id);
create index if not exists generation_jobs_status_idx on public.generation_jobs (status);

-- ------------------------------------------------------------ subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'pending', 'failed')),
  started_at timestamptz,
  expires_at timestamptz,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_expires_at_idx on public.subscriptions (expires_at);

-- ----------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_signature text,
  amount integer,
  currency text not null default 'INR',
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'cancelled', 'refunded')),
  plan text not null default 'pro'
    check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_razorpay_payment_id_idx on public.payments (razorpay_payment_id);

-- ------------------------------------------------------------- user_settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text,
  default_canvas_style text,
  default_brush text,
  default_stroke_size text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Migrations run once via the tracker, so plain CREATE TRIGGER is correct
-- (no IF NOT EXISTS guard needed or valid here).
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_glyphs_updated_at
  before update on public.glyphs
  for each row execute function public.handle_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ------------------------------------------- automatic profile creation
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    coalesce(new.phone, null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
