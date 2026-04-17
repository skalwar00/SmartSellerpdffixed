create table if not exists demo_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  mobile text not null,
  email text not null,
  city text not null,
  created_at timestamptz not null default now()
);
