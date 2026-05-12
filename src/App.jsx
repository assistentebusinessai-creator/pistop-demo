import { useState, useEffect, useRef } from "react";
import { LISTINO } from "./listino";
import { generaXmlFatturaPA } from "./fatturaXml";
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  "https://ytfnepbphttounnurcqa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0Zm5lcGJwaHR0b3VubnVyY3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzQ1NTAsImV4cCI6MjA5MjkxMDU1MH0.KQ79ZTz3S3TK6TK3i5U1Tk5k2xEOlzIoLVorP5vmbVE"
)

// ─────────────────────────────────────────
//  PUSH NOTIFICATIONS
// ─────────────────────────────────────────
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

async function registraPushNotifiche() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC
    });

    await supabase.from('push_subscription').insert([
      { subscription: sub.toJSON() }
    ]);

  } catch(e) {
    console.error('Push registration error:', e);
  }
}

// ─────────────────────────────────────────
//  BRAND & HELPERS
// ─────────────────────────────────────────
const G = "#22c55e", R = "#e53535", A = "#f59e0b";
const BG = "#080808", C1 = "#111", C2 = "#1a1a1a", C3 = "#242424";
const BR = "#2a2a2a", TX = "#ebebeb", MT = "#555", MT2 = "#888";

const fmt  = n => `€ ${(+n||0).toFixed(2).replace(".",",")}`;
const fmtK = n => n>=1000 ? `€ ${(n/1000).toFixed(1).replace(".",",")}k` : `€ ${(+n||0).toFixed(0)}`;
const fmtDate = iso => new Date(iso).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});
const mKey  = iso => { const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const mLabel= k => { const[y,m]=k.split("-"); return ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][+m-1]+" "+y; };
const tot   = (voci=[]) => voci.reduce((s,v)=>(s+(+(v.prezzo)||0)*(+(v.qta)||1)),0);
const nId   = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const prevN = n => `DS84-${new Date().getFullYear()}-${String(n).padStart(3,"0")}`;

// ─────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────
const DB = "ds84_v2";
const loadDB = async () => {
  try {
    const raw = localStorage.getItem("ds84_v2");
    return raw ? JSON.parse(raw) : { preventivi: [], clienti: [], nextNum: 1 };
  } catch { return { preventivi: [], clienti: [], nextNum: 1 }; }
};
const saveDB = async (d) => {
  try { localStorage.setItem("ds84_v2", JSON.stringify(d)); } catch {}
};

// ─────────────────────────────────────────
//  AI CALL
// ─────────────────────────────────────────
async function aiGenera(input) {
  const r = await fetch("/api/genera", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!r.ok) {
    throw new Error("Errore API");
  }

  return await r.json();
}

// ─────────────────────────────────────────
//  PDF HTML GENERATOR
// ─────────────────────────────────────────
const scaricaPDF = async (p) => {
  const voci = (p.voci||[]).map(v=>({
    descrizione: v.descrizione,
    qta: v.qta,
    prezzo: v.prezzo
  }));
  const res = await fetch('/api/pdf', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      nome: p.cliente,
      tel: p.telefono,
      modello: p.veicolo,
      marca: p.veicolo,
      targa: p.targa,
      numero: p.numero,
      data: new Date(p.data).toLocaleDateString('it-IT'),
      descrizione_lavoro: p.descrizione_lavoro,
      voci,
      mostraPrezziPDF: !!p.mostraPrezziPDF

    })
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`preventivo-${p.numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  };

const whatsappTxt = p => {
  let t = `🔧 *PREVENTIVO DS84 OFFICINE*\n`;
  t += `📋 N° ${p.numero} — ${fmtDate(p.data)}\n`;
  t += `🚗 *${p.veicolo}*${p.targa?` (${p.targa.toUpperCase()})`:""}`;
  if(p.cliente) t+=`\n👤 ${p.cliente}`;
  t+=`\n\n*${p.descrizione_lavoro}*\n`;
  t+=`${"─".repeat(28)}\n`;
  p.voci.forEach(v=>{
    const tot2=((+(v.prezzo)||0)*(+(v.qta)||1)).toFixed(2).replace(".",",");
    t+=`• ${v.descrizione}`;
    if(v.qta>1) t+=` ×${v.qta}`;
    t+=` → *€ ${tot2}*\n`;
  });
  t+=`${"─".repeat(28)}\n`;
  t+=`💰 *TOTALE: ${fmt(tot(p.voci))}*\n`;
  if(p.note_tecniche) t+=`\nℹ️ ${p.note_tecniche}`;
  t+=`\n\n_DS84 OFFICINE — Preventivo valido 30 giorni_`;
  return t;
};

const csvMese = (lista) => {
  const h = "Numero;Data;Cliente;Veicolo;Targa;Lavoro;Totale\n";
  const rows = lista.map(p=>
    `${p.numero};${fmtDate(p.data)};${p.cliente||""};${p.veicolo};${p.targa||""};${p.descrizione_lavoro};${tot(p.voci).toFixed(2).replace(".",",")}`
  ).join("\n");
  const blob = new Blob(["\uFEFF"+h+rows],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`DS84_${new Date().toLocaleDateString("it-IT")}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};
const VOCI_PRESET = {
  freni: {
    ricambio: [
      "PASTIGLIE FRENO ANTERIORI",
      "PASTIGLIE FRENO POSTERIORI",
      "DISCHI FRENO ANTERIORI",
      "DISCHI FRENO POSTERIORI",
      "KIT FRENI ANTERIORI",
      "KIT FRENI POSTERIORI"
    ],
    manodopera: [
      "MANODOPERA"
    ],
    altro: [
      "SPURGO IMPIANTO FRENANTE",
      "OLIO FRENI DOT 4",
      "CONTROLLO IMPIANTO FRENANTE",
      "SMALTIMENTO RIFIUTI"
    ]
  },

  tagliando: {
    ricambio: [
      "OLIO MOTORE",
      "FILTRO OLIO",
      "FILTRO ARIA",
      "FILTRO ABITACOLO",
      "FILTRO CARBURANTE",
      "CANDELE"
    ],
    manodopera: [
      "MANODOPERA"
    ],
    altro: [
      "CONTROLLO LIVELLI",
      "CONTROLLO GENERALE DEL VEICOLO",
      "AZZERAMENTO SERVICE",
      "SMALTIMENTO RIFIUTI"
    ]
  },

  distribuzione: {
    ricambio: [
      "KIT DISTRIBUZIONE",
      "CINGHIA SERVIZI",
      "POMPA ACQUA",
      "LIQUIDO REFRIGERANTE"
    ],
    manodopera: [
      "MANODOPERA"
    ],
    altro: [
      "CONTROLLO PERDITE",
      "SMALTIMENTO RIFIUTI"
    ]
  },

  diagnosi: {
    ricambio: [],
    manodopera: [
      "MANODOPERA"
    ],
    altro: [
      "DIAGNOSI",
      "PROVA SU STRADA",
      "CONTROLLO GENERALE DEL VEICOLO"
    ]
  },

  generico: {
    ricambio: [],
    manodopera: [
      "MANODOPERA"
    ],
    altro: [
      "SMALTIMENTO RIFIUTI"
    ]
  }
};

function detectContestoPreventivo(p) {
  const testo = [
    p?.inputOriginale || "",
    p?.descrizione_lavoro || "",
    ...(p?.voci || []).map(v => v?.descrizione || "")
  ]
    .join(" ")
    .toLowerCase();

  if (
    testo.includes("pastigli") ||
    testo.includes("freno") ||
    testo.includes("dischi")
  ) return "freni";

  if (
    testo.includes("tagliando") ||
    testo.includes("olio") ||
    testo.includes("filtro")
  ) return "tagliando";

  if (
    testo.includes("distribuzione") ||
    testo.includes("cinghia") ||
    testo.includes("pompa acqua")
  ) return "distribuzione";

  if (
    testo.includes("diagnosi") ||
    testo.includes("errore") ||
    testo.includes("spia")
  ) return "diagnosi";

  return "generico";
}

function normalizeTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("ricambio")) return "ricambio";
  if (t.includes("manodopera")) return "manodopera";
  return "altro";
}

function getSuggerimentiVoce(tipo, contesto) {
  const tipoNorm = normalizeTipo(tipo);
  const blocco = VOCI_PRESET[contesto] || VOCI_PRESET.generico;
  return blocco[tipoNorm] || [];
}



// ─────────────────────────────────────────
//  DS84 LOGO SVG
// ─────────────────────────────────────────
const Logo = ({h=64}) => (
  <div style={{display:"flex",alignItems:"center",gap:0}}>
    <div style={{lineHeight:1}}>
      <div style={{fontSize:h*0.55,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-0.5}}>
        <span style={{color:G}}>D</span>
        <span style={{color:"#fff"}}>S</span>
        <span style={{color:R,fontStyle:"italic"}}>84</span>
      </div>
      <div style={{color:MT2,fontSize:h*0.22,letterSpacing:3,marginTop:1,fontFamily:"'Barlow Condensed',sans-serif"}}>OFFICINE</div>
    </div>
  </div>
);

// ─────────────────────────────────────────
//  COMPONENTS
// ─────────────────────────────────────────

const Btn = ({children,onClick,style={},disabled=false,color=G}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:disabled?"#1a1a1a":color, color:disabled?MT:"#000",
    border:"none", borderRadius:10, padding:"13px 16px", fontSize:14,
    fontWeight:700, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5,
    opacity:disabled?0.5:1, transition:"opacity .15s", ...style
  }}>{children}</button>
);

