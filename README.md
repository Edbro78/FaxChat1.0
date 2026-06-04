# FaxChat v1.2

## Oppsett (to steg)

### 1. Supabase → SQL Editor
Kjør hele `schema.sql`.

### 2. Supabase → Authentication → Users → Add user
- **Email** (f.eks. `per@test.no`) + **Password**
- **Auto Confirm User:** på
- Ingen User Metadata nødvendig

**Automatisk:**
- Navn i telefonkatalog = det før `@` → `per`
- Faxnummer = rekkefølge brukeren ble opprettet (1., 2., 3. → `1`, `2`, `3` … opp til `99`)

For å sende fax til Per: bla i katalogen, se at han har **NR 3**, tast `3` på tastaturet.

## Filer (6 stk)
`index.html` · `styles.css` · `app.js` · `schema.sql` · `vercel.json` · `README.md`

## Deploy
Push til GitHub → Vercel. Ingen miljøvariabler nødvendig.

## Pushvarsler (PWA hjemskjerm)
Se **[PUSH_SETUP.md](PUSH_SETUP.md)** — Supabase-tabell, Edge Function, VAPID-secrets og Database Webhook.
