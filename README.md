# FaxChat v1.2

**Ingen e-post.** Brukernavn som `Edvard01` + passord.

## To systemer — ikke bland dem

| System | Bruk |
|--------|------|
| **FaxChat innlogging** | `Edvard01` + passord |
| **Supabase Authentication** | **IKKE BRUK** (krever e-post) |

Opprett brukere i **SQL Editor** → `supabase/LES-DETTE.md`

```sql
select public.create_faxchat_user('Edvard01', 'passord123');
```

## Vercel

Kun **én** variabel påkrevd for innlogging:

| Variabel | Hvor |
|----------|------|
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret |

URL + publishable key er i `public-config.js` (allerede satt).

## Første gangs oppsett Supabase

1. Kjør `supabase/schema.sql` i SQL Editor
2. `select create_faxchat_user('Edvard01', 'dittpassord');`
3. Sett `SUPABASE_JWT_SECRET` i Vercel → Redeploy
4. Logg inn med **Edvard01** (ikke e-post)
