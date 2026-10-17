-- Notes visitors leave from the site footer. The site has no login: anyone with the link may add
-- feedback, nobody but the project owner (dashboard / service role) can read it.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  name text not null default '' check (char_length(name) <= 40),
  page text not null default '' check (char_length(page) <= 100)
);

alter table public.feedback enable row level security;

create policy "leave feedback" on public.feedback
  for insert to anon, authenticated with check (char_length(btrim(message)) between 1 and 1000);

grant insert on public.feedback to anon, authenticated;
