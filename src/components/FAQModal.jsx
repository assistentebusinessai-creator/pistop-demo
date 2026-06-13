import { useState } from "react";

const faqs = [
  {
    id: 1,
    domanda: "➡️📱 Devo installare qualcosa?",
    risposta:
      "No. PitStop funziona come una web app. Ti basta aggiungerla alla schermata Home del telefono.",
  },
  {
    id: 2,
    domanda: "📱 Il cliente deve installare qualcosa?",
    risposta:
      "No. Riceve un semplice link WhatsApp e può aprire il preventivo da qualsiasi telefono.",
  },
  {
    id: 3,
    domanda: "🗒️ Posso inviare o stampare il preventivo?",
    risposta:
      "Sì. Il cliente può scaricare il PDF oppure puoi stamparlo e consegnarlo a mano.",
  },
  {
    id: 4,
    domanda: "✅ Come funziona l'accettazione?",
    risposta:
      "Il cliente apre il link e può accettare o rifiutare il preventivo. L'officina riceve una notifica.",
  },
  {
    id: 5,
    domanda: "🏢 Posso usare il mio logo?",
    risposta:
      "Sì. Preventivi e PDF possono essere personalizzati con il logo e i dati della tua officina. Se non hai un logo possiamo aiutarti a realizzarlo.",
  },
  {
    id: 6,
    domanda: "🗂️ Se elimino un preventivo lo perdo?",
    risposta: "No. Lo storico resta disponibile e consultabile.",
  },
  {
    id: 7,
    domanda: "🚗 Posso vedere lo storico di un veicolo?",
    risposta:
      "Sì. Tutti i lavori e i preventivi effettuati sullo stesso veicolo restano consultabili nel tempo.",
  },
  {
    id: 8,
    domanda: "🗒️ Come funziona la fatturazione elettronica?",
    risposta:
      "PitStop genera il file XML pronto per essere caricato nel tuo software di fatturazione elettronica.",
  },
  {
    id: 9,
    domanda: "🔒 I dati restano miei?",
    risposta:
      "Sì. Clienti, veicoli e preventivi restano associati esclusivamente alla tua officina.",
  },
  {
    id: 10,
    domanda: "👀 Chi può vedere i miei dati?",
    risposta:
      "Solo gli utenti autorizzati della tua officina. Nessun'altra officina può accedere ai tuoi clienti o ai tuoi preventivi.",
  },
];

export default function FAQModal() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => setExpanded(expanded === id ? null : id);

  return (
    <>
      <button style={styles.triggerBtn} onClick={() => setOpen(true)}>
        ❓ FAQ
      </button>

      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <div style={styles.iconWrap}>
                <span style={styles.icon}>❓</span>
              </div>
              <button style={styles.closeBtn} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <h2 style={styles.title}>Domande Frequenti</h2>
            <p style={styles.subtitle}>
              Tutto quello che devi sapere su PitStop.
            </p>

            <div style={styles.list}>
              {faqs.map((faq, idx) => (
                <div key={faq.id} style={styles.item}>
                  <button style={styles.question} onClick={() => toggle(faq.id)}>
                    <span style={styles.questionText}>{faq.domanda}</span>
                    <span
                      style={{
                        ...styles.chevron,
                        transform:
                          expanded === faq.id ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      ▾
                    </span>
                  </button>

                  {expanded === faq.id && (
                    <div style={styles.answer}>{faq.risposta}</div>
                  )}

                  {idx < faqs.length - 1 && <div style={styles.divider} />}
                </div>
              ))}
            </div>

            <button style={styles.ctaBtn} onClick={() => setOpen(false)}>
              HO CAPITO
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  
  triggerBtn: {
    background: "#FFD700",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "12px",
    padding: "14px 20px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.5px",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modal: {
    background: "#2a2a2a",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "420px",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: "24px 20px 20px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
    border: "1px solid #3a3a3a",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  iconWrap: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "#FFD700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: "20px" },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: "20px",
    cursor: "pointer",
    lineHeight: 1,
    padding: "4px 8px",
    borderRadius: "8px",
  },
  title: {
    color: "#FFD700",
    fontSize: "26px",
    fontWeight: "800",
    margin: "0 0 8px",
    letterSpacing: "-0.3px",
  },
  subtitle: {
    color: "#ccc",
    fontSize: "14px",
    margin: "0 0 20px",
    lineHeight: "1.5",
  },
  list: { marginBottom: "20px" },
  item: {},
  question: {
    width: "100%",
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    cursor: "pointer",
    padding: "14px 0",
    textAlign: "left",
  },
  questionText: {
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "1.4",
    flex: 1,
  },
  chevron: {
    color: "#FFD700",
    fontSize: "18px",
    flexShrink: 0,
    transition: "transform 0.25s ease",
    display: "inline-block",
  },
  answer: {
    color: "#ddd",
    fontSize: "17px",
    lineHeight: "1.65",
    paddingBottom: "18px",
    paddingRight: "12px",
    textAlign: "left"
  },
  divider: {
    height: "1px",
    background: "#3a3a3a",
  },
  ctaBtn: {
    width: "100%",
    background: "#FFD700",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "14px",
    padding: "16px",
    fontSize: "15px",
    fontWeight: "800",
    cursor: "pointer",
    letterSpacing: "1px",
    marginTop: "4px",
  },
};