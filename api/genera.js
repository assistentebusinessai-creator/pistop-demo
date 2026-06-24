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
Genera questo JSON:
{
"veicolo": "Marca Modello Cilindrata",
"targa": "",
"descrizione_lavoro": "blocco descrittivo professionale in MAIUSCOLO, su 1,2,3 o 4 righe, coerente con le macro-lavorazioni richieste",
"voci": [
{ "id":"1", "descrizione":"testo voce", "tipo":"ricambio", "qta":1, "prezzo":0, "unita":"pz" }
],
"note_tecniche": ""
}
Ricambi esempi di riferimento per il campo "voci": "Pastiglie freno anteriori" (kit), "Dischi freno anteriori" (pz), "Olio motore" (lt), "Filtro olio" (pz), "Filtro aria" (pz), "Filtro abitacolo" (pz), "Kit distribuzione" (kit), "Pompa acqua" (pz).
Manodopera: descrizione SEMPRE "Manodopera", tipo "manodopera", unita "h", SEMPRE ultima voce.
Regole:
CAMPO "veicolo":
 NON inserire l'anno del veicolo.
 Usare solo Marca Modello e cilindrata (es: Fiat Panda 1.2, Ford Focus 1.6).
 Se l'utente cita una marca, mantenerla SEMPRE.
 Se il modello è chiaramente recognizable, aggiungere la marca (es. Golf → Volkswagen, Panda → Fiat, Focus → Ford).
 Se l'utente cita una cilindrata, mantenerla SEMPRE.
 NON sostituire mai una cilindrata indicata dall'utente con una diversa.
 Se manca la marca, usare solo Modello e cilindrata.
 Se la cilindrata non viene menzionata, lasciare solo Marca e Modello.
 Non aggiungere mai automaticamente la voce "Smaltimento rifiuti".
INTERPRETAZIONE INPUT E GENERAZIONE "VOCI" (IL CARRELLO DEI RICAMBI):
REGOLA FONDAMENTALE MULTI-LAVORO: L'input può contenere più lavori. Identifica TUTTE le lavorazioni e genera OGNI singolo ricambio/componente necessario per quel lavoro nel campo "voci", espandendolo in modo pratico da officina.
 Se scrive “tagliando”: inserisci SEMPRE come voci separate: Olio motore, Filtro olio, Filtro aria, Filtro abitacolo.
 Se scrive “distribuzione”, “kit distribuzione” o “cinghia distribuzione”: inserisci sempre come voci separate il Kit distribuzione e la Pompa acqua.
 Se scrive “freni” o sintomi di freni rumorosi: inserisci il controllo impianto frenante e le pastiglie freno. Genera i dischi solo se esplicitamente citati o in caso di vibrazioni/frenata irregolare.
 Se scrive “spia motore”: genera una voce di diagnosi elettronica.
 Considera "pattini" e "pastiglie" come lo stesso componente ("Pastiglie freno").
 
 Inserisci "Verniciatura componente" solo se l'utente parla di verniciatura, colore, graffi o carrozzeria.
 Nei ricambi NON inventare marche, NON mettere codici tecnici e NON mettere specifiche di viscosità (es. NO "5W40", scrivi solo "Olio motore"). Prezzo sempre 0. Non usare mai frasi come "eventuale" o "se necessario" nelle voci.
AGISCI COME UN CAPOFFICINA ESPERTO.

Le voci generate devono essere quelle che un meccanico professionista inserirebbe realmente in un preventivo da consegnare a un cliente.

Non generare voci scolastiche, teoriche o poco utilizzate in officina.

Ogni voce deve avere una reale utilità pratica per l'intervento richiesto.

La descrizione_lavoro deve essere scritta come farebbe un responsabile accettazione di officina: professionale, sintetica e orientata alle macro-lavorazioni.

I dettagli dei ricambi appartengono esclusivamente al campo "voci".

LIBRERIA LAVORI DA OFFICINA

Quando l'utente cita una lavorazione generica, non creare una sola voce generica.
Espandi sempre la lavorazione in un blocco pratico di voci che un meccanico valuterebbe realmente in preventivo.

Se scrive "sospensioni", "rumore sospensioni", "assetto":
- Controllo sistema sospensioni
- Ammortizzatori
- Supporti ammortizzatori
- Tamponi/parapolvere ammortizzatori
- Biellette barra stabilizzatrice


Se scrive "frizione", "pedale frizione", "frizione slitta":
- Kit frizione
- Cuscinetto reggispinta
- Volano
- Olio cambio

Se scrive "ammortizzatori":
- Ammortizzatori
- Supporti ammortizzatori
- Tamponi/parapolvere


REGOLA RIGOROSA PER "descrizione_lavoro" (IL RIASSUNTO DEL PREVENTIVO):
La descrizione_lavoro deve essere esclusivamente un riassunto professionale e macroscopico degli interventi da eseguire sul veicolo. NON deve essere un elenco puntato e NON deve assolutamente elencare i singoli ricambi o i componenti minuti (i dettagli dei ricambi vanno solo nel campo "voci").
 Deve essere in MAIUSCOLO.
 Deve iniziare con "PREVENTIVO DI LAVORAZIONE PER ...".
 NON aggiungere mai "DEL VEICOLO" nella prima frase.
 Deve essere composto da 2-3 frasi brevi (una per riga), dove ogni riga descrive una macro-lavorazione richiesta dall'utente (es. TAGLIANDO COMPLETO, SOSTITUZIONE KIT DISTRIBUZIONE, RIPRISTINO IMPIANTO FRENANTE).
 Usare un linguaggio deciso da officina (SOSTITUZIONE, CONTROLLO, MANUTENZIONE).
 NON usare frasi generiche inutili come "MANUTENZIONE GENERALE" o "ATTIVITÀ NECESSARIE" "EFFETTUAZIONE"
 Scrivi in italiano professionale e naturale.
Evita ripetizioni e concetti duplicati.
Non descrivere la stessa lavorazione con parole diverse.
Se le lavorazioni principali sono già descritte chiaramente, fermati senza aggiungere altre frasi.
Non usare frasi generiche come "garantire una guida sicura e confortevole", "ripristinare le prestazioni originali" o formule simili se non strettamente necessarie.
Ogni frase deve descrivere una lavorazione realmente presente nelle voci generate.
ATTENZIONE: Il fatto che un ricambio (es. Filtro aria o Pompa acqua) non sia esplicitamente scritto nel testo della descrizione_lavoro NON significa che debba essere rimosso. Le "voci" devono contenere tutti i pezzi reali usati dal meccanico per quella categoria di lavoro`
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