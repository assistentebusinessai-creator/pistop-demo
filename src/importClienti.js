import { createClient } from "@supabase/supabase-js";
import { CLIENTI_ARUBA } from "./clientiAruba.js";

// ⚠️ METTI QUI I TUOI DATI SUPABASE
const supabaseUrl = "https://ytfnepbphttounnurcqa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0Zm5lcGJwaHR0b3VubnVyY3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzQ1NTAsImV4cCI6MjA5MjkxMDU1MH0.KQ79ZTz3S3TK6TK3i5U1Tk5k2xEOlzIoLVorP5vmbVE";

const supabase = createClient(supabaseUrl, supabaseKey);

async function importaClienti() {
  console.log("🚀 Inizio import clienti...");

  const clientiFormattati = CLIENTI_ARUBA.map(cliente => ({
    nome: cliente.nome || null,
    tipo: cliente.tipo || null,
    identificativo: cliente.identificativo || null,
    codice_fiscale: cliente.codiceFiscale || null,
    piva: cliente.piva || null,
    indirizzo: cliente.indirizzo || null,
    email: cliente.email || null,
    fonte: cliente.fonte || null,

    origine: "aruba",
    fiscal_complete: true
  }));

  const { data, error } = await supabase
    .from("clienti")
    .insert(clientiFormattati);

  if (error) {
    console.error("❌ Errore import:", error);
  } else {
    console.log("✅ Clienti importati!");
    console.log(data);
  }
}

importaClienti();