# FaxChat v1.2

## Oppsett (to steg)

### 1. Supabase → SQL Editor
Kjør hele `schema.sql` ( også hvis du har kjørt den før — nederst ligger engangs-fix for eksisterende brukere).

### 2. Supabase → Authentication → Users
Opprett bruker (eller rediger eksisterende):
- **Email** + **Password**
- **Auto Confirm User:** på
- **User Metadata** (JSON) — anbefalt:
```json
{"name":"Edvard","station_id":"01","fax_label":"Edvard01"}
```
Uten metadata får brukeren stasjon `99` automatisk.

Profil opprettes automatisk. Logg inn i FaxChat med **e-post + passord**.

## Filer (6 stk)
`index.html` · `styles.css` · `app.js` · `schema.sql` · `vercel.json` · `README.md`

## Deploy
Push til GitHub → Vercel. Ingen miljøvariabler nødvendig.
