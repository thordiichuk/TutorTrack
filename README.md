# TutorTrack

Dziennik korepetytora z panelem ucznia – aplikacja w jednym pliku `index.html`.

Wersja na żywo: https://claude.ai/artifact/TGfY4RMaMMiYRtFE3b8SaD

## Funkcje

**Dla korepetytora**
- uczniowie (kilka przedmiotów i stawek, archiwum, opłaty za odwołanie),
- lekcje (lista i kalendarz, notatki przed i po zajęciach, praca domowa z terminem),
- rozliczenia miesięczne, eksport CSV, statystyki,
- plan Free (do 3 aktywnych uczniów) i symulowany plan Pro,
- udostępnianie uczniowi panelu kodem dostępu.

**Dla ucznia (wszystko bezpłatne)**
- konto ucznia: rejestracja i logowanie (symulacja, zapis w przeglądarce),
- plan tygodnia: lekcje od korepetytorów + własne zajęcia,
- własny grafik (zajęcia co tydzień lub jednorazowe),
- prace domowe z terminami i odhaczaniem,
- podsumowanie miesiąca (lekcje, godziny, kwoty, notatki),
- kilka kodów od różnych korepetytorów.

## Jak działa przesyłanie danych

- Dziennik korepetytora jest zapisany w `localStorage` przeglądarki.
- Gdy korepetytor utworzy kod dostępu dla ucznia, dane tego ucznia (terminy, tematy,
  statusy, kwoty, notatki po zajęciach, prace domowe) są szyfrowane AES-GCM kluczem
  wyprowadzonym z kodu i zapisywane w bazie artefaktu w `inbox/<sha256(kod)>`.
  Notatki przed zajęciami nie są wysyłane.
- Uczeń wpisuje kod w panelu ucznia, odczytuje dokument i odszyfrowuje go w przeglądarce.
  Zmiany korepetytora docierają na żywo.
- Grafik ucznia i odhaczone zadania są zapisane tylko w przeglądarce ucznia.

Baza to `db` artefaktu claude.ai (reguła: odczyt `view`, zapis `admin`), więc
zapisywać może tylko właściciel artefaktu (lub edytor). Uczeń potrzebuje konta claude.ai.
Poza claude.ai (np. otwarty lokalnie plik) działa dziennik i grafik ucznia, bez przesyłania.
