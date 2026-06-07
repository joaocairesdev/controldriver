export function hojeBrasil() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBR(dataISO) {
  if (!dataISO) return "";

  const [ano, mes, dia] = String(dataISO).split("-");

  return `${dia}/${mes}/${ano}`;
}

export function normalizarData(data) {
  if (!data) return "";

  return new Date(`${data}T12:00:00`)
    .toISOString()
    .split("T")[0];
}