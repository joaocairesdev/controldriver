export { formatarMoeda } from "../../../shared/utils/moeda";

export function formatarMoedaDigitada(valor) {
  const somenteDigitos = String(valor ?? "").replace(/\D/g, "");
  if (!somenteDigitos) return "";

  const centavos = Number(somenteDigitos.replace(/^0+/, "") || "0");
  if (!centavos) return "";

  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function numeroParaMoedaInput(valor) {
  const numero = Number(valor || 0);
  if (!numero) return "";

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moedaParaNumero(valor) {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
}

export function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

export function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function adicionarMeses(dataISO, meses) {
  if (!dataISO) return "";

  const data = new Date(`${dataISO}T00:00:00`);
  const diaOriginal = data.getDate();

  data.setMonth(data.getMonth() + Number(meses || 0));

  if (data.getDate() !== diaOriginal) {
    data.setDate(0);
  }

  return data.toISOString().split("T")[0];
}

export function textoOrigemItem(tipo) {
  const textos = {
    fatura: "Fatura de cartão",
    conta: "Conta/boletos",
    conta_negativa: "Conta negativa",
  };

  return textos[tipo] || tipo || "Dívida";
}

export function textoTipoRenegociacao(tipo) {
  return tipo === "parcial" ? "Parcial" : "Total";
}

export function textoFormaPagamento(valor) {
  const textos = {
    debito_conta: "Débito em conta",
    boleto: "Boleto",
    pix: "Pix",
    dinheiro: "Dinheiro",
    transferencia: "Transferência",
    credito: "Cartão de crédito",
  };

  return textos[valor] || valor || "-";
}

export function normalizarDescricao(texto) {
  return String(texto || "").trim();
}
