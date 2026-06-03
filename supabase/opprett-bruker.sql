# Opprette brukere (admin) — ingen e-post

Du som admin lager **brukernavn + passord** for hver bruker.  
Format: **Edvard01** (Edvard, faksnummer 01).

## 1. Miljøvariabler i Vercel

| Variabel | Hvor finner du den |
|----------|-------------------|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (hemmelig) |
| `ADMIN_SECRET` | Velg et sterkt passord du husker — din admin-nøkkel |

## 2. Opprett bruker (velg én metode)

### A) Admin-side (enklest)

1. Gå til `https://ditt-domene.vercel.app/admin.html`
2. Fyll inn **Admin-nøkkel** (= `ADMIN_SECRET` fra Vercel)
3. **Brukernavn:** f.eks. `Edvard01`
4. **Passord:** det brukeren skal logge inn med
5. Klikk **Opprett bruker**

### B) curl

```bash
curl -X POST https://ditt-domene.vercel.app/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DIN_ADMIN_SECRET" \
  -d "{\"username\":\"Edvard01\",\"password\":\"hemmelig\"}"
```

## 3. Brukeren logger inn

- **Brukernavn:** `Edvard01`
- **Passord:** det du satte

Ingen e-post noe sted.

## Første admin-bruker

Opprett f.eks. `Admin99` (STN 99) via admin.html etter at `ADMIN_SECRET` er satt i Vercel.
