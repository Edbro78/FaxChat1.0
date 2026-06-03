# FaxChat v1.2

## Oppsett (to steg)

### 1. Supabase → SQL Editor
Kjør hele `schema.sql`.

### 2. Supabase → Authentication → Users → Add user
- **Email** + **Password**
- **Auto Confirm User:** på
- **User Metadata** (JSON):
```json
{"name":"Edvard","station_id":"01","fax_label":"Edvard01"}
```

Profil opprettes automatisk. Logg inn i FaxChat med **e-post + passord**.

## Filer (6 stk)
`index.html` · `styles.css` · `app.js` · `schema.sql` · `vercel.json` · `README.md`

## Deploy
Push til GitHub → Vercel. Ingen miljøvariabler nødvendig.
