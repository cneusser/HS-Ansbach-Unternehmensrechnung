window.QUIZSETS = {
  pflicht: { title: 'Blitzquiz Rückstellungen', kicker: 'Buchführung und Bilanzierung · 2. Semester', seconds: 15, qr: 'qr_pflicht.png', questions: [
    { q: 'Für eine Werbekampagne im März 2027 sollen 50.000 EUR zurückgestellt werden. Rückstellung zum 31.12.2026?', o: ['Ja, Pflicht', 'Wahlrecht', 'Nein, Verbot'], a: 2,
      why: 'Keine Verpflichtung gegenüber Dritten, kein Katalogfall: § 249 Abs. 2 Satz 1 HGB.' },
    { q: 'Die 2026 unterlassene Dachreparatur wird am 20. März 2027 nachgeholt. Rückstellung?', o: ['Ja, Pflicht', 'Wahlrecht', 'Nein, Verbot'], a: 0,
      why: 'Unterlassene Instandhaltung, nachgeholt in den ersten drei Monaten: § 249 Abs. 1 Satz 2 Nr. 1 HGB.' },
    { q: 'Buchungssatz bei Bildung der Gewährleistungsrückstellung am 31.12.2026?', o: ['Rückstellung an Bank', 'Aufwand an Rückstellung', 'Rückstellung an Ertrag'], a: 1,
      why: 'Bei Bildung fließt kein Geld. Der Aufwand trifft 2026, die Gegenbuchung ist die Rückstellung.' } ] },
  wahl: { title: 'Blitzquiz KI prüfen', kicker: 'Controlling im Zeitalter der KI', seconds: 15, qr: 'qr_wahl.png', questions: [
    { q: 'Der KI-Kommentar nennt „gestiegene Stahlpreise“. Wie prüfen Sie das?', o: ['Nachrechnen', 'Quelle verlangen', 'Gar nicht, klingt plausibel'], a: 1,
      why: 'Eine Ursache steht in keiner Tabelle. Sie wird belegt, nicht gerechnet.' },
    { q: 'Zweiter Lauf, gleicher Auftrag, gleiche Daten, andere Ursache. Was folgt?', o: ['Modell defekt', 'Ursache gilt als offen', 'Besseren Lauf nehmen'], a: 1,
      why: 'Was zwischen Läufen wechselt, ist nicht belegt. Den besseren Lauf zu wählen wäre Auswahl nach Gefallen.' },
    { q: 'Welches Element im Auftrag senkt den Prüfaufwand am stärksten?', o: ['Höflicher Ton', 'Ursache nur mit Quelle', 'Längerer Text'], a: 1,
      why: 'Wer die Quelle je Ursache erzwingt, prüft Belege statt Sätze.' } ] }
};
