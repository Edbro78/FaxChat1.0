# FaxChat v1.2

Retro faksmaskin — brukere logger inn med **brukernavn + passord** (f.eks. `Edvard01`).

## Admin: opprett brukere i Supabase

Se **`supabase/opprett-bruker.sql`** — to steg:

1. **Authentication → Users → Add user**  
   - User ID: `edvard01@fax.internal` (Supabase sitt tekniske felt — ikke ekte e-post)  
   - Password: passordet brukeren skal ha  

2. **SQL Editor:**  
   ```sql
   select public.register_faxchat_profile('Edvard01');
   ```

Brukeren logger inn på FaxChat med **Edvard01** + passord.

## Supabase-oppsett

1. Kjør `supabase/schema.sql` i SQL Editor  
2. Slå av «Enable sign ups» under Email-auth  
3. Opprett brukere som beskrevet over  

## Vercel (Environment Variables)

| Variabel | Formål |
|----------|--------|
| `SUPABASE_URL` | API URL |
| `SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | innlogging via brukernavn |

## Deploy

GitHub → Vercel. Test `/api/config`.

## Brukerflyt

1. Logg inn med `Edvard01` + passord  
2. Se innkommende faks til ditt nummer (`01`)  
3. Send fax til andre via kartotek / tastatur  
