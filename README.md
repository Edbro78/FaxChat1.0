# FaxChat v1.2

Retro faksmaskin — **kun brukernavn + passord**. Ingen e-post noe sted.

## Admin: opprett brukere i Supabase SQL Editor

**Ikke** bruk Authentication → Users (krever e-post).

```sql
select public.create_faxchat_user('Edvard01', 'passord123');
```

Se `supabase/opprett-bruker.sql`.

| Brukernavn | Faksnummer |
|------------|------------|
| Edvard01 | 01 |
| Bernt33 | 33 |

## Supabase

1. Kjør `supabase/schema.sql` (eller `migration-no-email-auth.sql` + schema-funksjoner)
2. Opprett brukere med `create_faxchat_user` i SQL Editor

## Vercel Environment Variables

| Variabel | Hvor |
|----------|------|
| `SUPABASE_URL` | `https://mswgcwwpvkxvkvwejiab.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable key (`sb_publishable_...`) |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → **JWT Secret** |

`SUPABASE_SERVICE_ROLE_KEY` trengs **ikke** lenger til innlogging.

## Brukerflyt

1. Logg inn med `Edvard01` + passord
2. Se innkommende faks til STN 01
3. Send fax til andre stasjoner
