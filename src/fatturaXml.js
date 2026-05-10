import { OFFICINA } from "./config/officina";

const xmlEscape = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const formatPrezzo = (value = 0) =>
  Number(value || 0).toFixed(2);

export function generaXmlFatturaPA(preventivo, datiCliente = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12"
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <FatturaElettronicaHeader>

    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${xmlEscape(OFFICINA.partitaIva)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>

    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${xmlEscape(OFFICINA.partitaIva)}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${xmlEscape(OFFICINA.ragioneSociale)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${xmlEscape(OFFICINA.regimeFiscale)}</RegimeFiscale>
      </DatiAnagrafici>

      <Sede>
        <Indirizzo>${xmlEscape(OFFICINA.indirizzo)}</Indirizzo>
        <CAP>${xmlEscape(OFFICINA.cap)}</CAP>
        <Comune>${xmlEscape(OFFICINA.comune)}</Comune>
        <Provincia>${xmlEscape(OFFICINA.provincia)}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>


    <CessionarioCommittente>
      <DatiAnagrafici>

        ${datiCliente.partitaIva ? `
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${xmlEscape(datiCliente.partitaIva)}</IdCodice>
        </IdFiscaleIVA>
        ` : ""}

        ${datiCliente.codiceFiscale ? `
        <CodiceFiscale>${xmlEscape(datiCliente.codiceFiscale)}</CodiceFiscale>
        ` : ""}

        <Anagrafica>
          <Denominazione>${xmlEscape(datiCliente.nome || "Cliente")}</Denominazione>
        </Anagrafica>

      </DatiAnagrafici>

      <Sede>
        <Indirizzo>${xmlEscape(datiCliente.indirizzo || "")}</Indirizzo>
        <CAP>${xmlEscape(datiCliente.cap || "00000")}</CAP>
        <Comune>${xmlEscape(datiCliente.comune || "")}</Comune>
        <Provincia>${xmlEscape(datiCliente.provincia || "")}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>

    </CessionarioCommittente>

  </FatturaElettronicaHeader>

  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${new Date().toISOString().slice(0,10)}</Data>
        <Numero>1</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>

    <DatiBeniServizi>

    ${preventivo.voci.map((v, i) => `
      <DettaglioLinee>
        <NumeroLinea>${i + 1}</NumeroLinea>
        <Descrizione>${xmlEscape(v.descrizione)}</Descrizione>
        <Quantita>${Number(v.qta || 1).toFixed(2)}</Quantita>
        <PrezzoUnitario>${formatPrezzo(v.prezzo)}</PrezzoUnitario>
        <PrezzoTotale>${Number((v.qta || 1) * v.prezzo).toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
    `).join("")}

    <DatiRiepilogo>
      <AliquotaIVA>22.00</AliquotaIVA>
      <ImponibileImporto>
        ${formatPrezzo(
          preventivo.voci.reduce((sum, v) => sum + (v.prezzo * (v.qta || 1)), 0)
        )}
      </ImponibileImporto>
      <Imposta>
        ${formatPrezzo(
          preventivo.voci.reduce((sum, v) => sum + (v.prezzo * (v.qta || 1)), 0) * 0.22
        )}
      </Imposta>
      <EsigibilitaIVA>I</EsigibilitaIVA>
    </DatiRiepilogo>

    </DatiBeniServizi>

  </FatturaElettronicaBody>

</p:FatturaElettronica>`;
}