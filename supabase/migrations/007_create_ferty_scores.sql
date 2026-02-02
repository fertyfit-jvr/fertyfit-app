-- Create table for storing historical FertyScores
create table if not exists public.ferty_scores (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete cascade not null,
  global_score integer,
  function_score integer,
  food_score integer,
  flora_score integer,
  flow_score integer,
  calculation_trigger text, -- 'profile_update', 'daily_log', 'manual_recalc'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for performance
create index if not exists ferty_scores_user_id_idx on public.ferty_scores(user_id);
create index if not exists ferty_scores_created_at_idx on public.ferty_scores(created_at);

-- RLS Policies
alter table public.ferty_scores enable row level security;

create policy "Users can view their own scores"
  on public.ferty_scores for select
  using (auth.uid() = user_id);

create policy "Users can insert their own scores"
  on public.ferty_scores for insert
  with check (auth.uid() = user_id);
