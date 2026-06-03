# FaxChat v1.2

Retro faksmaskin med **Supabase** (auth + database) og frontend på **Vercel**.

## Arkitektur

| Del | Plattform |
|-----|-----------|
| Frontend | Vercel (statisk) |
| Auth + database | Supabase |

## Filer

| Fil | Rolle |
|-----|--------|
| `index.html` | Innlogging + FaxChat UI |
| `auth.js` | Supabase Auth (kun innlogging) |
| `app.js` | UI, sending, innkommende faks |
| `styles.css` | Retro-styling |
| `config.js` | Supabase URL + anon key (genereres ved deploy) |
| `supabase/schema.sql` | Tabeller og RLS |

## Supabase-oppsett

1. Opprett prosjekt på [supabase.com](https://supabase.com).
2. Kjør hele `supabase/schema.sql` i **SQL Editor**.
3. **Authentication → Providers → Email**: slå **av** «Enable sign ups».
4. Opprett brukere manuelt under **Authentication → Users** (Add user + passord).
5. **Admin (test):** se `supabase/setup-admin.sql`
   - Brukernavn i appen: `admin`
   - E-post i Supabase: `admin@faxchat.no`
   - Passord: `123`
   - Profil: `Admin99`, stasjon `99`
6. For hver bruker, legg inn profil (erstatt UUID og data):

```sql
insert into public.profiles (id, name, station_id, fax_label, description)
values (
  '00000000-0000-0000-0000-000000000000',  -- auth user UUID
  'Bernt',
  '33',
  'Bernt33',
  'Main Storage'
);
```

- `fax_label`: visningsnavn i katalog (f.eks. `Bernt33`)
- `station_id`: tosifret faksnummer (f.eks. `33`)
- Innloggede brukere ser **kun** faks der `recipient_station_id` = deres `station_id`

## Vercel-deploy

1. Koble [FaxChat1.0](https://github.com/Edbro78/FaxChat1.0) til Vercel.
2. **Miljøvariabler** (Settings → Environment Variables):

   | Navn | Verdi |
   |------|--------|
   | `SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

   Huk av **Production**, Save, deretter **Redeploy**.

3. Appen henter nøkler via `/api/config` ved runtime (ingen build-steg som kan feile).
4. Test: åpne `https://ditt-domene.vercel.app/api/config` — skal vise JSON med `url` (ikke feilmelding).

## Lokal utvikling

```bash
cp config.example.js config.js
# Fyll inn url og anonKey fra Supabase → Settings → API

npm run dev
```

Åpne http://localhost:3000

## Innlogging

- Feltet **Brukernavn** (ikke e-post i UI): `admin` → logges inn som `admin@faxchat.no`
- Full e-post fungerer også om du skriver `navn@faxchat.no`

## Brukerflyt

1. Logg inn med brukernavn og passord du har opprettet i Supabase.
2. **Lese innkommende** – alle faks til ditt nummer (f.eks. STN 33).
3. **Sende ny fax** – tast mottakers tosifrede nummer (eller klikk i kartotek), skriv og send.
4. Brukere kan ikke registrere seg eller endre passord i appen.
