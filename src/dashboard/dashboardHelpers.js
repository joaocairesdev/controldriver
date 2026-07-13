import { normalizarTexto } from "./dashboardCalculos";

const DASHBOARD_PREFERENCIAS_KEY = "controldriver_dashboard_preferencias_v1";

export function carregarPreferenciasDashboardLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_PREFERENCIAS_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

export function salvarPreferenciasDashboardLocalStorage(preferencias) {
  try {
    localStorage.setItem(DASHBOARD_PREFERENCIAS_KEY, JSON.stringify(preferencias));
  } catch (_) {
    // Ignora erro de armazenamento local.
  }
}

export function criarMetricasPessoaisVazias() {
  return {
    entradas: 0,
    custos: { total: 0, categorias: [] },
    resultado: 0,
    periodo: null,
    rateioUsoVeiculo: null,
  };
}

export function diasDoMesCalendarioGenerico(anoSelecionado, mesSelecionado) {
  const ano = Number(anoSelecionado);
  const mes = Number(mesSelecionado);
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  const totalDias = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay();
  const dias = [];

  for (let i = 0; i < diaSemanaInicio; i++) dias.push(null);
  for (let dia = 1; dia <= totalDias; dia++) dias.push(dia);
  while (dias.length < 42) dias.push(null);

  return dias;
}

export function entradaAvulsaPessoal(entrada) {
  const descricao = normalizarTexto(entrada?.descricao);
  if (descricao.includes("recargatag") || descricao.includes("recargadetag")) return false;
  return true;
}

