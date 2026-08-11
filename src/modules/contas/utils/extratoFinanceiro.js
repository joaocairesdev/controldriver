function valorHorario(movimento) {
  const horario = movimento?.horario || movimento?.hora || movimento?.hora_movimentacao;
  if (!horario) return "";
  return String(horario).slice(0, 8);
}

function valorId(movimento) {
  const id = Number(movimento?.idOrdenacao ?? movimento?.id_original ?? movimento?.id);
  return Number.isFinite(id) ? id : 0;
}

export function compararMovimentosFinanceiros(a, b) {
  const porData = String(b?.data || "").localeCompare(String(a?.data || ""));
  if (porData !== 0) return porData;

  const porHorario = valorHorario(b).localeCompare(valorHorario(a));
  if (porHorario !== 0) return porHorario;

  return valorId(b) - valorId(a);
}
