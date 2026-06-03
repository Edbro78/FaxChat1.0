# VIKTIG — les dette først

## IKKE bruk Supabase → Authentication → Users

Den menyen krever e-post. FaxChat bruker den **ikke**.

## Opprett brukere her i stedet

**SQL Editor** → kjør:

```sql
select public.create_faxchat_user('Edvard01', 'passord123');
```

Brukeren logger inn med **Edvard01** + passord — aldri e-post.

## Vercel (kun én hemmelighet for innlogging)

| Variabel | Hvor |
|----------|------|
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → **JWT Secret** |

URL og publishable key ligger allerede i `public-config.js`.