const BtnSoft = ({children,onClick,style={}}) => (
  <button onClick={onClick} style={{
    background:C2, color:MT2, border:`1px solid ${BR}`, borderRadius:10,
    padding:"12px 16px", fontSize:13, fontWeight:600, cursor:"pointer",
    fontFamily:"'Barlow',sans-serif", ...style
  }}>{children}</button>
);

const Card = ({children,style={}}) => (
  <div style={{background:C1,border:`1px solid ${BR}`,borderRadius:12,padding:16,...style}}>
    {children}
  </div>
);

const Tag = ({tipo}) => {
  const cfg = {
    ricambio:{bg:"#14532d",c:"#ffffff",l:"Ricambio"},
    manodopera:{bg:"#78350f",c:"#ffffff",l:"Manodopera"},
    altro:{bg:"#2a2a2a",c:"#ffffff",l:"Altro"}
  }[tipo]||{bg:C3,c:MT2,l:tipo};
  return <span style={{fontSize:12,fontWeight:700,background:cfg.bg,color:cfg.c,borderRadius:4,padding:"2px 6px",letterSpacing:0.5,textTransform:"uppercase"}}>{cfg.l}</span>;
};

// ─────────────────────────────────────────
//  SCREEN: DASHBOARD
// ─────────────────────────────────────────
function Dashboard({db,onNuovo,onArchivio, onCliente}) {

  const [preventiviHome, setPreventiviHome] = useState([]);

  useEffect(() => {
    const loadHomePreventivi = async () => {
      const { data, error } = await supabase
        .from("preventivi")
        .select("dati")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Errore caricamento home:", error);
        return;
      }

      setPreventiviHome((data || []).map(r => r.dati));
    };

    loadHomePreventivi();
  }, [db]);
  const now = new Date().toISOString();
  const mk = mKey(now);
  const mese = preventiviHome.filter(p=>mKey(p.data)===mk);
  const totMese = mese.reduce((s,p)=>s+tot(p.voci),0);
  const totAnno = preventiviHome.filter(p=>p.data.startsWith(new Date().getFullYear()+"")).reduce((s,p)=>s+tot(p.voci),0);
  const recenti = [...preventiviHome].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,3);
  const oggi = new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Hero stats */}
      <div style={{
        background:`linear-gradient(135deg,#0a0f0c 0%, #0f2a1a 40%, #00c853 100%)`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,120,0.08)",
        border: "1px solid rgba(0,255,120,0.2)",
        borderRadius: 16,
        padding: 16
      }}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.85)",letterSpacing:2,textTransform:"uppercase",marginBottom:4,fontFamily:"'Barlow Condensed',sans-serif"}}>Questo mese · {mLabel(mk)}</div>
        <div style={{fontSize:42,fontWeight:900,color:G,fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>{fmtK(totMese)}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginTop:6}}>{mese.length} preventiv{mese.length===1?"o":"i"} · Anno {fmtK(totAnno)}</div>
        <button onClick={onCliente} style={{
          marginTop:16,
          width:"100%",
          background:G,
          border: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          color:"#000",
          borderRadius:12,
          padding:"16px",
          fontSize:16,
          fontWeight:900,
          cursor:"pointer",
        }}>
          <span style={{fontSize:20}}>⚡</span> NUOVO PREVENTIVO
        </button>
      </div>

      {/* Quick stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card style={{
          padding:14,
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.28)"
        }}>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif"}}>Preventivi oggi</div>
          <div style={{fontSize:34,fontWeight:900,color:TX,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>
            {preventiviHome.filter(p=>p.data.startsWith(new Date().toISOString().slice(0,10))).length}
          </div>
        </Card>
        <Card style={{
          padding:14,
          cursor:"pointer",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
        }} onClick={onArchivio}>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif"}}>Totale archivio</div>
          <div style={{fontSize:34,fontWeight:900,color:TX,fontFamily:"'Barlow Condensed',sans-serif",marginTop:2}}>{preventiviHome.length}</div>
        </Card>
      </div>

           
      {/*Ultimi preventivi */}

      {false &&recenti.length > 0 && (
        <div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.85)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10}}>Ultimi preventivi</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recenti.map(p=>(
              <div key={p.id} style={{background:C2,border:`1px solid ${BR}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,color:TX}}>{p.veicolo}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2}}>{p.descrizione_lavoro}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginTop:2,lineHeight:1.4,letterSpacing:0.3}}>{p.numero} · {fmtDate(p.data)}</div>
                </div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,color:A,flexShrink:0,marginLeft:8}}>{fmt(tot(p.voci))}</div>
              </div>
            ))}
          </div>
          
          <button onClick={onArchivio} style={{width:"100%",marginTop:10,background:"none",border:`1px solid ${BR}`,color:"#fff",borderRadius:8,padding:"10px",fontSize:14,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
            Vedi tutto l'archivio →
          </button>
        </div>
      )}

      {false && recenti.length===0 && (
        <div style={{textAlign:"center",padding:"32px 0",color:MT}}>
          <div style={{fontSize:40,marginBottom:12}}>🔧</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,color:"rgba(255,255,255,0.85)"}}>Nessun preventivo ancora</div>
          <div style={{fontSize:13,marginTop:4}}>Tocca il pulsante verde per iniziare</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  SCREEN: NUOVO PREVENTIVO
// ─────────────────────────────────────────
function Nuovo({onGenerated,onBack}) {
  const [input,setInput]=useState("");
  const [bozzeQr, setBozzeQr] = useState([]);
  const [bozzaSelezionata, setBozzaSelezionata] = useState(null);
  const [loading,setLoading]=useState(false);
  const [isAutoGenerazione, setIsAutoGenerazione] = useState(
    new URLSearchParams(window.location.search).has("generaBozza")
  );
  const [error,setError]=useState("");
  const [usaListino, setUsaListino] = useState(false);
  const ref=useRef();
  useEffect(()=>{ setTimeout(()=>ref.current?.focus(),200); },[]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const generaBozzaId = params.get("generaBozza");

    if (!generaBozzaId || bozzeQr.length === 0) return;

    const bozza = bozzeQr.find(
      b => String(b.id) === String(generaBozzaId)
    );

    if (!bozza) return;

    const testoBozza =
      `${bozza.marca || ""} ${bozza.modello || ""} ${bozza.problema || ""}`
        .replace(/\s+/g, " ")
        .trim();

    setInput(testoBozza);
    setBozzaSelezionata(bozza);

    setTimeout(async () => {
       await genera(testoBozza, bozza);
       setIsAutoGenerazione(false);
    }, 300);

    window.history.replaceState({}, "", window.location.pathname);
  }, [bozzeQr]);

  useEffect(() => {
    const loadBozze = async () => {
      const { data, error } = await supabase
        .from("preventivi_bozze")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        
        setBozzeQr(data);
      } else {
        console.error("Errore caricamento bozze:", error);
      }
    };

    loadBozze();
  }, []);


  const eliminaBozza = async (id) => {
    const conferma = confirm("Eliminare questa bozza?");
    if (!conferma) return;

    // 1) cancella su Supabase
    const { error } = await supabase
      .from("preventivi_bozze")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Errore eliminazione");
      return;
    }

    // 2) aggiorna UI (sparisce subito)
    setBozzeQr(prev => prev.filter(b => b.id !== id));
  };
  
  const genera = async (testoManuale = null, bozzaManuale = null) => {
    const testoDaGenerare = (testoManuale || input).trim();
    if(!testoDaGenerare) return;

    const bozzaFinale = bozzaManuale || bozzaSelezionata;
    

    setLoading(true);
    setError("");

    try {
      const r = await aiGenera(testoDaGenerare);
      onGenerated(r, testoDaGenerare, usaListino, {
        ... bozzaFinale,
        cliente: bozzaFinale?.cliente || bozzaFinale?.nome || "",
        bozza_id: bozzaFinale?.bozza_id || bozzaFinale?.id || null
      });

    } catch(e) {
      setError("Errore di rete. Riprova.");
    }

    setLoading(false);
  };

  if (isAutoGenerazione) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card>
          <div style={{textAlign:"center",padding:"40px 16px"}}>
            <LoadingDots />
            <div style={{
              marginTop:14,
              fontFamily:"Barlow Condensed, sans-serif",
              fontSize:22,
              fontWeight:800,
              color:TX
            }}>
              GENERAZIONE PREVENTIVO...
            </div>
            <div style={{marginTop:8,color:MT,fontSize:13}}>
              Sto preparando le voci del preventivo
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:MT2,cursor:"pointer",fontSize:18,padding:"4px 0"}}></button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:TX}}>
          {isAutoGenerazione ? "GENERAZIONE PREVENTIVO..." : "BOZZE PREVENTIVO"}
        </div>
      </div>

      
      <Card>
        {/*}
        <div style={{fontSize:16,color:"rgba(255,255,255,0.85)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10}}>RIPRENDI UNA BOZZA</div>
        <textarea ref={ref} value={input} disabled={!bozzaSelezionata} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&e.metaKey) genera(); }}
          rows={4} placeholder={"Seleziona una bozza salvata per modificare il lavoro da fare"}
          style={{width:"100%",background:BG,border:`1px solid ${BR}`,borderRadius:8,color:"#ffff",
          fontSize:19,padding:"12px 14px",resize:"none",lineHeight:1.6,fontFamily:"'Barlow',sans-serif",marginBottom:12, height:150, minHeight:150}}
        />


        {error && <div style={{color:"#f87171",fontSize:12,marginBottom:10}}>{error}</div>}
        <Btn onClick={genera} disabled={loading||!input.trim()} style={{width:"100%",padding:"15px",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading ? (
            <><LoadingDots/> Analisi in corso...</>
          ) : (
            <><span style={{fontSize:20}}>⚡</span> GENERA PREVENTIVO</>
          )}
        </Btn>
        */}
        {!isAutoGenerazione && bozzeQr.length > 0 && (
          <div style={{ marginTop: 20 }}>

            <div style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#ffffff",
              marginBottom: 10,
              textTransform: "uppercase"
            }}>
              
            </div>
            {bozzeQr.map((b) => (
              <div
                key={b.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
              

                {/* SINISTRA */}
                <div>
                
                  <div style={{display: "flex", alignItems: "center", gap: 10}}>

                    <div style={{fontWeight: 700, fontSize: 20, color: "#fff"}}>
                      {b.nome} {b.cognome}
                    </div>

                    {b.targa && (
                      <div style={{fontWeight: 600, fontSize: 14, color: "#9ca3af"}}>
                        • {b.targa}
                      </div>
                    )}

                  </div>

                  <div style={{fontWeight: 600, fontSize: 15, color :"#9ca3aa" }}>
                    {b.marca} {b.modello}
                  </div>

                  <div style={{fontWeight: 600, fontSize: 13, color: "#fff" }}>
                    {new Date(b.created_at || b.data).toLocaleDateString("it-IT")}
                  </div>
                </div>

                {/* DESTRA */}
                <div style={{display: "flex", gap: 8}}>

                  <button
                    onClick={() => {
                      const testoBozza =  `${b.marca || ""} ${b.modello || ""} ${(b.problema || "").trim()}`
                            .replace(/\s+/g, " ")
                            .trim()
                      

                      setInput(testoBozza);
                      setBozzaSelezionata(b);

                      genera(testoBozza, b);
                    }}
                    style={{
                      background: "#22c55e",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: 700
                    }}
                  >
                    GENERA
                  </button>

                  <button
                    onClick={() => eliminaBozza(b.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid #444",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer"
                    }}
                  >
                    ❌
                  </button>

                </div>

              </div>
            ))}
          </div>
        )}

        
      </Card>

      {loading && (
        <Card style={{textAlign:"center",padding:"28px 16px",background:"#0d1f12",border:`1px solid #1a3a1a`}}>
          <LoadingDots big/>
          <div style={{color:G,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,marginTop:12,letterSpacing:1}}>Sto preparando il preventivo...</div>
          <div style={{color:MT,fontSize:12,marginTop:4}}>Identifico le voci tecniche per il tuo veicolo</div>
        </Card>
      )}

      {false && (
      <Card style={{background:C2,border:"none",padding:14}}>
        <div style={{fontSize:11,color:MT,letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:8,textTransform:"uppercase"}}></div>
        <div style={{marginTop:12}}>
          <label style={{
            display:"none",
            alignItems:"center",
            gap:14,
            color:"#fff",
            fontSize:20,
            fontWeight:700,
            letterSpacing:0.5,
            cursor:"pointer"
          }}>
            <input 
              type="checkbox" 
              checked={usaListino}
              onChange={(e)=>setUsaListino(e.target.checked)}
              style={{
                width:24,
                height:24,
                cursor:"pointer"
              }}
          />
          USA PREZZI LISTINO
        </label>
      </div>
      </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  SCREEN: EDIT PREVENTIVO
// ─────────────────────────────────────────
function EditPreventivo({prev,onChange,onPreview,onBack}) {
  const formRef = useRef(null);
  const firstFieldRef = useRef(null);
  const [mostraPrezziPDF, setMostraPrezziPDF] = useState(!!prev.mostraPrezziPDF);

  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 120);
  }, []);

  const moveToNextField = (current) => {
    const root = formRef.current;
    if (!root) return;

    const fields = [...root.querySelectorAll('[data-nav="true"]')]
      .filter((el) => !el.disabled && el.type !== "hidden" && el.offsetParent !== null);

    const index = fields.indexOf(current);
    if (index >= 0 && index < fields.length - 1) {
      fields[index + 1].focus();
      if (fields[index + 1].select) fields[index + 1].select();
    }
  };

  const handleSequentialNav = (e) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      moveToNextField(e.target);
    }
  };

  const qtaDecimale = (v) => {
    const d = (v.descrizione || "").toLowerCase();

    const isLiquido = [
      "olio motore",
      "olio cambio",
      "olio freni",
      "liquido",
      "liquidi",
      "antigelo",
      "refrigerante",
      "additivo"
    ].some(k => d.includes(k));

    return v.tipo === "manodopera" || isLiquido;
  };

  const updateVoce=(id,k,v)=>onChange({...prev,voci:prev.voci.map(x=>x.id===id?{...x,[k]:v}:x)});
  const removeVoce=id=>onChange({...prev,voci:prev.voci.filter(x=>x.id!==id)});
  const addVoce = () => setPickerOpen(v => !v);
  const totale2=tot(prev.voci);

  const [pickerOpen, setPickerOpen] = useState(false);

  const contestoAggiunta = detectContestoPreventivo(prev);

  function creaVoceDaPreset(testo) {
    const t = (testo || "").toUpperCase();

    let tipo = "altro";

    const ricambi = [
      "PASTIGLIE",
      "DISCHI",
      "KIT FRENI",
      "OLIO MOTORE",
      "FILTRO",
      "CANDELE",
      "KIT DISTRIBUZIONE",
      "CINGHIA",
      "POMPA ACQUA",
      "LIQUIDO REFRIGERANTE"
    ];

    if (t === "MANODOPERA") {
      tipo = "manodopera";
    } else if (ricambi.some(k => t.includes(k))) {
      tipo = "ricambio";
    }
    
    const quantitaDecimale =
      tipo === "manodopera" ||
      ["olio", "liquido", "liquidi", "antigelo", "refrigerante", "additivo"].some(k =>
        t.toLowerCase().includes(k)
     );

    onChange({
      ...prev,
      voci: [
        ...prev.voci,
        {
          id: nId(),
          tipo,
          descrizione: t,
          qta: quantitaDecimale ? 0.5 : 1,
          prezzo: 0
        }
      ]
    });

    setPickerOpen(false);
  }

  function addVoceLibera() {
    onChange({
      ...prev,
      voci: [
        ...prev.voci,
        {
          id: nId(),
          tipo: "ricambio",
          descrizione: "",
          qta: 1,
          prezzo: 0
        }
      ]
    });

    setPickerOpen(false);
  }


  
  return (
     <div
       ref={formRef}
       onKeyDownCapture={handleSequentialNav}
       style={{display:"flex",flexDirection:"column",gap:14}}
     >
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:MT2,cursor:"pointer",fontSize:18}}>←</button>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:A}}>{prev.veicolo}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.85)"}}>{prev.descrizione_lavoro}</div>
        </div>
      </div>

      {/* Cliente & Targa */}
      <Card>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10}}>Dati cliente</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{k:"cliente",ph:"Nome cliente",label:"Cliente"},{k:"telefono",ph:"Telefono",label:"Telefono"},{k:"veicolo",ph:"Veicolo",label:"Veicolo"},{k:"targa",ph:"Targa",label:"Targa"}].map(f=>(
            <div key={f.k}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginBottom:3,letterSpacing:1}}>{f.label.toUpperCase()}</div>
              <input
                ref={f.k === "cliente" ? firstFieldRef : null}
                data-nav="true"
                value={prev[f.k] || ""}
                onChange={e => {
                  const value = f.k === "targa"
                    ? e.target.value.toUpperCase()
                    : e.target.value;

                  onChange({ ...prev, [f.k]: value });
                }}
                placeholder={f.ph}
                maxLength={f.k === "targa" ? 10 : undefined}
                style={{
                  width:"100%",
                  background:BG,
                  border:`1px solid ${BR}`,
                  borderRadius:6,
                  color:TX,
                  fontSize:13,
                  padding:"8px 10px",
                  fontFamily:"'Barlow',sans-serif",
                  textTransform: f.k === "targa" ? "uppercase" : "none"
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Voci */}
      <div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
          <span>Voci preventivo</span>
          <span style={{color:MT2}}>{prev.voci.length} voci</span>
        </div>

        {prev.voci.map((v,i)=>(
          <div key={v.id} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 6px 18px rgba(0,0,0,0.35)" ,borderRadius:12,marginBottom:12,overflow:"hidden",
            borderLeft:`3px solid ${v.tipo==="ricambio"?"#14532d":v.tipo==="manodopera"?A:MT}`}}>
            <div style={{padding:"10px 12px 6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <Tag tipo={v.tipo}/>
                <select value={v.tipo} onChange={e=>updateVoce(v.id,"tipo",e.target.value)}
                  style={{background:"none",border:"none",color:"rgba(255,255,255,0.85)",fontSize:13,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
                  <option value="ricambio">Ricambio</option>
                  <option value="manodopera">Manodopera</option>
                  <option value="altro">Altro</option>
                </select>
                <button onClick={()=>removeVoce(v.id)} style={{marginLeft:"auto",background:"none",border:"none",color:MT,cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
              </div>
              <input value={v.descrizione} onChange={e=>updateVoce(v.id,"descrizione",e.target.value)}
                placeholder="Descrizione voce..." style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${BR}`,color:TX,fontSize:14,padding:"4px 0",fontFamily:"'Barlow',sans-serif",marginBottom:8, textTransform: "uppercase"}}/>

                
              <div style={{display:"grid",gridTemplateColumns:"115px minmax(0,1fr) 74px",gap:8,alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",letterSpacing:1,marginBottom:3}}>QUANTITÀ</div>
                  <div style={{display:"grid",gridTemplateColumns:"32px minmax(0,1fr) 32px",alignItems:"center",background:BG,border:`1px solid ${BR}`,borderRadius:6,overflow:"hidden"}}>
                    <button 
                      onClick={()=>updateVoce(
                        v.id,
                        "qta",
                        qtaDecimale(v)
                          ? Math.max(0, Number((+v.qta || 0) - 0.1).toFixed(2))
                          : Math.max(1, (+v.qta || 1) - 1)
                      )}

                      style={{background:"none",border:"none",color:MT2,padding:0,cursor:"pointer",fontSize:16,height:38}}
                    >
                      -
                    </button>
                    

                    <input
                      type="text"
                      inputMode="decimal"
                      id={`qta-${v.id}`}
                      value={v.qta}
                      onChange={(e)=>{
                        const raw = e.target.value.replace(",", ".");
                        if (qtaDecimale(v)) {
                          if (/^\d*\.?\d*$/.test(raw)) {
                            updateVoce(v.id, "qta", raw);
                          }
                        } else {
                          const num = Number(raw);
                          updateVoce(v.id, "qta", Math.round(num || 0));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSequentialNav(e);
                      }}
                      onFocus={(e)=>e.target.select()}
                      style={{
                        flex:1,
                        minWidth:0,
                        height:38,
                        padding:0,
                        textAlign:"center",
                        fontSize:17,
                        fontWeight:700,
                        color:TX,
                        background:"transparent",
                        border:"none",
                        outline:"none"
                       
                      }}
                   />
                    <button 
                      onClick={()=>updateVoce(
                        v.id,
                        "qta",
                        qtaDecimale(v)
                          ? Number((+v.qta || 0) + 0.1). toFixed(2)
                          : (+v.qta || 0) + 1
                      )}
                    style={{background:"none",border:"none",color:MT2,padding:"6px 10px",cursor:"pointer",fontSize:16}}>+</button>
                  </div>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",letterSpacing:1,marginBottom:3}}>PREZZO UNITARIO</div>
                  <div style={{display:"flex",alignItems:"center",background:BG,border:`1px solid ${BR}`,borderRadius:6,overflow:"hidden"}}>
                    <span style={{padding:"0 8px",color:MT,fontSize:14}}>€</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      data-nav="true"
                      value={v.prezzo || ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(",", ".");
                        if (/^\d*\.?\d*$/.test(raw)) {
                          updateVoce(v.id, "prezzo", raw);
                        }
                      }}
                      placeholder="0,00"
                      style={{
                        flex:1,
                        minWidth:0,
                        height:38,
                        padding:0,
                        textAlign:"center",
                        fontSize:17,
                        fontWeight:700,
                        color:TX,
                        background:"transparent",
                        border:"none",
                        outline:"none"
                      }}
                    />
                  </div>
                </div>
                <div style={{textAlign:"right", whiteSpace:"nowrap"}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",letterSpacing:1,marginBottom:3}}>TOTALE</div>
                  <div style={{fontSize:17,fontWeight:800,color:TX,fontFamily:"'Barlow Condensed',sans-serif"}}>{fmt((+(v.prezzo)||0)*(+(v.qta)||1))}</div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addVoce} style={{width:"100%",background:"transparent",border:"2px dashed #22c55e",borderRadius:10,color:"rgba(255,255,255,0.85)",fontSize:13,padding:"10px 12px",cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
          + AGGIUNGI VOCE
        </button>

        {pickerOpen && (
          <div style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8
          }}>
            {[
              ...getSuggerimentiVoce("ricambio", contestoAggiunta),
              ...getSuggerimentiVoce("altro", contestoAggiunta),
              ...getSuggerimentiVoce("manodopera", contestoAggiunta)
            ].map((item, i) => (
              <button
                key={`${item}-${i}`}
                type="button"
                onClick={() => creaVoceDaPreset(item)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                {item}
              </button>
            ))}

            <button
              type="button"
              onClick={addVoceLibera}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1.5px dashed rgba(34,197,94,0.6)",
                background: "rgba(34,197,94,05)",
                color: "#ffffff",
                cursor: "pointer"
              }}
            >
              VOCE LIBERA
            </button>
          </div>
        )}


      </div>

      {/* Note */}
      <Card>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Note tecniche (opzionale)</div>
        <textarea value={prev.note_tecniche||""} onChange={e=>onChange({...prev,note_tecniche:e.target.value})}
          rows={2} placeholder="Es: Verificare stato pinze freno..."
          style={{width:"100%",background:BG,border:`1px solid ${BR}`,borderRadius:6,color:TX,fontSize:13,padding:"8px",resize:"none",fontFamily:"'Barlow',sans-serif"}}/>
      </Card>

      {/* Totale bar */}
      <div style={{background:`linear-gradient(90deg,#0d1f12,${C1})`,border:`1px solid #1a3a1a`,borderRadius:12,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",letterSpacing:2,textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif"}}>Totale preventivo</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2}}>IVA esclusa</div>
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,color:G}}>{fmt(totale2)}</div>
      </div>

      <label style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, color:'white'}}>
        <input
          type="checkbox"
          checked={mostraPrezziPDF}
          onChange={(e) => setMostraPrezziPDF(e.target.checked)}
        />
        <span>MOSTRA PREZZI NEL PREVENTIVO</span>
      </label>

      <Btn 
        onClick={() => onPreview({ ...prev, mostraPrezziPDF })}
        data-nav="true"
        tabIndex={0} 
        
        style={{width:"100%",padding:"15px",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} 
      >  
        <span>📄</span> ANTEPRIMA & SALVA
      </Btn>
    </div>
  );
}

// ─────────────────────────────────────────
//  SCREEN: PREVIEW & AZIONI
// ─────────────────────────────────────────
function Preview({prev,onSalva,onEdit,onBack,saved}) {
  const [copied,setCopied]=useState(false);
  const [pdfDone,setPdfDone]=useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(prev.descrizione_lavoro || "");
  

  const totale2=tot(prev.voci);

  const copyWA = async () => {
    const testo = whatsappTxt(prev);
    try {
      await navigator.clipboard.writeText(testo);
    } catch {
      const el = document.createElement('textarea');
      el.value = testo;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const handlePDF = () => {
    scaricaPDF({
      ...prev,
      mostraPrezziPDF: !!prev.mostraPrezziPDF
    });
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 3000);
  };


  const [showXmlModal, setShowXmlModal] = useState(false);
  const [datiFiscali, setDatiFiscali] = useState({
    codiceFiscale: "",
    partitaIva: "",
    indirizzo: "",
    cap: "",
    comune: "",
    provincia: "",
    codiceDestinatario: "0000000",
    pec: ""
  });

  const handleXML = async () => {
    

    if (prev.client_id) {
      const { data: cliente, error } = await supabase
        .from("clienti")
        .select("*")
        .eq("id", prev.client_id)
        .single();

      if (!error && cliente) {
        setDatiFiscali(prevDati => ({
          ...prevDati,
          codiceFiscale: cliente.codice_fiscale || "",
          partitaIva: cliente.piva || "",
          indirizzo: cliente.indirizzo || "",
          codiceDestinatario: cliente.identificativo || "0000000",
          pec: cliente.email || ""
        }));
      } else {
        console.error("Errore recupero cliente XML:", error);
      }
    }
  

    setShowXmlModal(true);
  };


  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      

      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:MT2,cursor:"pointer",fontSize:18}}>←</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:TX}}>ANTEPRIMA PREVENTIVO</div>
      </div>

      {/* Document preview */}
      <div style={{background:"#fff",borderRadius:14,padding:20,color:"#111",boxShadow:"0 4px 24px rgba(0,0,0,.5)"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:"2px solid #111"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:44,height:44,background:"#111",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,lineHeight:1,textAlign:"center"}}>
                <span style={{color:G}}>D</span><span style={{color:"#fff"}}>S</span><span style={{color:R,fontStyle:"italic"}}>84</span>
                <div style={{color:"#888",fontSize:10,letterSpacing:2}}>OFFICINE</div>
              </div>
            </div>
            <div><div style={{fontWeight:800,fontSize:14}}>DS84 OFFICINE</div><div style={{fontSize:11,color:"#666"}}>Officina meccanica</div></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"#888",fontWeight:600,letterSpacing:1}}>PREVENTIVO</div>
            <div style={{fontWeight:800,fontSize:13}}>{prev.numero}</div>
            <div style={{fontSize:11,color:"#888"}}>{fmtDate(prev.data)}</div>
          </div>
        </div>

        {/* Info */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:"#f5f5f5",borderRadius:6,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#888",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Cliente</div>
            <div style={{fontSize:13,fontWeight:600}}>{prev.cliente||"—"}</div>
            {prev.telefono&&<div style={{fontSize:11,color:"#666"}}>{prev.telefono}</div>}
          </div>
          <div style={{background:"#f5f5f5",borderRadius:6,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#888",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Veicolo</div>
            <div style={{fontSize:13,fontWeight:600}}>{prev.veicolo}</div>
            {prev.targa&&<div style={{fontSize:11,color:"#666"}}>Targa: {prev.targa.toUpperCase()}</div>}
          </div>
        </div>

        <div style={{background:"#111",color:"#fff",padding:"8px 12px",borderRadius:"6px 6px 0 0",fontSize:13,fontWeight:700}}>
          <div style={{ position: "relative" }}>

            {!editingDesc ? (
              <>
                <div>{desc}</div>

                <button
                  onClick={() => setEditingDesc(true)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    background: "none",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer"
                  }}
                >
                  ✏️
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 80,
                    marginTop: 8
                  }}
                />

                <button
                  onClick={() => {
                    setEditingDesc(false);
                    prev.descrizione_lavoro = desc;
                  }}
                  style={{ marginTop: 6 }}
                >
                  Salva
                </button>
              </>
            )}

          </div>
        </div>

        {/* Voci table */}
        <div style={{border:"1px solid #e5e5e5",borderTop:"none",borderRadius:"0 0 6px 6px",overflow:"hidden",marginBottom:14}}>
          {prev.voci.map((v,i)=>(
            <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:i<prev.voci.length-1?"1px solid #f0f0f0":"none",background:i%2===0?"#fff":"#fafafa"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:"#222"}}>{v.descrizione}</div>
                <div style={{fontSize:10,color:"#888"}}>{v.tipo==="ricambio"?"Ricambio":"Manodopera"}{v.qta>1?` × ${v.qta}`:""}</div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:"#111",flexShrink:0,marginLeft:8}}>{fmt((+(v.prezzo)||0)*(+(v.qta)||1))}</div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px",background:"#111",color:"#fff"}}>
            <span style={{fontWeight:700,fontSize:13,letterSpacing:1}}>TOTALE (IVA esclusa)</span>
            <span style={{fontWeight:900,fontSize:18,color:G}}>{fmt(totale2)}</span>
          </div>
        </div>

        {prev.note_tecniche&&(
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"8px 10px",fontSize:11,color:"#854d0e"}}>
            📋 {prev.note_tecniche}
          </div>
        )}
      </div>

      {/* Azioni */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={handlePDF} style={{background:pdfDone?"#14532d":"#1a1a1a",border:`1px solid ${pdfDone?"#166534":"#333"}`,color:pdfDone?"#86efac":"#94a3b8",borderRadius:10,padding:"14px 10px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          {pdfDone ? "✓ PDF SCARICATO" : "📄 SCARICA PDF"}
        </button>
        <button onClick={handleXML} style={{background:"#0d2b1a", border:"1px solid #166534", color:"#fff", fontWeight:800}}>
           📄 SCARICA XML
        </button>
      </div>

      <div style={{display:"flex",gap:10}}>
        <BtnSoft onClick={onEdit} 
          style={{
            flex:1,
            textAlign:"center",
            background:"#1a1a1a",
            border:"1px solid #ea580c",
            color:"#f97316",
            fontWeight:800,
            fontFamily:"Barlow Condensed, sans-serif",
            letterSpacing:1,
            textTransform:"uppercase"
          }}
        >✏️ Modifica</BtnSoft>
        {!saved && <Btn onClick={onSalva} style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span>💾</span> SALVA IN ARCHIVIO
        </Btn>}
        {saved && <div style={{flex:2,background:"#14532d",border:"1px solid #166534",color:"#86efac",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif"}}>✓ Salvato</div>}
      </div>

      {showXmlModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.86)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 18
        }}>
          <div style={{
            width: "100%",
            maxWidth: 460,
            background: "#111",
            border: "1px solid #2a2a2a",
            borderRadius: 18,
            padding: 22,
            boxShadow: "0 24px 70px rgba(0,0,0,0.75)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: "85vh",
            overflowY: "auto",
            paddingBottom: 30
          }}>

            <div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 28,
                fontWeight: 900,
                color: "#22c55e",
                letterSpacing: 1,
                textTransform: "uppercase"
              }}>
                Dati fatturazione
              </div>

              <div style={{
                color: "#aaa",
                fontSize: 14,
                marginTop: 4
              }}>
                Completa i dati fiscali del cliente per generare il file XML.
              </div>
            </div>

            {[
              ["indirizzo", "Indirizzo cliente"],
              ["cap", "CAP"],
              ["comune", "Comune"],
              ["provincia", "Provincia"],
              ["codiceFiscale", "Codice fiscale / Partita IVA"],
              ["codiceDestinatario", "Codice destinatario"],
              ["pec", "PEC cliente"]
            ].map(([campo, label]) => (
              <div key={campo} style={{display:"flex", flexDirection:"column", gap:5}}>
                <label style={{
                  color:"#ddd",
                  fontSize:12,
                  letterSpacing:1.4,
                  textTransform:"uppercase",
                  fontFamily:"Barlow Condensed, sans-serif"
                }}>
                  {label}
                </label>

                <input
                  value={datiFiscali[campo]}
                  onChange={e => setDatiFiscali({...datiFiscali, [campo]: e.target.value})}
                  placeholder={label}
                  style={{
                    background:"#050505",
                    border:"1px solid #333",
                    color:"#fff",
                    padding:"13px 14px",
                    borderRadius:10,
                    fontSize:16,
                    outline:"none"
                  }}
                />
              </div>
            ))}

            <button
              onClick={() => {
                const xml = generaXmlFatturaPA(prev, {
                  nome: prev.cliente,
                  telefono: prev.telefono,
                  ...datiFiscali
                });

                const blob = new Blob([xml], { type: "application/xml" });
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                 a.href = url;
                a.download = "fattura.xml";
                a.click();

                URL.revokeObjectURL(url);
                setShowXmlModal(false);
              }}
              style={{
                marginTop:8,
                background:"#22c55e",
                color:"#000",
                border:"none",
                padding:"14px",
                borderRadius:12,
                fontWeight:900,
                fontSize:16,
                cursor:"pointer",
                textTransform:"uppercase"
              }}
            >
              Genera XML
            </button>

            <button
              onClick={() => setShowXmlModal(false)}
              style={{
                background:"transparent",
                color:"#ef4444",
                border:"1px solid #7f1d1d",
                padding:"12px",
                borderRadius:12,
                fontWeight:800,
                cursor:"pointer",
                textTransform:"uppercase"
              }}
            >
              Annulla
            </button>

          </div>
        </div>
      )}
    </div>


  );
}

