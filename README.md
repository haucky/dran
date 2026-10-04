# Dran

Ein ruhiger Reminder, welche Übung heute dran ist. Er zeigt, wie lange eine Übung her ist, ob sie fällig ist (grün), möglich ist (orange) oder noch Pause hat (grau). Jeder Satz bekommt die Bewertung „leicht“ oder „schwer“.

Statische Progressive Web App ohne Backend und ohne Build-Schritt. Alle Daten liegen lokal im Browser.

## Dateien

```
index.html             Einstieg
styles.css             Aussehen
app.js                 Die ganze App-Logik
sw.js                  Service Worker (offline + Updates)
manifest.webmanifest   Name, Icons, Farben für die Installation
icons/                 Logo als SVG und PNG
```

## Auf GitHub Pages veröffentlichen

1. Neues Repo anlegen, z. B. `dran`. Öffentlich ist am einfachsten, denn Pages für private Repos braucht einen bezahlten Plan.
2. **Den Inhalt dieses Ordners** ins Hauptverzeichnis des Repos legen, nicht den Ordner selbst. `index.html` muss also direkt im Repo liegen.
3. Committen und pushen (oder auf github.com per „Add file → Upload files“ hochladen).
4. Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
5. Nach ca. einer Minute läuft die App unter `https://<dein-name>.github.io/dran/`.

### Worauf du bei der PWA achten musst

- **Relative Pfade nicht ändern.** Alle Pfade sind relativ (`./`, `app.js` statt `/app.js`), weil die App unter `/dran/` liegt und nicht unter `/`. Deshalb darfst du das Repo auch beliebig umbenennen.
- **HTTPS** ist bei GitHub Pages automatisch aktiv. Ohne HTTPS gibt es keinen Service Worker und keine Installation.
- **Updates:** Nach einem Push sieht die installierte App die neue Version meist erst **beim zweiten Öffnen**. Beim ersten Start lädt sie die neue Version im Hintergrund. Bei größeren Änderungen erhöhst du in `sw.js` die Zeile `const VERSION = 'dran-v1'` auf `dran-v2` usw. Wenn du eine neue Datei hinzufügst, trägst du sie dort auch in `ASSETS` ein.
- **Eigene Domain** (optional): Settings → Pages → Custom domain. Achtung: Eine neue Adresse bedeutet neuen Speicher. Daten von der alten Adresse vorher exportieren und danach importieren.

## Auf dem Handy installieren

- **iPhone:** Die Seite in **Safari** öffnen → Teilen → „Zum Home-Bildschirm“. Wichtig: Die installierte App hat ihren eigenen Speicher, getrennt vom Safari-Tab. Wenn du sie installierst, fängst du dort frisch mit den Beispieldaten an.
- **Android:** Die Seite in Chrome öffnen → Menü → „App installieren“.

## Daten

- Gespeichert wird im `localStorage` des Geräts unter dem Schlüssel `dran.data`. Jede Person und jedes Gerät hat eigene Daten. Freunde können also einfach denselben Link nutzen.
- Beim ersten Start gibt es Beispieldaten. Unter „Daten & Backup“ kannst du alles löschen und mit eigenen Übungen anfangen.
- **Backup:** „Daten & Backup → Daten exportieren“ erzeugt eine JSON-Datei. Auf dem Handy öffnet sich das Teilen-Menü, dort kannst du die Datei z. B. in iCloud oder Google Drive speichern. „Backup importieren“ stellt sie wieder her, auch auf einem neuen Handy. Die App erinnert dich leise, wenn das letzte Backup älter als 30 Tage ist.
- Was die Daten löschen kann: die App vom Home-Bildschirm entfernen, „Website-Daten löschen“ in den Browsereinstellungen, oder auf dem iPhone eine Seite, die nur im Safari-Tab (nicht installiert) läuft und mehrere Wochen nicht geöffnet wurde.

## Lokal ausprobieren

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Ein Doppelklick auf `index.html` reicht nicht, weil der Service Worker einen Server braucht.

## Logik

- **Fällig (grün):** Seit dem letzten Mal sind mindestens „Mindestens alle“-Tage vergangen, oder die Übung wurde noch nie gemacht.
- **Möglich (orange):** Die Pause ist vorbei, aber die Übung ist noch nicht fällig.
- **Pause (grau):** Seit dem letzten Mal sind weniger Tage vergangen als bei „Pause mindestens“ eingestellt.
- **Optional (hellblau):** Die Übung wird nie fällig. Nach ihrer Pause steht sie ganz unten bei „Möglich“.
- „↑ zuletzt alles leicht“ erscheint, wenn beim letzten Workout jeder Satz als leicht bewertet wurde.

## Eintragen

- **Schnell:** Tippe auf den Haken ✓ in der Liste. Die Übung wird mit den geplanten Werten eingetragen, ohne Bewertung. Danach kannst du 5 Sekunden lang auf „Rückgängig“ tippen.
- **Ausführlich:** Tippe auf die Übung → „Workout starten“ → bewerte jeden Satz mit leicht oder schwer.

## Zeit-Übungen und Timer

- Stellst du bei einer Übung „Zählen in: Zeit“ ein, wachsen die Schritte mit: bis 1 min in 5 s, bis 5 min in 30 s, darüber in 5 min (für Yin Yoga & Co.).
- Im Workout hat jeder Satz einen Timer-Knopf. Du musst ihn nicht nutzen, leicht/schwer geht auch ohne.
- **Vorlauf** (pro Übung: Aus, 3, 5 oder 10 s): Erst zählt der Timer runter, dann klingelt es zum Start.
- Am Ende klingelt es dreimal. Danach läuft die Zeit weiter (+0:12). „Stopp & übernehmen“ trägt die tatsächliche Zeit in den Satz ein.
- **Glocke** antippen = Probe-Klingeln.
- Grenzen einer Web-App: Klingeln geht nur, solange die App offen ist und das Display an. Die App versucht, das Display wachzuhalten. Vibration gibt es nur auf Android.

## Updates

Wenn du eine neue Version pushst, erhöhst du in `sw.js` die `VERSION` (z. B. `dran-v2` → `dran-v3`). Die installierte App lädt die neue Version beim nächsten Öffnen im Hintergrund und zeigt sie spätestens beim Öffnen danach an. Die Daten bleiben dabei erhalten. Neue Datenfelder bekommen beim Laden automatisch einen Standardwert.
