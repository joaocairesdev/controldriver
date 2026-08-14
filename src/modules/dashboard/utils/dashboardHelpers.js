import { intervaloPorFiltros, normalizarTexto } from "./dashboardCalculos.js";

const DASHBOARD_PREFERENCIAS_KEY = "controldriver_dashboard_preferencias_v1";

export function carregarPreferenciasDashboardLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_PREFERENCIAS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function salvarPreferenciasDashboardLocalStorage(preferencias) {
  try {
    localStorage.setItem(DASHBOARD_PREFERENCIAS_KEY, JSON.stringify(preferencias));
  } catch {
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

export function criarContextoDashboard({
  periodo,
  dataSelecionada,
  semanaSelecionada,
  mesSelecionado,
  anoSelecionado,
  selecaoGrafico,
  meses,
}) {
  const filtrosBase = {
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
  };
  const intervaloBase = intervaloPorFiltros(periodo, filtrosBase);
  const periodoAtual = selecaoGrafico?.periodoMeta || periodo;
  const filtrosMeta = selecaoGrafico?.filtrosMeta || filtrosBase;
  const intervalo = selecaoGrafico
    ? { inicio: selecaoGrafico.inicio, fim: selecaoGrafico.fim }
    : intervaloBase;
  const complementos = {
    dia: "do Dia",
    semana: "da Semana",
    mes: "do Mês",
    ano: "do Ano",
  };

  return {
    periodoBase: periodo,
    periodo: periodoAtual,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    intervaloBase,
    filtrosBase,
    filtrosMeta,
    temSelecao: Boolean(selecaoGrafico),
    complementoTitulo: complementos[periodoAtual] || "do Período",
    texto: selecaoGrafico?.rotulo || textoContextoBase({
      periodo,
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
      meses,
      intervaloBase,
    }),
  };
}

function textoContextoBase({
  periodo,
  dataSelecionada,
  semanaSelecionada,
  mesSelecionado,
  anoSelecionado,
  meses,
  intervaloBase,
}) {
  if (periodo === "dia") return formatarDataCompleta(dataSelecionada);
  if (periodo === "semana") {
    return `${semanaSelecionada}ª Semana\n${formatarDataCurta(intervaloBase.inicio)} até ${formatarDataCurta(intervaloBase.fim)}`;
  }
  if (periodo === "mes") return `${meses[Number(mesSelecionado) - 1]}/${anoSelecionado}`;
  return String(anoSelecionado);
}

function formatarDataCompleta(data) {
  const [ano, mes, dia] = String(data || "").split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "-";
}

function formatarDataCurta(data) {
  const [, mes, dia] = String(data || "").split("-");
  return mes && dia ? `${dia}/${mes}` : "-";
}
