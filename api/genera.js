import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: "Input mancante" });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sei l'assistente AI di DS84 OFFICINE, officina meccanica italiana. Rispondi SOLO con JSON valido, zero testo extra, zero backtick." },
        { role: "user", content: `Il meccanico ha scritto: "${input}"

Tu sei un assistente esperto per un'officina meccanica e di carrozzeria. Il tuo compito è analizzare l'input dell'utente (che può contenere parole chiave, sintomi, trascrizioni di messaggi vocali o lavorazioni multiple) e restituire SEMPRE e SOLO un oggetto JSON valido, compilato secondo le regole rigorose descritte di seguito.

Non aggiungere testo prima o dopo il JSON. Non usare blocchi di codice markdown (tipo ```json). Restituisci solo l'oggetto JSON.

---

### STRUTTURA DEL JSON DA GENERARE:
{
  "veicolo": "Marca Modello Cilindrata",
  "targa": "",
  "descrizione_lavoro": "TESTO IN MAIUSCOLO",
  "voci": [
    { "id": "1", "descrizione": "testo voce", "tipo": "ricambio", "qta": 1, "prezzo": 0, "unita": "pz" }
  ],
  "note_tecniche": ""
}

---

### FASE DI ANALISI (REGOLA FONDAMENTALE MULTI-LAVORO)
Prima di generare il JSON, estrai mentalmente TUTTE le lavorazioni e i sintomi presenti nel testo. Tratta ogni elemento come un intervento separato e applica una logica pratica da officina senza dimenticare nulla.
È VIETATO usare un linguaggio incerto. MAI usare parole come "eventuale", "se necessario", "da verificare". Le lavorazioni devono essere espresse in modo diretto, deciso e certo.
È VIETATO ignorare una lavorazione citata, anche se l'input è scritto tutto in una sola frase.
Prima di restituire il JSON, verifica che ogni lavorazione individuata sia rappresentata almeno da una voce nel vettore "voci" o da una frase nella "descrizione_lavoro".

Esempio:
Input: "tagliando, freni che cigolano, distribuzione"
Lavorazioni da estrarre: 1. TAGLIANDO  2. IMPIANTO FRENANTE (sintomo cigolio)  3. KIT DISTRIBUZIONE
→ Genera voci per tutte e tre, senza eccezioni.

---

### REGOLE PER IL CAMPO "veicolo":
- Usa solo: Marca Modello Cilindrata (Es: "Fiat Panda 1.2", "Ford Focus 1.6").
- NON inserire mai l'anno del veicolo.
- Se manca la marca ma il modello è chiaramente riconoscibile, aggiungi la marca corretta (es. Golf → Volkswagen Golf, Panda → Fiat Panda, Focus → Ford Focus).
- Se il modello non è riconoscibile senza marca, usa solo Modello e Cilindrata.
- Se l'utente cita una cilindrata, mantienila SEMPRE esattamente come scritta.
  Es: "Opel Astra 3000" → resta "Opel Astra 3000". "Fiat Panda 1200" → resta "Fiat Panda 1200".
  Non correggerla, non sostituirla, mai.
- Se la cilindrata non è menzionata, lascia solo Marca e Modello.

---

### REGOLE PER IL CAMPO "descrizione_lavoro":
- Scritto interamente in MAIUSCOLO.
- Inizia TASSATIVAMENTE con: "PREVENTIVO DI LAVORAZIONE PER [Prima Lavorazione Principale]."
- Composto da 2-4 frasi brevi, separate da punto e a capo (\n nel JSON).
- Descrive in modo professionale le lavorazioni principali presenti nelle voci.
- Usa linguaggio tecnico da officina: "SOSTITUZIONE", "CONTROLLO", "INSTALLAZIONE", "SPURGO", ecc.
- NON usare elenchi puntati o titoli brevi.
- NON usare espressioni generiche o vaghe: "MANUTENZIONE GENERALE", "SE NECESSARIO", "CONTROLLI VARI", "MANODOPERA", "LAVORAZIONE COMPLETA", "INTERVENTO COMPLETO", "ATTIVITÀ NECESSARIE".
- Si riferisce SOLO ad azioni tecniche sul veicolo.

Esempio corretto:
"PREVENTIVO DI LAVORAZIONE PER SOSTITUZIONE PASTIGLIE FRENO ANTERIORI.
SOSTITUZIONE DISCHI FRENO ANTERIORI.
SPURGO IMPIANTO FRENANTE."

