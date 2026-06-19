-- admin_first_user.sql
-- Bootstrap the FIRST admin (owner). Idempotent + safe.
--
-- HOW FIRST-OWNER BOOTSTRAP WORKS HERE:
--   The `on_auth_user_created` trigger (0003_profiles.sql) calls handle_new_user(),
--   which assigns role='owner' to the FIRST profile ever created, and 'editor' to
--   every later one. So you do NOT create the owner by hand — you create ONE auth
--   user and the trigger promotes them automatically.
--
-- STEP 1 — create the auth user (pick ONE method):
--   a) Supabase Dashboard → Authentication → Users → "Add user" → enter email +
--      password + tick "Auto Confirm User". The trigger then inserts an owner profile.
--   b) OR, with the service-role key, call the Admin API:
--        curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
--          -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--          -H "Content-Type: application/json" \
--          -d '{"email":"admin@yayasanalhidayah.com","password":"REPLACE_ME","email_confirm":true}'
--
-- STEP 2 — verify (run this file). It reports the current owner(s) and total users.
-- Nothing below mutates data — it is read-only reporting so you can confirm.

select
  p.id,
  u.email,
  p.role,
  p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at asc;

-- Expected after STEP 1: exactly one row with role = 'owner'.
-- If a user exists but has role 'editor' (e.g. they were not the first), promote
-- them manually:
--   update public.profiles set role = 'owner' where id = '<auth-user-uuid>';
-- (RLS does not apply in the SQL editor / service-role context.)
