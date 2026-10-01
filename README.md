# Slovickuj.cz

Osobní aplikace pro správu anglicko-českých slovíček a jejich opakování. Aplikace používá Next.js App Router, Auth.js s Google přihlášením, Prisma a PostgreSQL na Neon.

## Funkce

- Soukromé balíčky a slovíčka pro přihlášeného uživatele.
- Cyklické opakování s dalším kolem pouze z chybně zodpovězených slov.
- Směr EN → CZ, CZ → EN a náhodný mix.
- Hromadný import z textu (středník, tabulátor nebo čárka), inline úprava, hledání a export JSON/CSV.
- Výslovnost přes Web Speech API, uživatelská rychlost a automatické přehrávání.
- Responzivní české rozhraní pro desktop i mobil.

## Lokální konfigurace

1. Zkopíruj `.env.example` do `.env`.
2. Vlož pooled PostgreSQL connection string z Neon do `DATABASE_URL` a přímý (nepoolovaný) string do `DIRECT_URL`, který Prisma používá pro migrace.
3. V Google Cloud Console vytvoř OAuth klienta pro web. Redirect URI je `https://<tvoje-doména>/api/auth/callback/google` (pro lokální vývoj `http://localhost:3000/api/auth/callback/google`). Doplň `AUTH_GOOGLE_ID` a `AUTH_GOOGLE_SECRET`.
4. Nastav `AUTH_SECRET` na náhodnou hodnotu, například příkazem `npx auth secret`.
5. Nainstaluj balíčky příkazem `npm install`.
6. Vytvoř tabulky v databázi příkazem `npx prisma db push`.
7. Spusť vývojový server příkazem `npm run dev`.

Pro nasazení použij Vercel Build Command `npx prisma migrate deploy && npm run build`, aby se před sestavením bezpečně aplikovaly verzované migrace.

Proměnné `.env` patří do Vercel Environment Variables pro Production, Preview a Development. Do GitHubu se tajné hodnoty neukládají.

## Datový model

Každý balíček patří uživateli a každá operace na datech ověřuje vlastnictví balíčku. Odstranění účtu smaže jeho balíčky, slovíčka, nastavení, session a autentizační propojení. Výslovnost běží v prohlížeči a zvuk se neposílá na server.