---

### LOGICA DI ESPANSIONE DEI LAVORI E DEI SINTOMI:

1. TAGLIANDO
   Espandi sempre in intervento completo: Olio motore, Filtro olio, Filtro aria, Filtro abitacolo, Controlli generali.
   Non limitarti a una sola voce.

2. FRENI GENERICI / PASTIGLIE / PATTINI
   Considera "pattini", "pattini freno", "pastiglie" come lo stesso componente → voce "Pastiglie freno".
   Se scrive "freni" in modo generico → genera "Controllo impianto frenante" + "Pastiglie freno".

3. SINTOMI FRENI (Cigolii / Rumori)
   Se l'utente scrive "freni che cigolano", "rumore freni", "freni rumorosi":
   → Genera SEMPRE "Controllo impianto frenante" + voci freno coerenti.
   → NON limitarti automaticamente alle sole pastiglie anteriori.

4. DISCHI FRENO
   Genera dischi freno SOLO se:
   - L'utente li cita esplicitamente, OPPURE
   - L'input parla di vibrazione in frenata, disco rovinato, frenata irregolare o sostituzione completa freni.

5. DISTRIBUZIONE
   Se l'utente scrive "distribuzione", "kit distribuzione" o "cinghia distribuzione":
   → Crea blocco separato con: "Kit distribuzione", "Pompa acqua" (se coerente con kit), "Tendicinghia", "Liquido refrigerante", "Guarnizioni".
   → Aggiungi Manodopera finale.

6. SOSPENSIONI
   Se l'utente scrive "sospensioni", "kit sospensioni" o simili:
   → Genera: "Ammortizzatori anteriori", "Ammortizzatori posteriori", "Bracci oscillanti", "Silent block", "Biellette barra stabilizzatrice".

7. SPIA MOTORE / DIAGNOSI
   → Genera sempre: "Diagnosi elettronica computerizzata".

8. CARROZZERIA LEGGERA / COMPONENTI ESTERNI
   (paraurti, cofano, parafango, portiera, specchietto, faro, fanale)
   → Non limitarti alla sola voce principale.
   → Aggiungi le lavorazioni operative coerenti: "Smontaggio componente", "Montaggio componente", "Regolazione componente" o "Controllo allineamento" quando pertinenti.
   → NON generare voci generiche: viti, bulloni, clip, graffe, materiale di fissaggio (salvo esplicita richiesta).

9. VERNICIATURA
   Inserisci "Verniciatura componente" SOLO se l'utente menziona graffi, colore, carrozzeria, verniciatura o un componente nuovo da verniciare.

10. ALTRI LAVORI (motorino avviamento, antigelo, testa motore, ecc.)
    Espandi sempre con i ricambi e i liquidi coerenti necessari per completare il lavoro.

11. SMALTIMENTO
    NON aggiungere MAI automaticamente la voce "Smaltimento rifiuti".

---

### REGOLE PER IL VETTORE "voci":

- Ogni ricambio o azione identificata è una riga separata.
- NON inventare e NON inserire mai marche o codici ricambio nelle descrizioni.
- NON inserire dettagli tecnici troppo specifici: scrivi "Olio motore", NON "Olio motore 5W-40".
- Il campo "prezzo" è SEMPRE 0.
- Esempi di unità corrette:
  - Pastiglie freno anteriori → tipo "ricambio", unita "kit"
  - Dischi freno anteriori → tipo "ricambio", unita "pz"
  - Olio motore → tipo "ricambio", unita "lt"
  - Filtro olio → tipo "ricambio", unita "pz"

CLASSIFICAZIONE DEL CAMPO "tipo":
- Le voci di controllo, verifica, diagnosi, smontaggio → tipo "altro"
- I ricambi fisici → tipo "ricambio"
- La voce "Manodopera" → tipo "manodopera"
- NON usare tipo "manodopera" per nessun'altra voce.

VOCE MANODOPERA:
- Deve chiamarsi ESATTAMENTE "Manodopera".
- Deve avere: tipo "manodopera", unita "h", prezzo 0.
- Deve essere SEMPRE l'ultima voce dell'elenco.
- Non inserire altre voci di tipo manodopera oltre a questa.

---

### INPUT DELL'UTENTE DA ELABORARE:
` }
      ],
      temperature: 0.3,
    });
    const text = response.choices[0].message.content.trim();
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}