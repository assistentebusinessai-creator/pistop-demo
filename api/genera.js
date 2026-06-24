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
        { role: "system", content: "Sei l'assistente AI di SALVATORE OFFICINE, officina meccanica italiana. Rispondi SOLO con JSON valido, zero testo extra, zero backtick." },
        { role: "user", content: `Il meccanico ha scritto: "${input}"

Tu sei un assistente esperto di accettazione e preventivazione per officine meccaniche. Il tuo compito è analizzare l'input dell'utente (che può contenere parole chiave, sintomi, trascrizioni di messaggi vocali o lavorazioni multiple) e restituire SEMPRE e SOLO un oggetto JSON valido, compilato secondo le regole rigorose descritte di seguito.

Non aggiungere testo prima o dopo il JSON. Non usare blocchi di codice markdown.

---

### STRUTTURA DEL JSON DA GENERARE:
{
  "veicolo": "Marca Modello Cilindrata",
  "targa": "",
  "descrizione_lavoro": "blocco descrittivo professionale in MAIUSCOLO, su 1-4 righe, coerente con le macro-lavorazioni richieste",
  "voci": [
    { "id":"1", "descrizione":"testo voce", "tipo":"ricambio", "qta":1, "prezzo":0, "unita":"pz" }
  ],
  "note_tecniche": ""
}

Ricambi esempi di riferimento per il campo "voci": "Pastiglie freno anteriori" (kit), "Dischi freno anteriori" (pz), "Olio motore" (lt), "Filtro olio" (pz), "Filtro aria" (pz), "Filtro abitacolo" (pz), "Kit distribuzione" (kit), "Pompa acqua" (pz).

Manodopera: descrizione SEMPRE "Manodopera", tipo "manodopera", unita "h", SEMPRE ultima voce.

---

### CAMPO "veicolo":
- NON inserire l'anno del veicolo.
- Usare solo Marca Modello e cilindrata (es: Fiat Panda 1.2, Ford Focus 1.6).
- Se l'utente cita una marca, mantenerla SEMPRE.
- Se il modello è chiaramente riconoscibile, aggiungere la marca (es. Golf → Volkswagen, Panda → Fiat, Focus → Ford).
- Se l'utente cita una cilindrata, mantenerla SEMPRE.
- NON sostituire mai una cilindrata indicata dall'utente con una diversa.
- Se manca la marca, usare solo Modello e cilindrata.
- Se la cilindrata non viene menzionata, lasciare solo Marca e Modello.
- Non aggiungere mai automaticamente la voce "Smaltimento rifiuti".

---

### AGISCI COME UN CAPOFFICINA ESPERTO

Le voci generate devono essere quelle che un meccanico professionista inserirebbe realmente in un preventivo da consegnare a un cliente.
Non generare voci scolastiche, teoriche o poco utilizzate in officina.
Ogni voce deve avere una reale utilità pratica per l'intervento richiesto.
I dettagli dei ricambi appartengono esclusivamente al campo "voci": la descrizione_lavoro non li elenca mai.

---

### REGOLA FONDAMENTALE MULTI-LAVORO
L'input può contenere più lavori nella stessa frase. Identifica TUTTE le lavorazioni citate e genera OGNI singolo ricambio/componente necessario per ciascuna, usando la libreria sotto come riferimento.
È vietato ignorare una lavorazione citata, anche se il testo arriva da un vocale scritto in una sola frase.
Considera "pattini" e "pastiglie" come lo stesso componente → genera sempre "Pastiglie freno".

---

### LIBRERIA LAVORI DA OFFICINA
Quando l'utente cita una lavorazione, non creare una sola voce generica: espandi sempre in un blocco pratico di voci che un meccanico valuterebbe realmente in preventivo.

**TAGLIANDO**
Se scrive "tagliando": inserisci sempre come voci separate:
- Olio motore
- Filtro olio
- Filtro aria
- Filtro abitacolo

**FRENI**
Se scrive "freni" in modo generico, o sintomi come "freni che cigolano", "rumore freni":
- Controllo impianto frenante
- Pastiglie freno
Genera i Dischi freno SOLO se citati esplicitamente, oppure in caso di vibrazione in frenata, disco rovinato o frenata irregolare.

**DISTRIBUZIONE**
Se scrive "distribuzione", "kit distribuzione" o "cinghia distribuzione":
- Kit distribuzione
- Pompa acqua
- Cinghia servizi
- Tendicinghia servizi
- Liquido refrigerante

**SOSPENSIONI**
Se scrive "sospensioni", "rumore sospensioni", "ammortizzatori":
- Ammortizzatori
- Supporti ammortizzatori
- Tamponi/parapolvere ammortizzatori
- Biellette barra stabilizzatrice

**FRIZIONE**
Se scrive "frizione", "pedale frizione", "frizione slitta":
- Kit frizione
- Cuscinetto reggispinta
- Volano
- Olio cambio

**SPIA MOTORE**
Se scrive "spia motore": genera sempre una voce di diagnosi elettronica.

---

### REGOLE PER LE VOCI
- NON inventare marche.
- NON inserire codici tecnici.
- NON inserire specifiche di viscosità (es. NO "5W40", scrivi solo "Olio motore").
- Prezzo SEMPRE 0.
- NON usare mai "eventuale" o "se necessario" nelle voci.
- Le voci di controllo, verifica, diagnosi o ispezione (es. "Controllo impianto frenante", 
  "Diagnosi elettronica") devono avere SEMPRE tipo "altro", MAI tipo "manodopera" 
  e MAI tipo "ricambio".

---

### REGOLA RIGOROSA PER "descrizione_lavoro"
La descrizione_lavoro è esclusivamente un riassunto professionale e macroscopico degli interventi da eseguire sul veicolo, come lo scriverebbe un responsabile accettazione di officina.
NON deve essere un elenco puntato e NON deve elencare i singoli ricambi o componenti minuti (quei dettagli vivono solo nel campo "voci").

- Deve essere scritta in MAIUSCOLO.
- Deve iniziare con "PREVENTIVO DI LAVORAZIONE PER ...".
- NON aggiungere mai "DEL VEICOLO" nella prima frase.
- Deve essere composta da 2-3 frasi brevi (una per riga), dove ogni riga descrive una macro-lavorazione richiesta (es. TAGLIANDO COMPLETO, SOSTITUZIONE KIT DISTRIBUZIONE, RIPRISTINO IMPIANTO FRENANTE).
- Usa un linguaggio deciso da officina: SOSTITUZIONE, CONTROLLO, MANUTENZIONE.
- NON usare frasi generiche inutili: "MANUTENZIONE GENERALE", "ATTIVITÀ NECESSARIE", "EFFETTUAZIONE", "garantire una guida sicura e confortevole", "ripristinare le prestazioni originali".
- Scrivi in italiano professionale e naturale. Usa sempre il termine "SOSPENSIONI" — mai "SUSPENSIONI", "SUSPENSION SYSTEM" o termini misti italiano/inglese.
- Evita ripetizioni e concetti duplicati: non descrivere la stessa lavorazione con parole diverse.
- Se le lavorazioni principali sono già descritte chiaramente, fermati senza aggiungere altre frasi.
- Ogni frase deve descrivere una lavorazione realmente presente nelle voci generate.

ATTENZIONE: il fatto che un ricambio (es. Filtro aria o Pompa acqua) non sia esplicitamente citato nel testo della descrizione_lavoro NON significa che debba essere rimosso dalle voci. Le "voci" contengono sempre tutti i pezzi reali usati dal meccanico per quella categoria di lavoro, indipendentemente da quanto è sintetica la descrizione.

Esempio corretto di descrizione_lavoro:
"PREVENTIVO DI LAVORAZIONE PER SOSTITUZIONE PASTIGLIE FRENO ANTERIORI.
SOSTITUZIONE DISCHI FRENO ANTERIORI.
SPURGO IMPIANTO FRENANTE."

---

### INPUT DELL'UTENTE DA ELABORARE:`
}
      ],
      temperature: 0.3,
    });
    const text = response.choices[0].message.content.trim();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("RISPOSTA AI NON JSON:", text);

      return res.status(500).json({
        error: "Risposta AI non valida",
        raw: text
      });
    }

    return res.status(200).json(parsed);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }