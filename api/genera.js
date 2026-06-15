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

Non aggiungere testo prima o dopo il JSON. Non usare blocchi di codice markdown.



Genera questo JSON: 
{
  "veicolo": "Marca Modello Cilindrata",
  "targa": "",
  "descrizione_lavoro": "blocco descrittivo professionale in MAIUSCOLO, su 2-4 righe, coerente con le voci",
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


REGOLA FONDAMENTALE MULTI-LAVORO:
L'input dell'utente può contenere più lavori nella stessa frase.
Devi prima individuare TUTTE le lavorazioni citate e poi generare voci per ognuna.

Esempio:
"tagliando, freni che cigolano, distribuzione"

Deve generare voci per:
1. TAGLIANDO
2. CONTROLLO/SISTEMA FRENANTE PER RUMORE O CIGOLIO
3. DISTRIBUZIONE / KIT DISTRIBUZIONE

È vietato ignorare una lavorazione citata.
È vietato trasformare un sintomo in una sola riparazione certa.

Se l'utente scrive "freni che cigolano", "rumore freni", "freni rumorosi":
- genera sempre una voce "Controllo impianto frenante"
- genera una voce "Pastiglie freno" solo come lavorazione coerente
- NON limitarti alle sole pastiglie anteriori
- NON inventare "dischi freno" se non richiesti, salvo che l'utente dica dischi, vibrazione, frenata irregolare o sostituzione completa freni

Se l'utente scrive "distribuzione", "kit distribuzione", "cinghia distribuzione":
- genera sempre un blocco lavoro separato
- genera voci coerenti come "Kit distribuzione", "Pompa acqua" se coerente con kit distribuzione, e manodopera finale
- Se l'input è generico ma chiaro, espandilo in modo pratico da officina.
- Considera "pattini", "pattini freno", "pastiglie" e "pastiglie freno" come lo stesso componente e genera la voce "Pastiglie freno".

- Se scrive “tagliando”, considera un tagliando completo: olio motore, filtro olio, filtro aria, controlli generali e manodopera.
- Se scrive “freni” in modo generico, genera controllo impianto frenante e pastiglie freno.
- Se scrive “freni che cigolano”, “rumore freni” o “freni rumorosi”, interpreta il testo come sintomo: genera controllo impianto frenante e voci freno coerenti, senza limitarti automaticamente alle sole pastiglie anteriori.
- Genera dischi freno solo se l’utente li cita o se parla di vibrazione, disco rovinato, frenata irregolare o sostituzione completa freni.
- Se scrive “spia motore”, genera una voce di diagnosi elettronica.
- Non inventare lavori non richiesti o non coerenti.
- se l'utente scrive più lavori nella stessa frase, separali mentalmente e genera voci per ciascuno (es. "tagliando e freni" → voci per entrambi).
- Non limitarti al primo lavoro menzionato se l'input suggerisce più lavorazioni (es. "tagliando e freni" → voci per entrambi).

- Per ogni lavoro, genera tutte le voci normalmente necessarie per eseguirlo, senza usare espressioni come "SE NECESSARIO" o condizioni simili. Le lavorazioni devono essere espresse in modo diretto e deciso.
- Non limitarti a una singola voce per lavoro.
- Anche lavori come "motorino avviamento", "antigelo", "testa motore", devono essere espansi in modo coerente.
- Se l'input riguarda carrozzeria leggera o parti esterne del veicolo come paraurti, cofano, parafango, portiera, specchietto, faro o fanale, genera voci coerenti con quel tipo di intervento.

- Per interventi su paraurti, cofano, parafanghi, portiere, specchietti, fari o fanali non limitarti alla sola voce principale. Genera anche lavorazioni operative coerenti come smontaggio componente, montaggio componente, regolazione componente o controllo allineamento, quando pertinenti. Non generare voci generiche come viti, bulloni, clips, graffe o materiale di fissaggio, salvo esplicita richiesta dell'utente.

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
- Non utilizzare mai manodopera, lavorazione completa, intervento completo o attività necessarie come frase della descrizione_lavoro.
- La descrizione deve riferirsi esclusivamente agli interventi tecnici sul veicolo.
- NON aggiungere mai "DEL VEICOLO" nella prima frase. 
  Scrivi solo il tipo di intervento (es. "PREVENTIVO DI LAVORAZIONE PER TAGLIANDO COMPLETO.")
- L'ultima frase della descrizione_lavoro deve concludere 
  con la lavorazione più significativa, non con un ricambio minore.



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