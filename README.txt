Hochladen nach GitHub (Repository HS-Ansbach-Unternehmensrechnung)
1. Im Repository alle alten Dateien und Ordner löschen.
2. Den INHALT dieses Ordners hochladen: index.html und den Ordner material.
3. Bewerbungsseite:  https://cneusser.github.io/HS-Ansbach-Unternehmensrechnung/
   Material:         https://cneusser.github.io/HS-Ansbach-Unternehmensrechnung/material/
   Live-Quiz leiten: https://cneusser.github.io/HS-Ansbach-Unternehmensrechnung/material/quiz/?set=pflicht&host=1

Live-Quiz einrichten (einmalig, rund 10 Minuten, kostenlos)
1. https://console.firebase.google.com öffnen, mit Google-Konto anmelden, "Projekt hinzufügen", Name z. B. ansbach-quiz, Google Analytics ausschalten.
2. Links "Build" > "Realtime Database" > "Datenbank erstellen", Standort Belgien (europe-west1), "Im gesperrten Modus starten".
3. Reiter "Regeln": den Inhalt der Datei material/quiz/database.rules.json einfügen, "Veröffentlichen".
4. Projektübersicht > Symbol </> (Web-App hinzufügen), Name ansbach-quiz, kein Hosting. Das angezeigte firebaseConfig-Objekt kopieren.
5. In material/quiz/config.js die Zeile  window.FIREBASE_CONFIG = null;  ersetzen durch  window.FIREBASE_CONFIG = { ... };  (Inhalt aus Schritt 4). Der apiKey darf öffentlich sein, den Zugriff regeln die Regeln aus Schritt 3.
6. Hochladen, dann mit zwei Handys testen: Laptop öffnet die Lehrpersonen-Adresse, Handys scannen den QR-Code.
Ohne Schritt 5 läuft das Quiz im Demo-Modus (nur Fenster im selben Browser). Plan B im Hörsaal: Farbkarten.
