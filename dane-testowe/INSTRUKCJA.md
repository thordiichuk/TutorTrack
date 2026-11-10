# Dane testowe TutorTrack – jak przetestować wszystkie panele

Wszystkie dane są fikcyjne. Daty: maj 2026 – styczeń 2027 (lekcje do 9 listopada 2026 są przeprowadzone, od 10 listopada zaplanowane).

| Plik | Dla kogo | Co zawiera |
|---|---|---|
| `tutortrack-dane-testowe-korepetytor.json` | Korepetytor nr 1 (plan **Pro**) | 8 uczniów (7 aktywnych, 1 zarchiwizowany), 352 lekcje |
| `tutortrack-dane-testowe-korepetytor-2.json` | Korepetytor nr 2 (plan Free) | 2 uczniów, 44 lekcje – ta sama uczennica Ola Kowalska |
| `tutortrack-dane-testowe-uczen-grafik.json` | Uczennica Ola Kowalska | 14 własnych zajęć: szkoła, basen, pianino, harcerstwo, sprawdziany, wycieczka |
| — | Rodzic Anna Kowalska | Rodzic nie importuje pliku – widzi lekcje Oli przez kod od korepetytora nr 1 |

Na adresy e-mail kont testowych możesz użyć np. `kor1.test@example.com`, `kor2.test@example.com`, `ola.test@example.com`, `anna.test@example.com` (wiadomości z resetem hasła na nie nie dojdą).

---

## 1. Korepetytor nr 1 (Pro)

1. Załóż konto korepetytora: **/rejestracja** (np. imię „Tetiana”).
2. **Ustawienia → Plan → włącz Pro** (tryb testowy, bez płatności). Bez Pro import się nie uda – plik ma 7 aktywnych uczniów.
3. **Ustawienia → Kopia danych → Importuj** → wybierz `tutortrack-dane-testowe-korepetytor.json`.
4. Opcjonalnie: **Ustawienia → Kontakt dla uczniów** – wpisz e-mail i telefon, zaznacz „pokaż”.

**Co jest w danych do sprawdzenia:**
- **Pulpit:** najbliższa lekcja, do zapłaty / opłacone, plan na dziś, 2 lekcje „do potwierdzenia” (z przeszłości, wciąż zaplanowane).
- **Lekcje:** tydzień po tygodniu (‹ ›, Dziś), filtr ucznia i przedmiotu, wyszukiwanie, „Do opłacenia”.
- **Uczniowie:**
  - Kacper Nowak – dwa przedmioty z różnymi stawkami (Matematyka 120 zł, Fizyka 130 zł / 60 min);
  - Yehor Vasylevskyi – Angielski + Polski;
  - Zuzanna Wiśniewska – stała opłata za odwołanie 40 zł;
  - Antoni Lewandowski – bez opłat za odwołanie;
  - Maja Zielińska – zarchiwizowana.
- **Rozliczenia:** nieopłacone lekcje z października i listopada, kilka odwołanych z opłatą, kilka lekcji opłaconych z góry.
- **Notatki przed zajęciami** są wpisane przy lekcjach na najbliższe 2 tygodnie – **uczeń i rodzic nie mogą ich widzieć**.

## 2. Kody dla Oli Kowalskiej

U korepetytora nr 1: **Uczniowie → Ola Kowalska**:
- **„Udostępnij uczniowi”** → **„Utwórz kod dostępu”** → zapisz kod (dla ucznia).
- **„Dostęp dla rodzica”** → **„Utwórz kod od korepetytora”** → zapisz kod (dla rodzica).

## 3. Korepetytor nr 2 (Free) – drugi korepetytor tej samej uczennicy

1. Wyloguj się albo otwórz okno prywatne.
2. Załóż drugie konto korepetytora (np. „Marek”), **bez włączania Pro**.
3. Importuj `tutortrack-dane-testowe-korepetytor-2.json`.
4. **Uczniowie → Ola Kowalska → „Udostępnij uczniowi”** → utwórz i zapisz kod.

Do sprawdzenia: limit planu Free (dodanie 2 kolejnych aktywnych uczniów powinno pokazać informację o Pro), okno „Dostęp dla rodzica” ze znaczkiem Pro.

## 4. Uczennica

1. Załóż konto ucznia: **/uczen/rejestracja**, w polu „Kod od korepetytora” wpisz kod od korepetytora nr 1.
2. **Korepetytorzy → Dodaj kod** → wpisz kod od korepetytora nr 2.
3. **Ustawienia → Kopia zajęć → Importuj zajęcia** → wybierz `tutortrack-dane-testowe-uczen-grafik.json`.

**Co sprawdzić:**
- **Plan:** lekcje od dwóch korepetytorów i własne zajęcia w jednym tygodniu.
- **Kolizje:**
  - piątek 17:30 angielski (korepetytor nr 2) nakłada się z harcerstwem o 18:00;
  - czwartek 12 listopada: dentysta 15:45 nakłada się z matematyką o 16:00.
- **Zadania:** 5 zadań od korepetytora nr 1 i kilka od nr 2, część po terminie.
- **Prośby:** wyślij prośbę o przeniesienie lub odwołanie przyszłej lekcji – korepetytor zobaczy ją na Pulpicie.
- **Podsumowanie miesiąca:** udostępnianie (telefon) / drukowanie (komputer).

## 5. Rodzic

1. Wejdź na stronę główną → **„Dla ucznia” → „Jestem rodzicem”** (lub od razu **/rodzic/rejestracja**).
2. Załóż konto (np. „Anna Kowalska”), w polu „Kod od korepetytora” wpisz **kod dla rodzica** z kroku 2.

**Co sprawdzić:**
- **Pulpit:** najbliższa lekcja Oli, do zapłaty, ostatnie notatki i zadania.
- **Lekcje:** Nadchodzące / Minione, pogrupowane po miesiącach; w oknie lekcji brak notatek przed zajęciami.
- **Płatności:** miesiące ‹ ›, nieopłacone z wcześniejszych miesięcy, podsumowanie do skopiowania.
- **Brak edycji:** rodzic niczego nie zmienia i nie wysyła próśb.
- **Lekcje od korepetytora nr 2 nie są widoczne** – kod rodzica dotyczy tylko korepetytora nr 1.
- **Blokada:** u korepetytora nr 1 wyłącz Pro → panel rodzica pokazuje „Dostęp jest chwilowo wyłączony”; po ponownym włączeniu dane wracają.
- **Limit:** trzecie konto rodzica z tym samym kodem dostanie komunikat, że połączone są już dwa konta.
- **„Nowy kod” / „Wyłącz dostęp”** u korepetytora odłącza rodzica.