// ─────────────────────────────────────────
//  SCREEN: ARCHIVIO
// ─────────────────────────────────────────
function Archivio({db,onBack,onOpen}) {

  const [filter,setFilter]=useState("");
  const [listaSupabase,setListaSupabase]=useState(db.preventivi || []);

  useEffect(() => {
    const loadArchivio = async () => {
      const { data, error } = await supabase
        .from("preventivi")
        .select("dati,stato_cliente,token")
        .order("created_at", { ascending: false });

        
      if (error) {
        console.error("Errore caricamento archivio:", error);
        return;
      }

      setListaSupabase((data || []).map(r => ({
        ...r.dati,
        stato_cliente: r.stato_cliente || 'in_attesa',
        token: r.token
      })));
    };

    loadArchivio();
  }, []);

  const lista = [...listaSupabase].sort((a,b)=>b.data.localeCompare(a.data));
  const filtered = filter ? lista.filter(p=>
    p.veicolo?.toLowerCase().includes(filter.toLowerCase())||
    p.cliente?.toLowerCase().includes(filter.toLowerCase())||
    p.numero?.toLowerCase().includes(filter.toLowerCase())
  ) : lista;

  const byMonth = filtered.reduce((acc,p)=>{
    const k=mKey(p.data); if(!acc[k])acc[k]=[]; acc[k].push(p); return acc;
  },{});
  const months = Object.keys(byMonth).sort().reverse();
  const totAll = lista.reduce((s,p)=>s+tot(p.voci),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:MT2,cursor:"pointer",fontSize:18}}>←</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:TX}}>Archivio</div>
        <div style={{marginLeft:"auto",fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,color:A}}>{fmt(totAll)}</div>
      </div>

      <div style={{display:"flex",alignItems:"center",background:C1,border:`1px solid ${BR}`,borderRadius:10,overflow:"hidden"}}>
        <span style={{padding:"0 12px",color:MT}}>🔍</span>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Cerca per cliente, veicolo, numero..."
          style={{flex:1,background:"none",border:"none",color:TX,fontSize:14,padding:"12px 0",fontFamily:"'Barlow',sans-serif"}}/>
      </div>

      {months.length===0 && (
        <div style={{textAlign:"center",padding:"40px 0",color:MT}}>
          <div style={{fontSize:36,marginBottom:8}}>📂</div>
          <div>{filter?"Nessun risultato":"Archivio vuoto"}</div>
        </div>
      )}

      {months.map(mk=>{
        const mese=byMonth[mk];
        const totM=mese.reduce((s,p)=>s+tot(p.voci),0);
        return (
          <div key={mk}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 4px",marginBottom:6}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:MT2,letterSpacing:1}}>{mLabel(mk).toUpperCase()}</div>
              <div style={{display:"flex",gap:12,fontSize:12,color:MT}}>
                <span>{mese.length} preventivi</span>
                <span style={{color:A,fontWeight:700}}>{fmt(totM)}</span>
                <button onClick={()=>csvMese(mese)} style={{background:"none",border:"none",color:G,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Barlow',sans-serif"}}>CSV ↓</button>
              </div>
            </div>
            {mese.map(p=>(
              <div key={p.id} onClick={()=>onOpen(p)} style={{background:C1,border:`1px solid ${BR}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:700,color:TX}}>{p.veicolo}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:A}}>{fmt(tot(p.voci))}</div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <div style={{fontSize:12,color:MT2}}>{p.descrizione_lavoro}</div>
                  <div style={{fontSize:11,color:MT}}>{p.numero}</div>
                </div>
                {p.cliente&&<div style={{fontSize:11,color:MT,marginTop:2}}>👤 {p.cliente}</div>}
                <div style={{marginTop:6}}>
                  <span style={{
                    fontSize:11, fontWeight:700, borderRadius:4, padding:"2px 8px",
                    background: p.stato_cliente==='accettato' ? '#14532d' : p.stato_cliente==='rifiutato' ? '#3f1212' : '#2a2a2a',
                    color: p.stato_cliente==='accettato' ? '#86efac' : p.stato_cliente==='rifiutato' ? '#ef4444' : '#888'
                 
                  }}>
                    {p.stato_cliente==='accettato' ? '✓ Accettato' : p.stato_cliente==='rifiutato' ? '✗ Rifiutato' : '⏳ In attesa'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
//  LOADING DOTS
// ─────────────────────────────────────────
const LoadingDots = ({big=false}) => (
  <span style={{display:"inline-flex",gap:big?6:4,alignItems:"center"}}>
    <span style={{width:big?10:6,height:big?10:6,background:"#22c55e",borderRadius:"50%",display:"inline-block",opacity:0.3}}/>
    <span style={{width:big?10:6,height:big?10:6,background:"#22c55e",borderRadius:"50%",display:"inline-block",opacity:0.6}}/>
    <span style={{width:big?10:6,height:big?10:6,background:"#22c55e",borderRadius:"50%",display:"inline-block",opacity:1}}/>
  </span>
);

// ─────────────────────────────────────────
//  BOTTOM NAV
// ─────────────────────────────────────────
const NAV=[{id:"home",icon:"🏠",label:"HOME"},{id:"nuovo",icon:"📝",label:"BOZZE"},{id:"archivio",icon:"📂",label:"ARCHIVIO"}];
const BottomNav = ({active,onChange,hasPrev,desktopTop=false}) => (
  <div style={{
    position: desktopTop ? "relative" : "fixed",
    bottom: desktopTop ? "auto" : 0,
    left: desktopTop ? 0 : "50%",
    transform: desktopTop ? "none" : "translateX(-50%)",
    width:"100%",
    maxWidth: desktopTop ? "100%" : 480,
    background:C1,borderTop:`1px solid ${BR}`,display: !desktopTop && window.innerWidth >= 768 ? "none" : "flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
    {NAV.map(n=>(
      <button key={n.id} onClick={()=>onChange(n.id)} style={{flex:1,background:"none",
        border:"none",color:active===n.id ? G : "rgba(255,255,255,0.7)",padding:"12px 8px 10px",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color .15s"}}>
        <span style={{font_size:n.id==="nuovo"?28:24}}>{n.icon}</span>
        <span style={{fontSize:14,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:0.5}}>{n.label}</span>
      </button>
    ))}
  </div>
);


function DocumentazionePubblica({token}) {
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    supabase
      .from("preventivi")
      .select("dati")
      .eq("token", token)
      .single()
      .then(({ data }) => {
        console.log("TOKEN DOCUMENTAZIONE:", token);
        console.log("DATA DOCUMENTAZIONE:", data);

        if (data?.dati) {
          setDoc({
            ...data.dati.documentazione_lavoro,
            veicolo: data.dati.veicolo,
            cliente: data.dati.cliente,
            note: data.dati.documentazione_lavoro?.note || "",
            foto: data.dati.documentazione_lavoro?.foto || []
          });
        }
      });
  }, [token]);

  if (!doc) {
    return (
      <div style={{
        minHeight:"100vh",
        background:"#111",
        color:"#fff",
        display:"flex",
        alignItems:"center",
        justifyContent:"center"
      }}>
        Caricamento documentazione...
      </div>
    );
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"#111",
      color:"#fff",
      padding:20
    }}>
      <div style={{
        maxWidth:900,
        margin:"0 auto"
      }}>
        <h1 style={{
          color:"#f30d0de6",
          fontWeight:800,
          textShadow:"0 1px 8px rgba(0,0,0,0.8)",
          fontSize:32,
          marginBottom:8
        }}>
          📸 Documentazione lavoro
        </h1>

        <div style={{
          opacity:.7,
          marginBottom:24
        }}>
          {doc.veicolo} — {doc.cliente}
        </div>

        {doc.note && (
          <>
            <div style={{
              fontSize:14,
              letterSpacing:1,
              textTransform:"uppercase",
              opacity: .6,
              marginBottom:8
            }}>
              Note lavoro
            </div>
            <div style={{
              background:"#1b1b1b",
              padding:16,
              borderRadius:12,
              marginBottom:24,
              lineHeight:1.6
            }}>
              {doc.note}
            </div>
          </>
        )}

        <>
          <div style={{
            fontSize:14,
            letterSpacing:1,
            textTransform:"uppercase",
            opacity:.6,
            marginBottom:12
          }}>
            Foto intervento
          </div>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",
            gap:16
          }}>
            {(doc.foto || []).map((foto, i) => (
              <img
                key={i}
                src={foto.preview || foto.url}
                alt=""
                style={{
                  width:"100%",
                  borderRadius:14,
                  objectFit:"cover",
                  border:"1px solid #2a2a2a"
                }}
              />
            ))}
          </div>
        </>
      </div>
    </div>
  );
}

function PreventivoPublico({token}) {
  const [prev, setPrev] = useState(null);
  const [stato, setStato] = useState(null);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    supabase.from("preventivi").select("dati,stato_cliente").eq("token", token).single()
      .then(({data,error}) => {
        if (data) { setPrev(data.dati); setStato(data.stato_cliente); }
      });
  }, [token]);

  const rispondi = async (risposta) => {
    const testo = risposta === 'accettato' 
      ? "Confermi di accettare il preventivo?" 
      : "Confermi di rifiutare il preventivo?";
    if (!confirm(testo)) return;
  
    await supabase.from("preventivi").update({stato_cliente: risposta}).eq("token", token);
  
    await fetch('/api/notifica-risposta', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stato: risposta,
        veicolo: prev.veicolo,
        numero: prev.numero
      })
    });
  
    setStato(risposta); setFatto(true);
  };

  if (!prev) return <div style={{background:"#080808",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"Barlow Condensed"}}>Caricamento...</div>;

  return (
    <div style={{background:"#080808",minHeight:"100vh",padding:20,fontFamily:"'Barlow Condensed',sans-serif",color:"#fff",maxWidth:480,margin:"0 auto"}}>
      <Logo h={32}/>
      <div style={{marginTop:20,background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:16}}>
        <div style={{fontSize:11,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Preventivo {prev.numero}</div>
        <div style={{fontSize:24,fontWeight:900,color:"#fff",marginTop:4}}>{prev.veicolo}</div>
        <div style={{fontSize:13,color:"#aaa",marginTop:4}}>{prev.descrizione_lavoro}</div>
        <div style={{fontSize:32,fontWeight:900,color:"#22c55e",marginTop:12}}>{fmt(tot(prev.voci))}</div>
        <div style={{fontSize:11,color:"#555",marginTop:2}}>IVA esclusa</div>
      </div>

      
      {fatto || stato !== 'in_attesa' ? (
        <div style={{marginTop:20,textAlign:"center",padding:24,background:stato==='accettato'?"#0a2a0a":"#2a0a0a",borderRadius:12}}>
          <div style={{fontSize:32}}>{stato==='accettato'?"✅":"❌"}</div>
          <div style={{fontSize:20,fontWeight:800,marginTop:8}}>{stato==='accettato'?"Preventivo accettato":"Preventivo rifiutato"}</div>
          <div style={{fontSize:13,color:"#888",marginTop:4}}>La tua scelta è stata salvata correttamente.</div>
        </div>
      ) : (
        <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
          <button onClick={()=>rispondi('accettato')} style={{background:"#22c55e",color:"#000",border:"none",borderRadius:12,padding:"18px",fontSize:18,fontWeight:900,cursor:"pointer"}}>✅ ACCETTO IL PREVENTIVO</button>
          <button onClick={()=>rispondi('rifiutato')} style={{background:"transparent",color:"#ef4444",border:"1px solid #ef4444",borderRadius:12,padding:"18px",fontSize:18,fontWeight:900,cursor:"pointer"}}>❌ RIFIUTO IL PREVENTIVO</button>
        </div>
      )}

      <button
        onClick={() => scaricaPDF(prev)}
        style={{
          width: '100%',
          marginTop: 16,
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          color: '#fff',
          padding: '14px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
         📄 Scarica PDF 
      </button>

    </div>
  );
}

// ─────────────────────────────────────────
//  APP
// ─────────────────────────────────────────
export default function App() {
  const urlPath = window.location.pathname;
  if (urlPath.startsWith('/preventivo/')) {
    const token = urlPath.split('/preventivo/')[1];
    return <PreventivoPublico token={token} />;
  }

  if (urlPath.startsWith('/documentazione/')) {
    const token = urlPath.split('/documentazione/')[1];
    return <DocumentazionePubblica token={token} />;
  }


  const [db,setDb]=useState({preventivi:[],clienti:[],nextNum:1});
  const [dbLoaded,setDbLoaded]=useState(false);
  const [screen,setScreen]=useState("home");
  const [draft,setDraft]=useState(null);
  const [savedId,setSavedId]=useState(null);
  const [viewPrev,setViewPrev]=useState(null);
  const [lavoriData, setLavoriData] = useState({
    note: "",
    foto: []
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data === "CHIUDI_FORM_QR") {
        setScreen("home");
        return;
      }
      if (event.data?.type === "GENERA_DA_BOZZA_QR") {
        console.log("Genera da bozza QR:", event.data.bozzaId);
        setScreen("home");
        return;
      }
    };
    const params = new URLSearchParams(window.location.search);
    const generaBozzaId = params.get("generaBozza");

    if (generaBozzaId) {
      setScreen("nuovo");
    }
    
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  registraPushNotifiche();

  useEffect(()=>{ loadDB().then(d=>{ setDb(d); setDbLoaded(true); }); },[]);

  const persist = d => { setDb(d); saveDB(d); };

  const onGenerated = (aiResult, inputOrig, usaListino = false, extra = {}) => {
    const num = prevN(db.nextNum);

    const veicoloPulito = (aiResult.veicolo || "")
      .replace(/\b(19|20)\d{2}\b/g, "")
      .trim();
    const p = {
      id: nId(), numero: num, data: new Date().toISOString(),
      inputOriginale: inputOrig, stato: "bozza",
      usaListino: usaListino,
      cliente: extra.cliente || "",
      telefono: extra.telefono || "",
      client_id: extra.client_id || null,
      tipo_pratica: extra.tipo_pratica || "",
      bozza_id: extra.bozza_id || null,
      targa: extra.targa || aiResult.targa || "",
      veicolo: veicoloPulito, descrizione_lavoro: aiResult.descrizione_lavoro,
      voci: aiResult.voci.map(v => {
        const descrizione = (v.descrizione || "").toLowerCase();
        const tipo = (v.tipo || "").toLowerCase();
        const richiesta = `${descrizione} ${inputOrig || ""}`.toLowerCase();

        let prezzoListino = v.prezzo;

        if (tipo === "manodopera" || descrizione.includes("manodopera")) {
            prezzoListino = LISTINO.manodopera;
        } 

        
          

        if (descrizione.includes("diagnosi") || descrizione.includes("azzeramento") || descrizione.includes("azzeramenti")) {
            prezzoListino = LISTINO.diagnosi;
        }

        if (descrizione.includes("pre revisione") || descrizione.includes("prerevisione") || descrizione.includes("controlli revisione")) {
            prezzoListino = LISTINO.prerevisione;
        }

        // OLIO MOTORE
        if (descrizione.includes("olio motore")) {
          if (richiesta.includes("0w20")) prezzoListino = LISTINO.oli.motore["0W20"];
          else if (richiesta.includes("0w30")) prezzoListino = LISTINO.oli.motore["0W30"];
          else if (richiesta.includes("5w30")) prezzoListino = LISTINO.oli.motore["5W30"];
          else if (richiesta.includes("5w40")) prezzoListino = LISTINO.oli.motore["5W40"];
        }

        // ANTIGELO
        if (descrizione.includes("antigelo")) {
          if (richiesta.includes("blu")) prezzoListino = LISTINO.antigelo.blu;
          else if (richiesta.includes("rosso")) prezzoListino = LISTINO.antigelo.rosso;
          else if (richiesta.includes("giallo") || richiesta.includes("verde")) {
            prezzoListino = LISTINO.antigelo.giallo_verde;
          }
        }

        // OLIO CAMBIO
        if (descrizione.includes("olio cambio")) {
          if (richiesta.includes("75w85")) {
            prezzoListino = LISTINO.oli.cambio["75W85"];
          }
        }

        // OLIO FRENI
        if (descrizione.includes("olio freni")) {
          if (richiesta.includes("dot4") || richiesta.includes("dot 4")) {
            prezzoListino = LISTINO.oli.freni["DOT4"];
          }
        }

        // LAMPADE
        if (
          descrizione.includes("lampada") ||
          descrizione.includes("lampade") ||
          descrizione.includes("lampadina") ||
          descrizione.includes("lampadine")
        ) {
          if (richiesta.includes("h7")) {
            prezzoListino = LISTINO.lampade.H7;
          } else if (richiesta.includes("h4")) {
            prezzoListino = LISTINO.lampade.H4;
          } else if (
            richiesta.includes("21w") ||
            richiesta.includes("12v 21w") ||
            richiesta.includes("12v_21w")
          ) {
            prezzoListino = LISTINO.lampade["12V_21W"];
          } else if (
            richiesta.includes("5w") ||
            richiesta.includes("12v 5w") ||
            richiesta.includes("12v_5w")
          ) {
            prezzoListino = LISTINO.lampade["12V_5W"];
          }
        }
        

        return {
          ...v,
          id: nId(),

           
          prezzo: prezzoListino
        };
      }),
      note_tecniche: aiResult.note_tecniche||""
    };
    setDraft(p); setSavedId(null); setScreen("edit");
  };

  const onSalva = async () => {
    try {
      // 1. Salva su Supabase
      

      const token = nId() + nId();
      const isUpdate = db.preventivi.some(p => p.id === draft.id);

      let error;

      if (isUpdate) {
        const result = await supabase
          .from("preventivi")
          .update({ dati: draft })
          .eq("dati->>id", draft.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("preventivi")
          .insert([{ dati: draft, stato_cliente: 'in_attesa', token }]);
        error = result.error;
      }

      if (error) {
        console.error("Errore Supabase:", error);
        return;
      }

      if (draft.bozza_id) {
        
        const { error: erroreBozza } = await supabase
          .from("preventivi_bozze")
          .delete()
          .eq("id", draft.bozza_id);

        if (erroreBozza) {
          console.error("Errore eliminazione bozza QR:", erroreBozza);
        }
      }

      

      // 2. Mantieni anche il salvataggio locale (backup)
      const newDb = {
        ...db,
        preventivi: [draft, ...db.preventivi.filter(p => p.id !== draft.id)],
        nextNum: db.nextNum + 1
      };
      
      persist(newDb);

      setSavedId(draft.id);

    } catch (e) {
      console.error("Errore salvataggio:", e);
    }
  };

  const onOpenFromArchivio = p => { setViewPrev(p); setScreen("view"); };
    const onDeleteFromArchivio = async (p) => {
    const ok = confirm("Eliminare questo preventivo dall'archivio?");
    if (!ok) return;

    const { error } = await supabase
      .from("preventivi")
      .delete()
      .eq("dati->>id", p.id);

    if (error) {
      console.error("Errore eliminazione preventivo:", error);
      alert("Errore eliminazione preventivo");
      return;
    }

    persist({
      ...db,
      preventivi: db.preventivi.filter(x => x.id !== p.id)
    });

    setViewPrev(null);
    setScreen("archivio");
  };

  const salvaDocumentazioneLavoro = async () => {
    if (!viewPrev?.id) {
      alert("Preventivo non valido");
      return;
    }

    const documentazione = {
      note: lavoriData.note || "",
      foto: lavoriData.foto.map(f => ({
        id: f.id,
        nome: f.nome,
        path: f.path,
        url: f.preview
      })),
      aggiornata_il: new Date().toISOString()
    };

    const preventivoAggiornato = {
      ...viewPrev,
      documentazione_lavoro: documentazione
    };

    const { error } = await supabase
      .from("preventivi")
      .update({ dati: preventivoAggiornato })
      .eq("dati->>id", viewPrev.id);

    if (error) {
      console.error("Errore salvataggio documentazione:", error);
      alert("Errore nel salvataggio della documentazione");
      return;
    }

    setViewPrev(preventivoAggiornato);

    const newDb = {
      ...db,
      preventivi: db.preventivi.map(p =>
        p.id === viewPrev.id ? preventivoAggiornato : p
      )
    };

    persist(newDb);

    alert("Documentazione salvata");
  };

  if(!dbLoaded) return (
    <div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><Logo h={40}/><div style={{color:MT,marginTop:20,fontSize:13}}>Caricamento...</div></div>
    </div>
  );


     
  return (
    <div style={{
      background: BG,
      minHeight: "100vh",
      width: "100vw",
      fontFamily: "Barlow Condensed, sans-serif",
      overflowX: "hidden"
    }}>

      <div style={{
        width: "100%",
        minHeight: "100vh",
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
        overflowX: "hidden"
      }}>
  

      {/* Header */}
      <div style={{background:C1,borderBottom:`1px solid ${BR}`,padding:"14px 16px",position:"sticky",top:0,zIndex:50,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo h={32}/>
        {window.innerWidth >= 768 && (
          <BottomNav
            desktopTop={true}
            active={screen==="home"?"home":screen==="archivio"||screen==="view"?"archivio":screen==="cliente"?"cliente":screen==="nuovo"?"nuovo":"home"}
            onChange={(id)=>{
              if(id==="home") setScreen("home");
              else if(id==="cliente") setScreen("cliente");
              else if(id==="nuovo"){
                setDraft(null);
                setSavedId(null);
                setScreen("nuovo");
              }
              else if(id==="archivio") setScreen("archivio");
            }}
          />
        )}

        <div style={{fontSize:13,lineHeight:1.15,color:"rgba(255,255,255,0.85)",textAlign:"right",fontFamily:"'Barlow Condensed',sans-serif"}}>
          <div>{new Date().toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"})}</div>
          <div style={{color:G,fontWeight:800,fontSize:18}}>{db.preventivi.filter(p=>mKey(p.data)===mKey(new Date().toISOString())).length} prev. questo mese</div>
        </div>
      </div>

      {/* Nav PC */}
      {window.innerWidth >= 768 && (
        <BottomNav
          active={screen==="home"?"home":screen==="archivio"||screen==="view"?"archivio":screen==="cliente"?"cliente":screen==="nuovo"?"nuovo":"home"}
          onChange={(id)=>{
            if(id==="home") setScreen("home");
            else if(id==="cliente") setScreen("cliente");
            else if(id==="nuovo"){
              setDraft(null);
              setSavedId(null);
              setScreen("nuovo");
            }
            else if(id==="archivio") setScreen("archivio");
          }}
        />
      )}

      {/* Body */}
      <div style={{
        padding: 16,
        paddingBottom: "calc(120px + env(safe-area-inset-bottom))",
        animation: "fadeIn .2s ease"
      }}>
        {screen==="home" && (
          <Dashboard
            db={db}
            onNuovo={()=>{
              setDraft(null);
              setSavedId(null);
              setScreen("nuovo");
            }}
            onArchivio={()=>setScreen("archivio")}
            onCliente={() => setScreen("cliente")}
          />
        )}
        {screen==="nuovo" && (
          <Nuovo onGenerated={onGenerated} onBack={()=>setScreen("home")}/>
        )}
        {screen==="edit" && draft && (
          <EditPreventivo
            prev={draft}
            onChange={setDraft}
            onPreview={(updatedPrev) => {
              if(!updatedPrev.veicolo || updatedPrev.veicolo==="Da specificare"){
                alert("⚠️ Inserisci il veicolo"); return;
              }

              if(updatedPrev.voci.length===0){
                alert("⚠️ Aggiungi almeno una voce"); return;
              }

              setDraft(updatedPrev);
              setScreen("preview");
            }}
            onBack={() => setScreen("home")}
          />
        )}
        {screen==="preview" && draft && (
          <Preview prev={draft} onSalva={onSalva} onEdit={()=> setScreen("edit")} onBack={()=>setScreen("edit")} saved={savedId===draft.id}/>
        )}
        {screen==="archivio" && (
          <Archivio db={db} onBack={()=>setScreen("home")} onOpen={onOpenFromArchivio}/>
        )}
        {screen==="view" && viewPrev && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Preview prev={viewPrev} onEdit={()=>{setDraft(viewPrev); setSavedId(null); setScreen("edit")}} onBack={()=>setScreen("archivio")} saved={true}/>
            <button onClick={() => {
               const link = `https://assistente-officinaprev.vercel.app/preventivo/${viewPrev.token}`;
               const testo = `🔧 *DS84 OFFICINE* — Preventivo\n🚗 ${viewPrev.veicolo}\n\nPuò visualizzare e accettare il preventivo al seguente link:\n${link}`;
               const numero = viewPrev.telefono ? `39${viewPrev.telefono.replace(/\s/g,'')}` : '';
               window.open(`https://wa.me/${numero}?text=${encodeURIComponent(testo)}`);
            }} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
                📲 INVIA SU WHATSAPP
            </button>
            
            {viewPrev?.tipo_pratica === "fattura" && (
            <button
              onClick={() => {
                setLavoriData({
                  note: viewPrev.documentazione_lavoro?.note || "",
                  foto: (viewPrev.documentazione_lavoro?.foto || []).map(f => ({
                    ...f,
                    preview: f.preview || f.url
                  }))
                });

                 setScreen("lavori");
              }}
              style={{
                background:"#1E293B",
                color:"#fff",
                border:"none",
                borderRadius:10,
                padding:"14px",
                fontSize:15,
                fontWeight:700
              }}
            >
              📷 DOCUMENTAZIONE LAVORO
            </button>
            )}

            
            <button onClick={()=>onDeleteFromArchivio(viewPrev)} style={{background:"none",border:`1px solid #3f1212`,color:"#ef4444",borderRadius:8,padding:"10px",fontSize:12,cursor:"pointer",fontFamily:"'Barlow',sans-serif"}}>
              🗑 Elimina preventivo
            </button>
          </div>
        )}
      </div>

      {screen==="lavori" && viewPrev && (
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          <button
            onClick={() => setScreen("view")}
            style={{
              background:"none",
              border:"none",
              color:MT2,
              fontSize:18,
              cursor:"pointer",
              alignSelf:"flex-start"
            }}
          >
            ← Torna al preventivo
          </button>

          <div style={{
            background:C2,
            border:`1px solid ${BR}`,
            borderRadius:14,
            padding:18
          }}>
            <div style={{
              fontFamily:"Barlow Condensed, sans-serif",
              fontSize:24,
              fontWeight:800,
              color:TX,
              marginBottom:6,
              textTransform:"uppercase"
            }}>
              📷 Documentazione lavoro
            </div>

            <div style={{color:MT2, fontSize:14, marginBottom:18}}>
              {viewPrev.veicolo || "Veicolo"} — {viewPrev.cliente || "Cliente"}
            </div>

            <div style={{
              color:MT2,
              fontSize:13,
              letterSpacing:1,
              textTransform:"uppercase",
              marginBottom:8
            }}>
              Note lavoro
            </div>

            <textarea
              value={lavoriData.note}
              onChange={(e) => setLavoriData({...lavoriData, note:e.target.value})}
              placeholder="Es: foto dei componenti sostituiti, prodotti utilizzati, dettagli dell’intervento..."
              rows={5}
              style={{
                width:"100%",
                background:BG,
                border:`1px solid ${BR}`,
                borderRadius:10,
                color:TX,
                padding:12,
                fontSize:15,
                resize:"none",
                marginBottom:16
              }}
            />

            

            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!viewPrev?.numero) {
                    alert("Preventivo non valido: numero mancante");
                    return;
                  }

                  const uploadate = [];

                  for (const file of files) {
                    const nomePulito = file.name.replace(/\s+/g, "-");
                    const nomeFile = `${viewPrev.numero}/${Date.now()}-${nomePulito}`;

                    const { error } = await supabase
                      .storage
                      .from("documentazione-lavoro")
                      .upload(nomeFile, file);

                    if (error) {
                      console.error("Errore upload:", error);
                      alert("Errore durante il caricamento di una foto");
                      continue;
                    }

                    const { data } = supabase
                      .storage
                      .from("documentazione-lavoro")
                      .getPublicUrl(nomeFile);

                    uploadate.push({
                       id: Date.now() + Math.random(),
                       nome: file.name,
                       path: nomeFile,
                       preview: data.publicUrl
                    });
                  }

                  setLavoriData({
                    ...lavoriData,
                    foto: [...lavoriData.foto, ...uploadate]
                  });

                  e.target.value = "";
                }}
                style={{display:"none"}}
                id="upload-foto-lavoro"
              />

              <label
                htmlFor="upload-foto-lavoro"
                style={{
                  background:BG,
                  border:`1px dashed ${BR}`,
                  borderRadius:12,
                  padding:18,
                  color:MT2,
                  textAlign:"center",
                  fontSize:14,
                  cursor:"pointer"
                }}
              >
                📸 Carica foto lavoro
              </label>

              

              {lavoriData.foto.length > 0 && (
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",
                  gap:12
                }}>
                  {lavoriData.foto.map(foto => (
                    <div
                      key={foto.id}
                      style={{
                        position:"relative",
                        borderRadius:12,
                        overflow:"hidden",
                        border:`1px solid ${BR}`
                      }}
                    >
                      <img
                        src={foto.preview}
                        alt=""
                        style={{
                          width:"100%",
                          height:120,
                          objectFit:"cover",
                          display:"block"
                        }}
                      />

                      <button
                        onClick={()=>{
                          setLavoriData({
                            ...lavoriData,
                            foto:lavoriData.foto.filter(f=>f.id !== foto.id)
                          });
                        }}
                        style={{
                          position:"absolute",
                          top:6,
                          right:6,
                          background:"rgba(0,0,0,0.7)",
                          color:"#fff",
                          border:"none",
                          borderRadius:8,
                          padding:"4px 8px",
                          cursor:"pointer"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                


               )}

               <button
              onClick={salvaDocumentazioneLavoro}
              style={{
                background:"#25D366",
                color:"#fff",
                border:"none",
                borderRadius:10,
                padding:"14px",
                fontSize:15,
                fontWeight:800,
                cursor:"pointer"
              }}
            >
               💾 SALVA DOCUMENTAZIONE
            </button>

             </div>
          </div>
        </div>
      )}

      {screen==="cliente" && (
        <div style={{
          position:"fixed",
          inset:0,
          zIndex:9999,
          background:"#fff",
          display:"flex",
          flexDirection:"column",
          height:"100dvh",
          overflow:"hidden"
        }}>

         
          <iframe
            src="https://officina-qr-form.vercel.app"
            title="Form cliente"
            style={{
              width:"100vw",
              height: "100%",
            
              border:"none",
              display:"block"
            }}
          />
        </div>
      )}

      {/* Bottom nav */}
      {window.innerWidth < 768 && (
        
       
       <BottomNav active={screen==="home"?"home":screen==="archivio"||screen==="view"?"archivio":screen==="cliente" ? "cliente" :"nuovo"}
        onChange={id=>{
          if(id==="home") setScreen("home");
          else if(id==="cliente") setScreen("cliente");
          else if(id==="nuovo"){
            setDraft(null);
            setSavedId(null);
            setScreen("nuovo");
          }
          else if(id==="archivio") setScreen("archivio");
        }}
       />
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,textarea,select{outline:none}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        @keyframes blink{0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:10px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#ff5a1f;border-radius:10px}
      `}</style>
    </div>
  </div>
  );
}
