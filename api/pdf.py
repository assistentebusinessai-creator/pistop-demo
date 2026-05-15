# from reportlab.lib.pagesizes import A4
# from reportlab.lib import colors
# from reportlab.lib.units import mm
# from reportlab.pdfgen import canvas
# from reportlab.platypus import Table, TableStyle
from reportlab.lib.utils import simpleSplit
# from PyPDF2 import PdfReader, PdfWriter
import json, base64, os
from http.server import BaseHTTPRequestHandler

# W, H = A4

def genera(dati):
    from reportlab.pdfgen import canvas
    from PyPDF2 import PdfReader, PdfWriter
    import io, os

    # Percorso template
    template_path = os.path.join(os.path.dirname(__file__), "preventivo_ds842.pdf")

    # Leggi template
    reader = PdfReader(template_path)
    writer = PdfWriter()

    # Crea overlay (scrittura sopra)
    packet = io.BytesIO()
    c = canvas.Canvas(packet)

    # 🔥 SCRIVIAMO IL CLIENTE (coordinate)
    c.setFont("Helvetica", 10)
    cliente = dati.get("nome", "").upper()
    c.drawString(23, 675, cliente)

    targa = dati.get("targa", "").upper()
    c.setFont("Helvetica", 10)
    c.drawString(522, 627, targa)

    telaio = dati.get("telaio", "").upper().strip()
    if telaio:
        c.setFont("Helvetica", 10)
        c.drawString(30, 627, telaio)

    # 🔥 VEICOLO SPLITTATO
    veicolo =(dati.get("modello", "") or dati.get("marca", "")).upper()

    parti = veicolo.split(" ", 1)
    sigla_modello = parti[0] if len(parti) > 0 else ""
    marca_descrizione = parti[1] if len(parti) > 1 else ""

    c.setFont("Helvetica", 10)
    c.drawString(168, 626, sigla_modello)
    c.drawString(288, 626, marca_descrizione)

    telefono = dati.get("tel", "").upper()
    c.drawString(180, 650, telefono)

    descrizione = dati.get("descrizione_lavoro", "").upper().strip()

    # 1) Spezza prima per frasi
    frasi_raw = [f.strip() for f in descrizione.split(".") if f.strip()]

    # 2) Rimette il punto finale a ogni frase
    frasi = [f + "." for f in frasi_raw]

    # 3) Wrappa ogni frase separatamente dentro il box
    desc_font = 9 if len(frasi) > 3 else 10
    desc_leading = 9 if len(frasi) > 3 else 13

    righe_finali = []
    for frase in frasi:
        righe = simpleSplit(frase, "Helvetica", desc_font, 360)
        righe_finali.extend(righe)

    if len(righe_finali) > 4:
        desc_font = 8.5
        desc_leading = 8.8

    text = c.beginText()
    text.setTextOrigin(45, 562)
    text.setFont("Helvetica-Bold", desc_font)
    text.setLeading(desc_leading)

    for riga in righe_finali:
        text.textLine(riga)

    
    c.drawText(text)

    y = 455

    voci = dati.get("voci", [])

    mostra_prezzi = dati.get("mostraPrezziPDF", False)

    # base descrizioni iniziali
    descrizioni_base = [v.get("descrizione", "").lower() for v in voci]

    # TAGLIANDO
    if any("olio" in d for d in descrizioni_base):
        # aggiunta controllo livelli se manca
        if not any("controllo livelli" in d for d in descrizioni_base):
            voci.append({
                "descrizione": "CONTROLLO LIVELLI",
                "qta": 1,
                "prezzo": 0
            })

        # aggiunta smaltimento rifiuti se manca
        if not any("smaltimento rifiuti" in d for d in descrizioni_base):
            voci.append({
                "descrizione": "SMALTIMENTO RIFIUTI",
                "qta": 1,
                "prezzo": 0
            })

    # FRENI
    if any("freno" in d for d in descrizioni_base):
        if not any("controllo impianto frenante" in d for d in descrizioni_base):
            voci.append({
                "descrizione": "CONTROLLO IMPIANTO FRENANTE",
                "qta": 1,
                "prezzo": 0
            })

    # MANODOPERA sempre ultima
    manodopera = [v for v in voci if v.get("descrizione", "").strip().lower() == "manodopera"]
    altre_voci = [v for v in voci if v.get("descrizione", "").strip().lower() != "manodopera"]
    voci = altre_voci + manodopera

    tot_imponibile = 0.0

    num_voci = len(voci)

    if num_voci <= 5:
        step_riga = 18
    elif num_voci <= 8:
        step_riga = 15
    else:
        step_riga = 12

    overflow_voci = []
    num_voci = len(voci)

    if num_voci <= 12:
        font_voci = 9
        line_height = 7
    elif num_voci <= 18:
        font_voci = 8
        line_height = 6.5
    else:
        font_voci = 7.5
        line_height = 6

    y_min_voci = 330

    for idx, voce in enumerate(voci):
        descrizione = voce.get("descrizione", "").upper()
        qta = float(voce.get("qta", 0) or 0)
        prezzo = float(voce.get("prezzo", 0) or 0)

        imponibile = qta * prezzo
        tot_imponibile += imponibile

        c.setFont("Helvetica", font_voci)

        righe_descrizione = simpleSplit(descrizione, "Helvetica", font_voci, 300)
        extra_spazio = 3 if len(righe_descrizione) > 1 else 1
        altezza_voce = max(8, len(righe_descrizione) * line_height + extra_spazio)

        if y - altezza_voce < y_min_voci:
             break

        y_centro = y - ((altezza_voce - line_height) / 2)

        for i, riga in enumerate(righe_descrizione):
            c.drawString(45, y - (i * line_height), riga)

        qta_txt = str(int(qta)) if qta.is_integer() else str(qta).replace(".", ",")
        c.drawRightString(372, y_centro, qta_txt)

        if mostra_prezzi:
            prezzo_txt = f"{prezzo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            c.drawRightString(445, y_centro, prezzo_txt)

        y -= altezza_voce

    tot_iva = tot_imponibile * 0.22
    tot_finale = tot_imponibile + tot_iva

    tot_imponibile_txt = f"{tot_imponibile:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    tot_iva_txt = f"{tot_iva:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    tot_finale_txt = f"{tot_finale:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    c.setFont("Helvetica-Bold", 9)

    # numeri nella colonna di destra del box riepilogo
    c.drawRightString(520, 316, tot_imponibile_txt)   # LISTINO
    c.drawRightString(520, 301, tot_iva_txt)          # IVA (22%)
    c.drawRightString(520, 285, tot_finale_txt)       # TOTALE LAVORAZIONE

    c.save()

    packet.seek(0)
    overlay = PdfReader(packet)

    # Unisci overlay + template
    page = reader.pages[0]
    page.merge_page(overlay.pages[0])
    writer.add_page(page)
    
    
    output = io.BytesIO()
    writer.write(output)

    return output.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length",0))
        body = self.rfile.read(length)
        try:
            dati = json.loads(body)
            pdf_bytes = genera(dati)
            self.send_response(200)
            self.send_header("Content-Type","application/pdf")
            self.send_header("Content-Disposition", f'attachment; filename="preventivo_{dati.get("numero","DS84")}.pdf"')
            self.send_header("Content-Length", str(len(pdf_bytes)))
            self.end_headers()
            self.wfile.write(pdf_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error":str(e)}).encode())
    def do_GET(self):
        try:
            template_path = os.path.join(os.path.dirname(__file__), "preventivo_ds842.pdf")
            with open(template_path, "rb") as f:
                pdf_bytes = f.read()

            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", "inline; filename=template-test.pdf")
            self.send_header("Content-Length", str(len(pdf_bytes)))
            self.end_headers()
            self.wfile.write(pdf_bytes)

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8"))
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.end_headers()