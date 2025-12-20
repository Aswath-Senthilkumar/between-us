-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  partner_id uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Safely add username column if it doesn't exist (fixes migration issue)
do $$ 
begin 
  alter table profiles add column if not exists username text unique;
exception
  when duplicate_column then null;
end $$;

-- Safely add system_notification column
do $$ 
begin 
  alter table profiles add column if not exists system_notification text;
exception
  when duplicate_column then null;
end $$;

-- RLS for Profiles
alter table profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- PUZZLES TABLE
create table if not exists puzzles (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null,
  setter_id uuid references profiles(id) not null,
  solver_id uuid references profiles(id) not null,
  target_word text not null,
  secret_message text,
  guesses jsonb default '[]'::jsonb,
  is_solved boolean default false
);

-- RLS for Puzzles
alter table puzzles enable row level security;

drop policy if exists "Users can view puzzles they are involved in" on puzzles;
create policy "Users can view puzzles they are involved in"
  on puzzles for select
  using ( auth.uid() = setter_id or auth.uid() = solver_id );

drop policy if exists "Users can insert puzzles where they are the setter" on puzzles;
create policy "Users can insert puzzles where they are the setter"
  on puzzles for insert
  with check ( auth.uid() = setter_id );

drop policy if exists "Users can update puzzles where they are involved" on puzzles;
create policy "Users can update puzzles where they are involved"
  on puzzles for update
  using ( auth.uid() = setter_id or auth.uid() = solver_id );

-- Functions
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'username'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Link Partner Function
create or replace function link_partner(partner_email text)
returns void as $$
declare
  target_user_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  
  -- Find the partner's ID
  select id into target_user_id
  from profiles
  where email = partner_email
  limit 1;

  if target_user_id is null then
    raise exception 'User with email % not found', partner_email;
  end if;

  if target_user_id = current_user_id then
    raise exception 'You cannot partner with yourself';
  end if;

  -- Update current user's partner
  update profiles
  set partner_id = target_user_id
  where id = current_user_id;

  -- Update partner's partner
  update profiles
  set partner_id = current_user_id
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Dismiss Notification Function
create or replace function dismiss_notification()
returns void as $$
begin
  update profiles
  set system_notification = null
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- Delete Account Function
create or replace function delete_account()
returns void as $$
declare
  partner_id_val uuid;
begin
  -- Get partner id
  select partner_id into partner_id_val from profiles where id = auth.uid();

  -- If partner exists, notify them and unlink
  if partner_id_val is not null then
    update profiles
    set partner_id = null,
        system_notification = 'Your partner has left the platform.'
    where id = partner_id_val;
  end if;

  -- Delete current user's profile
  delete from profiles where id = auth.uid();
end;
$$ language plpgsql security definer;
