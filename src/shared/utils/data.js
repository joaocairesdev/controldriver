import { obterFusoHorario } from "./preferencias";

export function hojeBrasil() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: obterFusoHorario(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value || "";
  const ano = valor("year");
  const mes = valor("month");
  const dia = valor("day");

  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBR(dataISO) {
  if (!dataISO) return "";

  const [ano, mes, dia] = String(dataISO).split("-");

  return `${dia}/${mes}/${ano}`;
}

export function normalizarData(data) {
  if (!data) return "";
  return String(data).split("T")[0];
}

export function formatarTimestamp(data, opcoes = {}) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: obterFusoHorario(),
    dateStyle: "short",
    timeStyle: "short",
    ...opcoes,
  }).format(new Date(data));
}
