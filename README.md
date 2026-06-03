# FaxChat v1.2

Retro faksmaskin — **kun brukernavn + passord**, ingen e-post.

## Brukernavn

Format: **Kortnavn + 2 siffer** → `Edvard01`

| | |
|---|---|
| Innlogging | `Edvard01` + passord |
| Navn | Edvard |
| Faksnummer | `01` |

## Admin: opprett brukere

Se **`supabase/opprett-bruker.sql`** eller bruk **`/admin.html`**.

Du trenger disse i **Vercel → Environment Variables**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET` (din hemmelige admin-nøkkel)

Brukere opprettes **ikke** i Supabase Dashboard — kun via admin-siden eller API.

## Supabase

1. Kjør `supabase/schema.sql`
2. Slå av «Enable sign ups» under Email-auth
3. Sett miljøvariabler i Vercel og opprett brukere via `admin.html`

## Deploy

Push til GitHub → Vercel redeploy. Test `/api/config`.

## Lokal utvikling

```bash
cp config.example.js config.js
npm run dev
```

For innlogging lokalt: kjør `vercel dev` med alle miljøvariabler, eller deploy til Vercel.
