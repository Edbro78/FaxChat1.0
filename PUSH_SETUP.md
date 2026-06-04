# Pushvarsler ved ny fax (PWA fra hjemskjerm)

FaxChat er satt opp for **Web Push** når appen åpnes fra **ikon på hjemskjerm** (standalone). Vanlig fane i Safari/Chrome uten «Legg til på Hjem-skjerm» får ikke pålitelig push.

## 1. Database (Supabase SQL Editor)

Kjør den nye delen i `schema.sql` (tabellen `push_subscriptions`), eller kjør hele filen på nytt hvis du vil.

## 2. Supabase Edge Function — deploy

Installer [Supabase CLI](https://supabase.com/docs/guides/cli) og logg inn:

```bash
supabase login
supabase link --project-ref mswgcwwpvkxvkvwejiab
supabase functions deploy send-fax-push --no-verify-jwt
```

`--no-verify-jwt` trengs fordi **Database Webhook** kaller funksjonen uten bruker-JWT.

## 3. Secrets i Supabase

Dashboard → venstre meny (helt til venstre) → **Edge Functions** (⚡ lyn-ikon) → fanen **Secrets**  
*(Ikke under Project Settings → General.)*

Alternativ: CLI nedenfor.

| Secret | Verdi |
|--------|--------|
| `VAPID_PUBLIC_KEY` | Samme som i `push-config.js` |
| `VAPID_PRIVATE_KEY` | Par til public (generer med `npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | f.eks. `mailto:deg@epost.no` |
| `FAX_WEBHOOK_SECRET` | Lang tilfeldig streng du velger selv |

**Viktig:** Den private VAPID-nøkkelen skal **aldri** committes til GitHub.

Eksempel (generer egne nøkler i produksjon):

```bash
npx web-push generate-vapid-keys
```

Oppdater `push-config.js` med **public** og legg **private** kun i Supabase.

CLI (bytt ut med dine verdier — **ikke** lim private key inn i GitHub):

```bash
supabase secrets set VAPID_PUBLIC_KEY="BAnKv-f_W8ilwYAo53BR8kkAtDgNTtu05Eb7ONM94hjYxlDGZQzyJLgrD3lMI5CzPhk0idexEgCzuqGIFkpNT40"
supabase secrets set VAPID_PRIVATE_KEY="din-private-key-her"
supabase secrets set VAPID_SUBJECT="mailto:deg@epost.no"
supabase secrets set FAX_WEBHOOK_SECRET="din-hemmelige-streng"
```

## 4. Database Webhook (utløser push ved ny fax)

Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**

| Felt | Verdi |
|------|--------|
| Name | `fax-incoming-push` |
| Table | `faxes` |
| Events | **Insert** |
| Type | Supabase Edge Function |
| Edge Function | `send-fax-push` |
| HTTP Headers | `x-fax-webhook-secret` = samme verdi som `FAX_WEBHOOK_SECRET` |

Alternativt: HTTP POST til funksjonens URL med samme header hvis du ikke bruker innebygd kobling.

## 5. Deploy frontend (Vercel)

Push til GitHub → Vercel bygger. `sw.js` og `push-config.js` må være med.

## 6. Slik tester du (to telefoner)

1. **Mottaker:** Åpne FaxChat fra **hjemskjerm-ikon** (ikke bare nettleser-fane).
2. Logg inn → tillat **varsler** når telefonen spør.
3. Supabase → Table Editor → `push_subscriptions` → skal ha én rad for brukeren.
4. **Avsender:** Send fax til mottakerens nummer.
5. Mottaker skal få push selv om appen er lukket (eller i bakgrunnen).

## Feilsøking

| Problem | Løsning |
|---------|---------|
| Ingen spørsmål om varsler | Åpne fra hjemskjerm, ikke vanlig Safari-fane |
| Tom `push_subscriptions` | Logg inn på nytt fra hjemskjerm, tillat varsler |
| Fax kommer inn, ingen push | Sjekk webhook + Edge Function **Logs** |
| Push fungerte, sluttet | Abonnement utløpt — logg inn igjen (410 slettes automatisk) |

## iOS

- Krever **iOS 16.4+**
- Appen må være lagt til **Hjem-skjerm**
- Varsler må være på i **Innstillinger → FaxChat** (eller Safari/PWA-navn)
