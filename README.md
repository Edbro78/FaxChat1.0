# FaxChat v1.2

Retro faksmaskin med **Supabase** (auth + database) og frontend på **Vercel**.

## Brukernavn (ikke e-post)

Hver bruker har **Kortnavn + 2 siffer**, f.eks. **Edvard01**:

| Felt | Eksempel Edvard01 |
|------|-------------------|
| Innlogging | `Edvard01` + passord |
| Navn | Edvard |
| Faksnummer (STN) | `01` |
| Kartotek | `Edvard01` |

Supabase Auth krever teknisk et «e-post»-felt ved opprettelse — bruk **intern ID**, ikke ekte e-post:

`Edvard01` → `edvard01@faxchat.no` i Authentication → Users

Full guide: **`supabase/opprett-bruker.sql`**

## Supabase-oppsett

1. Opprett prosjekt på [supabase.com](https://supabase.com).
2. Kjør `supabase/schema.sql` i **SQL Editor**.
3. **Authentication → Providers → Email**: slå **av** «Enable sign ups».
4. Opprett brukere — se `supabase/opprett-bruker.sql`.
5. Innloggede brukere ser **kun** faks sendt til deres `station_id`.

## Vercel-deploy

1. Koble [FaxChat1.0](https://github.com/Edbro78/FaxChat1.0) til Vercel.
2. **Environment Variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Production).
3. Redeploy. Test: `/api/config` skal returnere JSON.

## Lokal utvikling

```bash
cp config.example.js config.js
npm run dev
```

## Brukerflyt

1. Logg inn med f.eks. `Edvard01` og passord.
2. **Lese innkommende** — faks til ditt nummer (f.eks. STN 01).
3. **Sende ny fax** — tast mottakers nummer (f.eks. `22`) eller velg i kartotek.
