/* Question bank for Versus: each of us answers about themself, the other guesses.
   type "pick": two options ("@self" / "@other" stand for the person answering and their partner) · "scale": 1–5 between two labels · "rank": order three things (favourite first). */
(function () {
  const CATEGORIES = {
    alltag: "Alltag",
    essen: "Essen & Trinken",
    wir: "Wir zwei",
    freizeit: "Freizeit & Popkultur",
    gewagt: "Gewagt 🔥"
  };

  const pick = (id, cat, q, a, b) => ({ id, cat, type: "pick", q, options: [a, b] });
  const scale = (id, cat, q, low, high) => ({ id, cat, type: "scale", q, low, high });
  const rank = (id, cat, q, a, b, c) => ({ id, cat, type: "rank", q, options: [a, b, c] });

  const QUESTIONS = [
    /* ---------- Alltag ---------- */
    pick("al1", "alltag", "Wie startest du lieber in den Tag?", "Ganz entspannt, mit Zeit", "Snooze bis zur letzten Minute"),
    pick("al2", "alltag", "Wo bist du produktiver?", "Morgens", "Abends"),
    pick("al3", "alltag", "Wie sieht dein Schreibtisch meistens aus?", "Ordentlich", "Kreatives Chaos"),
    pick("al4", "alltag", "Duschen – wann?", "Morgens", "Abends"),
    pick("al5", "alltag", "Wie packst du für eine Reise?", "Lange vorher mit Liste", "Am Abend davor, irgendwie"),
    pick("al6", "alltag", "Was ist schlimmer?", "Zu spät kommen", "Viel zu früh da sein"),
    pick("al7", "alltag", "Wie gehst du ans Handy, wenn eine unbekannte Nummer anruft?", "Ich gehe ran", "Niemals"),
    pick("al8", "alltag", "Einkaufen gehst du …", "Mit Einkaufsliste", "Spontan, was mir gefällt"),
    scale("al9", "alltag", "Wie sehr bist du ein Morgenmensch?", "Bitte nicht ansprechen", "Hellwach ab 6"),
    scale("al10", "alltag", "Wie wichtig ist dir Ordnung in der Wohnung?", "Egal", "Alles hat seinen Platz"),
    scale("al11", "alltag", "Wie gut kannst du Nein sagen?", "Gar nicht", "Ganz locker"),
    scale("al12", "alltag", "Wie viel Zeit verbringst du am Handy?", "Kaum", "Viel zu viel"),
    scale("al13", "alltag", "Wie schnell bist du genervt, wenn etwas nicht klappt?", "Die Ruhe selbst", "Sofort auf 180"),
    rank("al14", "alltag", "Was ist dir an einem freien Sonntag am wichtigsten?", "Ausschlafen", "Etwas unternehmen", "Gutes Essen"),
    rank("al15", "alltag", "Welche Aufgabe im Haushalt magst du am wenigsten?", "Bad putzen", "Wäsche zusammenlegen", "Abwaschen"),
    rank("al16", "alltag", "Womit entspannst du am liebsten?", "Musik", "Serie", "Rausgehen"),

    /* ---------- Essen & Trinken ---------- */
    pick("es1", "essen", "Kaffee oder Tee?", "Kaffee", "Tee"),
    pick("es2", "essen", "Süß oder salzig?", "Süß", "Salzig"),
    pick("es3", "essen", "Pizza: wie?", "Klassisch Margherita", "Mit allem drauf"),
    pick("es4", "essen", "Frühstück …", "Ein Muss", "Brauche ich nicht"),
    pick("es5", "essen", "Im Restaurant bestellst du …", "Immer das Gleiche", "Immer etwas Neues"),
    pick("es6", "essen", "Pommes mit …", "Ketchup", "Mayo"),
    pick("es7", "essen", "Kochen oder bestellen?", "Selbst kochen", "Lieferdienst"),
    pick("es8", "essen", "Paella oder Franzbrötchen?", "Paella", "Franzbrötchen"),
    scale("es9", "essen", "Wie scharf darf es sein?", "Bloß nicht", "Je schärfer, desto besser"),
    scale("es10", "essen", "Wie gern probierst du exotisches Essen?", "Lieber nicht", "Her damit"),
    scale("es11", "essen", "Wie gut kochst du (ehrlich)?", "Nudeln mit Pesto", "Sternekoch"),
    scale("es12", "essen", "Wie hungrig-gereizt wirst du?", "Gar nicht", "Hangry pur"),
    rank("es13", "essen", "Was isst du am liebsten?", "Pasta", "Sushi", "Burger"),
    rank("es14", "essen", "Welcher Snack beim Film?", "Popcorn", "Chips", "Schokolade"),
    rank("es15", "essen", "Welches Getränk am Abend?", "Wein", "Cocktail", "Alkoholfrei"),
    rank("es16", "essen", "Welche Küche zuerst?", "Spanisch", "Italienisch", "Asiatisch"),

    /* ---------- Wir zwei ---------- */
    pick("wi1", "wir", "Wer hat zuerst Gefühle gehabt?", "@self", "@other"),
    pick("wi2", "wir", "Wer von uns entschuldigt sich schneller?", "@self", "@other"),
    pick("wi3", "wir", "Wer ist bei uns romantischer?", "@self", "@other"),
    pick("wi4", "wir", "Wer schreibt nach einem Streit zuerst?", "@self", "@other"),
    pick("wi5", "wir", "Was war unser erstes Date für dich?", "Total aufregend", "Ganz entspannt"),
    pick("wi6", "wir", "Lieber ein Abend …", "Nur wir zwei zuhause", "Zusammen unterwegs"),
    pick("wi7", "wir", "Die Fernbeziehung ist für dich eher …", "Eine Herausforderung", "Eine Bestätigung"),
    pick("wi8", "wir", "Überraschungen: lieber …", "Planen und überraschen", "Überrascht werden"),
    scale("wi9", "wir", "Wie sehr vermisst du mich gerade?", "Geht so", "Unendlich"),
    scale("wi10", "wir", "Wie eifersüchtig bist du?", "Gar nicht", "Sehr"),
    scale("wi11", "wir", "Wie kitschig darf unser Jahrestag sein?", "Ganz schlicht", "Rosenblätter überall"),
    scale("wi12", "wir", "Wie gern kuschelst du?", "Gelegentlich", "Immer und überall"),
    scale("wi13", "wir", "Wie oft denkst du am Tag an mich?", "Ab und zu", "Ständig"),
    rank("wi14", "wir", "Was zeigt dir am meisten, dass ich dich liebe?", "Zeit zusammen", "Liebe Worte", "Kleine Gesten"),
    rank("wi15", "wir", "Was machen wir beim nächsten Treffen zuerst?", "Kuscheln", "Essen gehen", "Rausgehen"),
    rank("wi16", "wir", "Welche Erinnerung ist dir am liebsten?", "Unser erstes Treffen", "Unser erstes Date", "Unser Jahrestag"),

    /* ---------- Freizeit & Popkultur ---------- */
    pick("fr1", "freizeit", "Strand oder Berge?", "Strand", "Berge"),
    pick("fr2", "freizeit", "Film oder Serie?", "Film", "Serie"),
    pick("fr3", "freizeit", "Hamburg oder Alicante?", "Hamburg", "Alicante"),
    pick("fr4", "freizeit", "Konzert oder Festival?", "Konzert", "Festival"),
    pick("fr5", "freizeit", "Buch oder Hörbuch?", "Buch", "Hörbuch"),
    pick("fr6", "freizeit", "Urlaub: lieber …", "Alles geplant", "Einfach treiben lassen"),
    pick("fr7", "freizeit", "Brettspiel-Abend: wie spielst du?", "Will unbedingt gewinnen", "Hauptsache Spaß"),
    pick("fr8", "freizeit", "Sport schauen oder selbst machen?", "Schauen", "Selbst machen"),
    scale("fr9", "freizeit", "Wie sehr magst du Horrorfilme?", "Nie im Leben", "Je gruseliger, desto besser"),
    scale("fr10", "freizeit", "Wie gut kannst du tanzen?", "Lieber nicht", "Dancing Queen/King"),
    scale("fr11", "freizeit", "Wie abenteuerlustig bist du im Urlaub?", "Liegestuhl", "Fallschirmsprung"),
    scale("fr12", "freizeit", "Wie laut singst du im Auto mit?", "Gar nicht", "Volle Lautstärke"),
    rank("fr13", "freizeit", "Wohin als Nächstes zusammen?", "Städtetrip", "Strandurlaub", "Roadtrip"),
    rank("fr14", "freizeit", "Welches Genre zuerst?", "Komödie", "Thriller", "Romantik"),
    rank("fr15", "freizeit", "Was machst du an einem Regentag?", "Serien-Marathon", "Backen", "Ausschlafen"),
    rank("fr16", "freizeit", "Welche Jahreszeit ist deine liebste?", "Sommer", "Herbst", "Winter"),

    /* ---------- Gewagt ---------- */
    pick("ge1", "gewagt", "Erster Kuss: wer hat angefangen?", "@self", "@other"),
    pick("ge2", "gewagt", "Licht an oder aus?", "An", "Aus"),
    pick("ge3", "gewagt", "Morgens oder abends?", "Morgens", "Abends"),
    pick("ge4", "gewagt", "Spontan oder lieber mit Vorfreude?", "Spontan", "Mit Vorfreude"),
    pick("ge5", "gewagt", "Was macht dich schneller schwach?", "Ein Blick", "Eine Berührung"),
    pick("ge6", "gewagt", "Flirten per Nachricht: …", "Kann ich gut", "Lieber persönlich"),
    scale("ge7", "gewagt", "Wie mutig bist du, Neues auszuprobieren?", "Lieber vorsichtig", "Immer dabei"),
    scale("ge8", "gewagt", "Wie sehr magst du Dessous-Überraschungen?", "Nicht so wichtig", "Unbedingt"),
    scale("ge9", "gewagt", "Wie sehr hast du mich beim letzten Abschied vermisst?", "Ein bisschen", "Kaum auszuhalten"),
    scale("ge10", "gewagt", "Wie gern bekommst du Komplimente zu deinem Körper?", "Ist mir unangenehm", "Immer gern"),
    rank("ge11", "gewagt", "Was ist am verführerischsten?", "Ein Duft", "Eine Stimme", "Ein Lächeln"),
    rank("ge12", "gewagt", "Wo am liebsten?", "Im Bett", "Unter der Dusche", "Woanders"),
    rank("ge13", "gewagt", "Was zuerst nach langer Zeit getrennt?", "Küssen", "Reden", "Ins Bett"),
    rank("ge14", "gewagt", "Was gefällt dir am meisten an mir?", "Augen", "Lächeln", "Hände")
  ];

  const api = { CATEGORIES, QUESTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.VersusQuestions = api;
})();
