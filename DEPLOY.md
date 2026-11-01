# Wdrożenie TutorTrack: Neon (baza) + Render (strona)

Całość zajmuje około 15 minut i na start jest bezpłatna. Dane są przechowywane we Frankfurcie (UE).

| Co | Gdzie | Koszt na start |
|---|---|---|
| Baza danych PostgreSQL | [neon.tech](https://neon.tech) | 0 zł – baza nie wygasa i nie jest usuwana |
| Strona i API | [render.com](https://render.com) | 0 zł – strona „zasypia” po ok. 15 min bez ruchu |

---

## Krok 1. Baza danych w Neon

1. Wejdź na **neon.tech** i kliknij **Sign up**. Najprościej zalogować się kontem GitHub.
2. Utwórz projekt (**Create project**):
   - **Project name:** `tutortrack`
   - **Postgres version:** najnowsza (16 lub nowsza)
   - **Region:** **AWS Europe Central 1 (Frankfurt)**
3. Po utworzeniu projektu otwórz **Dashboard → Connect** (lub **Connection Details**).
4. Ustaw:
   - **Database:** `neondb` (domyślna)
   - **Connection pooling:** **wyłączone** (zwykłe połączenie, bez `-pooler` w adresie)
5. Skopiuj **connection string**. Wygląda mniej więcej tak:
   ```
   postgresql://neondb_owner:HASLO@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Upewnij się, że na końcu jest `?sslmode=require`.

> Zapisz ten adres w bezpiecznym miejscu (np. menedżerze haseł). Zawiera hasło do bazy – nie wysyłaj go nikomu.

Tabel nie trzeba tworzyć – aplikacja zrobi to sama przy pierwszym uruchomieniu.

---

## Krok 2. Strona w Render

1. Wejdź na **render.com** i kliknij **Get Started**. Zaloguj się kontem **GitHub**.
2. Gdy Render poprosi o dostęp do repozytoriów, zezwól na dostęp do **thordiichuk/TutorTrack**.
3. W panelu kliknij **New → Blueprint**.
4. Wybierz repozytorium **TutorTrack** i kliknij **Connect**. Render odczyta plik `render.yaml`.
5. Render poprosi o wartości zmiennych:
   - **DATABASE_URL** – wklej connection string z Neon (krok 1.5).
   - **APP_URL** – na razie wpisz `https://tutortrack.onrender.com`
     (jeśli Render nada inny adres, poprawisz to w kroku 3).
   - **SMTP_URL** i **MAIL_FROM** – możesz zostawić puste (patrz krok 4).
6. Kliknij **Apply** / **Deploy Blueprint**.
7. Poczekaj kilka minut, aż status zmieni się na **Live**. Postęp widać w zakładce **Logs**.
   Na końcu logu powinny pojawić się linie `migration applied: 001_init.sql` i `Server listening`.

---

## Krok 3. Sprawdź adres i działanie

1. Na górze strony usługi **tutortrack** w Render jest adres strony, np. `https://tutortrack-abcd.onrender.com`.
2. Jeśli różni się od tego, który wpisałaś w `APP_URL`:
   **Environment → APP_URL → Edit** → wklej właściwy adres → **Save Changes** (Render sam uruchomi stronę ponownie).
3. Otwórz adres strony i sprawdź:
   - `https://TWOJ-ADRES/api/health` → powinno pokazać `{"ok":true}`,
   - załóż konto korepetytora, dodaj ucznia i lekcję,
   - utwórz kod dla ucznia i w drugim oknie (tryb incognito) załóż konto ucznia z tym kodem.

---

## Krok 4. E-maile z resetem hasła (opcjonalnie, ale zalecane)

Bez poczty funkcja „Nie pamiętasz hasła?” nie wyśle e-maila (link trafi tylko do logów Render).

Najprościej użyć darmowego planu **Brevo** (300 e-maili dziennie) lub **Resend**:

1. Załóż konto w Brevo (**brevo.com**) → **SMTP & API → SMTP**.
2. Zanotuj: serwer `smtp-relay.brevo.com`, port `587`, login i klucz SMTP.
3. W Render: **Environment** → ustaw:
   - **SMTP_URL** = `smtp://LOGIN:KLUCZ_SMTP@smtp-relay.brevo.com:587`
   - **MAIL_FROM** = `TutorTrack <adres@zweryfikowany-w-brevo.pl>`
4. **Save Changes**, a potem przetestuj „Nie pamiętasz hasła?” na stronie logowania.

> Jeśli login lub klucz zawiera znaki `@`, `:` lub `/`, zamień je w adresie odpowiednio na `%40`, `%3A`, `%2F`.

---

## Krok 5. Bezpieczeństwo kont

- Włącz **logowanie dwuetapowe (2FA)** w GitHub, Render i Neon.
- Nie udostępniaj nikomu wartości `DATABASE_URL` ani `SMTP_URL`.

---

## Kopie zapasowe

- **Neon (darmowy plan)** pozwala przywrócić bazę do stanu sprzed kilku godzin
  (**Branches → Restore**). Dłuższą historię daje plan płatny.
- **Korepetytor** może w każdej chwili pobrać własną kopię: **Ustawienia → Eksportuj kopię danych**.
- Dodatkowo raz na jakiś czas możesz zrobić pełną kopię bazy na komputerze:
  ```bash
  pg_dump "TWOJ_DATABASE_URL" > tutortrack-kopia.sql
  ```

---

## Aktualizacje strony

Każdy nowy commit na gałęzi `main` w GitHubie Render wdraża automatycznie.
Zmiany w bazie (migracje) aplikacja wykonuje sama przy starcie.

---

## Gdy pojawią się prawdziwi użytkownicy

- W Render zmień plan usługi z **Free** na **Starter** (ok. 7 $ / mies.) –
  strona przestanie „zasypiać” i będzie od razu odpowiadać.
- W Neon rozważ plan **Launch** – dłuższa historia do przywracania bazy.
- Własną domenę (np. `tutortrack.pl`) dodasz w Render: **Settings → Custom Domains**,
  a potem ustaw `APP_URL` na nowy adres.

---

## Najczęstsze problemy

| Objaw | Co zrobić |
|---|---|
| W logach Render: `password authentication failed` | Skopiuj ponownie connection string z Neon i wklej jako `DATABASE_URL`. |
| W logach: `self-signed certificate` lub błąd SSL | Upewnij się, że adres kończy się na `?sslmode=require`. Jeśli nadal występuje, dodaj zmienną `DATABASE_SSL` = `true`. |
| Strona ładuje się ok. minuty | To „zasypianie” darmowego planu Render – normalne. Plan Starter to usuwa. |
| Link w e-mailu z resetem hasła prowadzi na zły adres | Popraw `APP_URL` w Render (bez `/` na końcu). |
| Nie mogę się zalogować po wdrożeniu | Sprawdź, czy otwierasz stronę przez `https://`. |
