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

Genera questo JSON:
{
  "veicolo": "Marca Modello Cilindrata",
  "targa": "",
  "descrizione_lavoro": "blocco descrittivo professionale in MAIUSCOLO, su 2-4 righe, coerente con le voci"",
  "voci": [
    { "id":"1", "descrizione":"testo voce", "tipo":"ricambio", "qta":1, "prezzo":0, "unita":"pz" }
  ],
  "note_tecniche": ""
}

Ricambi esempi: "Pastiglie freno anteriori" (kit), "Dischi freno anteriori" (pz), "Olio motore 5W-40" (lt), "Filtro olio" (pz).
Manodopera: descrizione SEMPRE "Manodopera", tipo "manodopera", unita "h", SEMPRE ultima voce.
Regole:
CAMPO "veicolo":
- NON inserire l'anno del veicolo.
- Usare solo Marca Modello e cilindrata (es: Fiat Panda 1.2, Ford Focus 1.6).
- Se l'utente cita una marca, mantenerla SEMPRE.
- Se il modello è chiaramente riconoscibile, aggiungere la marca (es. Golf → Volkswagen, Panda → Fiat, Focus → Ford).
- Se l'utente cita una cilindrata, mantenerla SEMPRE.
- NON sostituire mai una cilindrata indicata dall'utente con una diversa.
- Se l'utente dice "Opel Astra 3000", il risultato deve essere "Opel Astra 3000".
- Se l'utente dice "Fiat Panda 1200", il risultato deve essere "Fiat Panda 1200".
- Se manca la marca, usare solo Modello e cilindrata.
- Se la cilindrata non viene menzionata, lasciare solo Marca e Modello.
- Non aggiungere mai automaticamente la voce "Smaltimento rifiuti".
ATTENZIONE: è vietato usare un linguaggio incerto.

INTERPRETAZIONE INPUT:
- Se l'input è generico ma chiaro, espandilo in modo pratico da officina.
- Se scrive “tagliando”, considera un tagliando completo: olio motore, filtro olio, filtro aria/abitacolo se coerente, controlli generali e manodopera.
- Se scrive “freni”, genera le voci coerenti: pastiglie, dischi solo se richiesti o chiaramente impliciti, controllo impianto frenante e manodopera.
- Se scrive “spia motore”, genera una voce di diagnosi elettronica.
- Non inventare lavori non richiesti o non coerenti.
- se l'utente scrive più lavori nella stessa frase, separali mentalmente e genera voci per ciascuno (es. "tagliando e freni" → voci per entrambi).
- Non limitarti al primo lavoro menzionato se l'input suggerisce più lavorazioni (es. "tagliando e freni" → voci per entrambi).
- Ogni lavoro scritto deve essere trattato come un intervento completo da officina.
- Per ogni lavoro, genera tutte le voci normalmente necessarie per eseguirlo, senza usare espressioni come "SE NECESSARIO" o condizioni simili. Le lavorazioni devono essere espresse in modo diretto e deciso.
- Non limitarti a una singola voce per lavoro.
- Anche lavori come "motorino avviamento", "antigelo", "testa motore", devono essere espansi in modo coerente.
- Se l'input riguarda carrozzeria leggera o parti esterne del veicolo come paraurti, cofano, parafango, portiera, specchietto, faro o fanale, genera voci coerenti con quel tipo di intervento.

- Per interventi su paraurti, cofano, parafanghi, portiere, specchietti, fari o fanali non limitarti alla sola voce principale. Genera anche le lavorazioni e i materiali normalmente necessari allo smontaggio, montaggio e fissaggio del componente, oltre alla Manodopera.

- Inserisci "Verniciatura componente" solo se l'utente parla di verniciatura, colore, graffi, carrozzeria, componente nuovo da verniciare o ripristino estetico.
- Non usare mai frasi come "eventuale", "se necessario" o "da verificare" nelle voci.
Prima di generare le voci, estrai mentalmente tutte le lavorazioni presenti nel testo utente e trattale come interventi separati. Anche se il testo arriva da un vocale ed è scritto in una sola frase, devi riconoscere tutti i lavori citati.
Prima di restituire il JSON verifica che ogni lavorazione individuata sia rappresentata almeno da una voce o da una frase nella descrizione_lavoro.

CLASSIFICAZIONE VOCI:
- Le voci di controllo, verifica o smaltimento NON devono avere tipo "manodopera".
- Solo la voce chiamata esattamente "Manodopera" deve avere tipo "manodopera".
- Tutte le altre voci devono avere tipo "ricambio" o "altro".

- NON inventare marche.
- niente marche nei ricambi
- niente codici
- prezzo sempre 0
- solo JSON valido
descrizione_lavoro deve essere un testo professionale da preventivo.

Regole:
- Deve essere in MAIUSCOLO.
- Deve essere scritto in italiano corretto (no parole straniere o traduzioni sbagliate).
- Deve essere composto da 2-3 frasi brevi (una per riga).
- Deve descrivere le lavorazioni principali presenti nelle voci.
- Deve usare un linguaggio da officina (es. "SOSTITUZIONE", "CONTROLLO", "INSTALLAZIONE").
- Deve iniziare con "PREVENTIVO DI LAVORAZIONE PER ...".
- NON deve essere un elenco puntato.
- NON deve essere un titolo breve.
- NON usare frasi generiche tipo "MANUTENZIONE GENERALE", "SE NECESSARIO", "CONTROLLI VARI".

Importante:
- Può aggiungere lavorazioni implicite (es. controllo livelli, controllo generale) SOLO se strettamente necessarie al lavoro richiesto.
- NON deve inventare ricambi o dettagli tecnici specifici (es. codici, marche, viscosità olio).
NON inserire dettagli tecnici troppo specifici (es. 5W40, codici ricambi, marche).
Esempio:
"PREVENTIVO DI LAVORAZIONE PER SOSTITUZIONE PASTIGLIE FRENO ANTERIORI.
SOSTITUZIONE DISCHI FRENO ANTERIORI.
SPURGO IMPIANTO FRENANTE."`
}
      ],
      temperature: 0.3,
    });
    const text = response.choices[0].message.content.trim();
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}