# TutorTrack

Dziennik korepetytora z bezpłatnym panelem ucznia.

- **Frontend:** React 19 + TypeScript (Vite) – `web/`
- **Backend:** Node.js + TypeScript (Fastify) + PostgreSQL – `server/`
- Jeden serwer obsługuje API (`/api/...`) i zbudowaną stronę.

Poprzednia wersja (jeden plik HTML, dane w przeglądarce) jest w `legacy/index.html`.

## Funkcje

**Korepetytor:** konto z hasłem, uczniowie (kilka przedmiotów i stawek, archiwum,
opłaty za odwołanie), lekcje (lista i kalendarz, notatki przed i po zajęciach,
praca domowa z terminem), rozliczenia miesięczne i eksport CSV, statystyki,
plan Free (do 3 aktywnych uczniów) / Pro (symulowany zakup), kosz (Pro),
motywy, szablony notatek, kopia danych (eksport/import JSON), tryb demo.

**Uczeń (bezpłatnie):** konto z hasłem, łączenie z korepetytorem kodem dostępu
(można mieć kilku korepetytorów), plan tygodnia, własny grafik, prace domowe
z odhaczaniem, podsumowanie miesiąca. Dane są na koncie – działają na każdym urządzeniu.

**Bezpieczeństwo:** hasła haszowane scrypt, sesje w ciasteczku `httpOnly`
(`SameSite=Lax`, `Secure` w produkcji), ochrona przed żądaniami z obcych stron,
limit prób logowania, nagłówki CSP / X-Frame-Options, walidacja danych (zod).
Uczeń widzi tylko swoje lekcje, bez notatek „przed zajęciami”.
Reset hasła przez e-mail (SMTP).

## Uruchomienie lokalne

Wymagania: Node.js 22+, PostgreSQL 14+.

```bash
cp .env.example .env            # ustaw DATABASE_URL
npm run install:all
npm run build
npm start                       # http://localhost:3000 (migracje uruchamiają się same)
```

Tryb deweloperski (automatyczne przeładowanie):

```bash
npm run dev:server              # API na :3000
npm run dev:web                 # strona na :5173 (proxy /api → :3000)
```

Albo w Dockerze (z bazą danych):

```bash
docker compose up --build
```

Testy API (wymagają działającej bazy z `DATABASE_URL`):

```bash
npm test
```

## Wdrożenie (Neon + Render)

Instrukcja krok po kroku: **[DEPLOY.md](DEPLOY.md)**. W skrócie: baza PostgreSQL w Neon
(Frankfurt), strona w Render z `render.yaml` (Docker, Frankfurt), zmienne `DATABASE_URL`
i `APP_URL`.

Ten sam obraz (`Dockerfile`) działa też na Railway, Fly.io, DigitalOcean
czy własnym serwerze – potrzebna jest tylko zmienna `DATABASE_URL`.

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `DATABASE_URL` | adres bazy PostgreSQL |
| `DATABASE_SSL` | `true`, jeśli baza wymaga TLS bez zaufanego certyfikatu |
| `APP_URL` | publiczny adres strony (linki w e-mailach) |
| `PORT` | port serwera (domyślnie 3000) |
| `SMTP_URL`, `MAIL_FROM` | poczta wychodząca; bez nich linki resetu hasła trafiają do logu serwera |

## Co jeszcze nie jest prawdziwe

- **Płatności za Pro** są symulowane. Do prawdziwych płatności potrzebne jest konto
  u operatora (np. Stripe lub Przelewy24) i webhook aktywujący plan.
- Regulamin i polityka prywatności to wersje robocze – przed startem warto je
  skonsultować prawnie (RODO).
