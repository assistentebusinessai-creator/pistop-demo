import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/genera", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || !input.trim()) return res.status(400).json({ error: "Input mancante" });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sei l'assistente AI di DS84 OFFICINE. Rispondi SOLO con JSON valido, zero testo extra, zero backtick." },
        { role: "user", content: `Il meccanico ha scritto: "${input}"\n\nGenera: {"veicolo":"Marca Modello Anno","targa":"","descrizione_lavoro":"titolo","voci":[{"id":"1","descrizione":"voce","tipo":"ricambio","qta":1,"prezzo":0,"unita":"pz"}],"note_tecniche":""}` }
      ],
      temperature: 0.3,
    });

    const text = response.choices[0].message.content.trim();
    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (e) {
      res.status(500).json({ error: "JSON non valido", raw: text });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server" });
  }
});

app.post('/api/notifica-risposta', async (req, res) => {
  const { stato, veicolo, numero } = req.body;
  
  try {
    const webpush = require('web-push');
    
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VITE_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { data } = await supabase
      .from('push_subscriptions')
      .select('subscription');

    const messaggio = {
      title: stato === 'accettato' ? '✅ Preventivo Accettato!' : '❌ Preventivo Rifiutato',
      body: `${veicolo} — ${numero}`,
      url: '/archivio'
    };

    for (const row of data || []) {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify(messaggio)
      );
    }

    res.json({ ok: true });
  } catch(e) {
    console.error(e);
    res.json({ ok: false });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log("Server attivo su porta " + PORT));