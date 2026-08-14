import { supabase } from "../../../services/supabase.js";

export function criarMetricasVazias() {
  return {
    faturamento: 0,
    km: 0,
    corridas: 0,
    minutosTrabalhados: 0,
    diasTrabalhados: 0,
    maiorFaturamento: 0,
    plataformas: {},
    custos: criarCustosVazios(),
    rateioUsoVeiculo: {
      kmTotal: 0,
      kmTrabalho: 0,
      kmPessoal: 0,
      percentualTrabalho: 100,
      percentualPessoal: 0,
      calculado: false,
    },
    meta: 0,
    percentualMeta: 0,
    faltaMeta: 0,
    historicoFaturamento: [],
  };
}

export function resumirOperacaoPorDia(entradas = []) {
  const resumoPorData = new Map();

  entradas.forEach((entrada) => {
    if (!entrada?.data) return;

    const plataformas = entrada.entrada_plataformas || [];
    const faturamento = plataformas.reduce(
      (total, item) => total + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
      0,
    );
    const corridas = plataformas.reduce(
      (total, item) => total + Number(item.numero_corridas || 0),
      0,
    );
    const resumoAtual = resumoPorData.get(entrada.data) || {
      data: entrada.data,
      faturamento: 0,
      corridas: 0,
      km: 0,
    };

    resumoAtual.faturamento += faturamento;
    resumoAtual.corridas += corridas;
    resumoAtual.km += Number(entrada.km_rodados || 0);
    resumoPorData.set(entrada.data, resumoAtual);
  });

  return [...resumoPorData.values()];
}

export function diaFoiTrabalhado(resumoDia) {
  return Number(resumoDia?.faturamento || 0) > 0
    && Number(resumoDia?.corridas || 0) > 0
    && Number(resumoDia?.km || 0) > 0;
}

export function calcularIndicadoresDiarios(entradas = []) {
  const resumoDiario = resumirOperacaoPorDia(entradas);

  return {
    diasTrabalhados: resumoDiario.filter(diaFoiTrabalhado).length,
    maiorFaturamento: resumoDiario.reduce(
      (maior, dia) => Math.max(maior, Number(dia.faturamento || 0)),
      0,
    ),
  };
}


export function criarCustosVazios() {
  return {
    trabalho: { total: 0, categorias: [] },
    pessoal: { total: 0, categorias: [] },
  };
}


export function calcularRateioUsoVeiculo(kmTotalVeiculoPeriodo, kmTrabalhoPeriodo) {
  const kmTotal = Math.max(Number(kmTotalVeiculoPeriodo || 0), 0);
  const kmTrabalho = Math.max(Number(kmTrabalhoPeriodo || 0), 0);

  if (kmTotal <= 0) {
    return {
      kmTotal: 0,
      kmTrabalho,
      kmPessoal: 0,
      percentualTrabalho: 100,
      percentualPessoal: 0,
      calculado: false,
    };
  }

  const kmTrabalhoSeguro = Math.min(kmTrabalho, kmTotal);
  const kmPessoal = Math.max(kmTotal - kmTrabalhoSeguro, 0);
  const percentualTrabalho = (kmTrabalhoSeguro / kmTotal) * 100;
  const percentualPessoal = 100 - percentualTrabalho;

  return {
    kmTotal,
    kmTrabalho: kmTrabalhoSeguro,
    kmPessoal,
    percentualTrabalho,
    percentualPessoal,
    calculado: true,
  };
}

export function calcularCustosPorFinalidade(saidas, categorias, faturamentoPeriodo = 0, rateioUsoVeiculo = null, saidasTag = []) {
  const resumo = criarCustosVazios();
  const categoriasPorId = new Map((categorias || []).map((categoria) => [String(categoria.id), categoria]));
  const categoriasPorNome = new Map((categorias || []).map((categoria) => [normalizarTexto(categoria.nome), categoria]));
  const saidasTagPorId = new Map((saidasTag || []).map((item) => [String(item.saida_id), item]));
  const rateio = rateioUsoVeiculo || {
    percentualTrabalho: 100,
    percentualPessoal: 0,
  };

  (saidas || [])
    .filter((saida) => custoRealParaDashboard(saida))
    .forEach((saida) => {
      const categoria = obterCategoriaDaSaida(saida, categoriasPorId, categoriasPorNome);
      const nomeCategoria = categoria?.nome || saida.categoria || "Outros";
      const tipoUso = normalizarTipoUsoCategoria(categoria?.tipo_uso || saida.finalidade);
      const valor = Number(saida.valor_total || 0);

      if (valor <= 0) return;

      if (tipoUso === "rateada") {
        const valorTrabalho = valor * (Number(rateio.percentualTrabalho || 0) / 100);
        const valorPessoal = valor * (Number(rateio.percentualPessoal || 0) / 100);

        adicionarCustoCategoria(resumo, "trabalho", nomeCategoria, valorTrabalho, categoria, true);
        adicionarCustoCategoria(resumo, "pessoal", nomeCategoria, valorPessoal, categoria, true);
        return;
      }

      if (tipoUso === "proporcional") {
        const percentualUsoTag = calcularRateioUsoTag(saidas, saidasTagPorId);
        const valorTrabalho = valor * (percentualUsoTag.percentualTrabalho / 100);
        const valorPessoal = valor * (percentualUsoTag.percentualPessoal / 100);

        adicionarCustoCategoria(resumo, "trabalho", nomeCategoria, valorTrabalho, categoria, true);
        adicionarCustoCategoria(resumo, "pessoal", nomeCategoria, valorPessoal, categoria, true);
        return;
      }

      if (tipoUso === "pessoal") {
        adicionarCustoCategoria(resumo, "pessoal", nomeCategoria, valor, categoria, false);
        return;
      }

      if (tipoUso === "trabalho") {
        adicionarCustoCategoria(resumo, "trabalho", nomeCategoria, valor, categoria, false);
        return;
      }

      const finalidadeLancamento = String(saida.finalidade || "trabalho").toLowerCase() === "pessoal" ? "pessoal" : "trabalho";
      adicionarCustoCategoria(resumo, finalidadeLancamento, nomeCategoria, valor, categoria, false);
    });

  ["trabalho", "pessoal"].forEach((finalidade) => {
    const total = resumo[finalidade].total;
    resumo[finalidade].categorias = resumo[finalidade].categorias
      .map((item) => ({
        ...item,
        percentualDoCusto: total > 0 ? (item.valor / total) * 100 : 0,
        percentualDoFaturamento: Number(faturamentoPeriodo || 0) > 0 ? (item.valor / Number(faturamentoPeriodo || 0)) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  });

  return resumo;
}

export function calcularRateioUsoTag(saidas, saidasTagPorId) {
  const totais = (saidas || []).reduce(
    (acc, saida) => {
      const detalhe = saidasTagPorId.get(String(saida.id));
      if (!detalhe) return acc;

      const tipoUsoTag = String(detalhe.tipo_uso || "").toLowerCase();
      const uso = String(detalhe.uso || "").toLowerCase();
      const valor = Number(saida.valor_total || 0);

      if (valor <= 0) return acc;
      if (tipoUsoTag !== "pedagio" && tipoUsoTag !== "estacionamento") return acc;

      if (uso === "pessoal") acc.pessoal += valor;
      else acc.trabalho += valor;

      return acc;
    },
    { trabalho: 0, pessoal: 0 }
  );

  const total = totais.trabalho + totais.pessoal;

  if (total <= 0) {
    return { percentualTrabalho: 100, percentualPessoal: 0 };
  }

  return {
    percentualTrabalho: (totais.trabalho / total) * 100,
    percentualPessoal: (totais.pessoal / total) * 100,
  };
}

export function adicionarCustoCategoria(resumo, finalidade, nome, valor, categoria, rateado) {
  if (!valor || valor <= 0) return;

  resumo[finalidade].total += valor;
  const existente = resumo[finalidade].categorias.find((item) => item.nome === nome);
  const cor = corCategoria(nome, categoria?.cor);

  if (existente) {
    existente.valor += valor;
    existente.rateado = existente.rateado || rateado;
    return;
  }

  resumo[finalidade].categorias.push({
    nome,
    valor,
    cor,
    rateado,
  });
}

export function obterCategoriaDaSaida(saida, categoriasPorId, categoriasPorNome) {
  if (saida.categoria_id && categoriasPorId.has(String(saida.categoria_id))) {
    return categoriasPorId.get(String(saida.categoria_id));
  }

  const porNome = categoriasPorNome.get(normalizarTexto(saida.categoria));
  if (porNome) return porNome;

  const nomeNormalizado = normalizarTexto(saida.categoria);
  const categoriasFixas = {
    abastecimento: { nome: "Abastecimento", tipo_uso: "rateada" },
    manutencao: { nome: "Manutenção", tipo_uso: "rateada" },
    seguro: { nome: "Seguro", tipo_uso: "rateada" },
    "financiamentodeveiculo": { nome: "Financiamento de veículo", tipo_uso: "rateada" },
    "alugueldeveiculo": { nome: "Aluguel de veículo", tipo_uso: "rateada" },
    "caucaonaodevolvivel": { nome: "Caução não devolvível", tipo_uso: "rateada" },
    "mensalidadedatag": { nome: "Mensalidade da TAG", tipo_uso: "proporcional" },
    "pedagiotrabalho": { nome: "Pedágio (Trabalho)", tipo_uso: "trabalho" },
    "pedagiodeusoatrabalho": { nome: "Pedágio (Trabalho)", tipo_uso: "trabalho" },
    "pedagiopessoal": { nome: "Pedágio (Pessoal)", tipo_uso: "pessoal" },
    "pedagiodeusopessoal": { nome: "Pedágio (Pessoal)", tipo_uso: "pessoal" },
    "estacionamentotrabalho": { nome: "Estacionamento (Trabalho)", tipo_uso: "trabalho" },
    "estacionamentodeusoatrabalho": { nome: "Estacionamento (Trabalho)", tipo_uso: "trabalho" },
    "estacionamentopessoal": { nome: "Estacionamento (Pessoal)", tipo_uso: "pessoal" },
    "estacionamentodeusopessoal": { nome: "Estacionamento (Pessoal)", tipo_uso: "pessoal" },
  };

  return categoriasFixas[nomeNormalizado] || null;
}

export function normalizarTipoUsoCategoria(tipoUso) {
  const valor = String(tipoUso || "opcional").toLowerCase();

  if (["trabalho", "uso_trabalho", "uso a trabalho"].includes(valor)) return "trabalho";
  if (["pessoal", "uso_pessoal", "uso pessoal"].includes(valor)) return "pessoal";
  if (["rateada", "rateado", "calculada", "calculado", "calculada_pelo_uso", "uso_veiculo"].includes(valor)) return "rateada";
  if (["proporcional", "uso_proporcional", "proporcao_tag"].includes(valor)) return "proporcional";

  return "opcional";
}

export function custoRealParaDashboard(saida) {
  const categoria = normalizarTexto(saida?.categoria);
  const tipoMovimentacao = String(saida?.tipo_movimentacao || "").toLowerCase();

  if (!saida || Number(saida.valor_total || 0) <= 0) return false;
  if (tipoMovimentacao === "conta_pagar") return false;
  if (tipoMovimentacao === "transferencia") return false;
  if (saida.fatura_pagamento_id) return false;

  const categoriasIgnoradas = new Set([
    "saldoinicialdocartao",
    "parcelamentoimportado",
    "pagamentodefatura",
    "recargatag",
    "recargadetag",
    "transferencia",
    "caucaodevolvivel",
  ]);

  return !categoriasIgnoradas.has(categoria);
}

export function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function corCategoria(nome, corSalva = null) {
  if (corSalva) return corSalva;

  const chave = normalizarTexto(nome);
  const cores = {
    abastecimento: "#ef4444",
    combustivel: "#ef4444",
    manutencao: "#f59e0b",
    seguro: "#8b5cf6",
    mensalidadedatag: "#3b82f6",
    tag: "#3b82f6",
    pedagio: "#06b6d4",
    pedagiodeusoatrabalho: "#06b6d4",
    pedagiodeusopessoal: "#06b6d4",
    estacionamentodeusoatrabalho: "#22c55e",
    estacionamentodeusopessoal: "#22c55e",
    alimentacao: "#f97316",
    mercado: "#ec4899",
    divida: "#64748b",
    outros: "#94a3b8",
  };

  const corExistente = cores[chave] || cores[Object.keys(cores).find((item) => chave.includes(item))];
  if (corExistente) return corExistente;

  const paleta = [
    "#ef4444",
    "#f59e0b",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f97316",
    "#14b8a6",
    "#a855f7",
    "#84cc16",
  ];

  const indice = [...chave].reduce((total, letra) => total + letra.charCodeAt(0), 0) % paleta.length;
  return paleta[indice];
}

export function getSemanaDoAno(data) {
  const inicioAno = new Date(data.getFullYear(), 0, 1);
  const dias = Math.floor((data - inicioAno) / 86400000);
  return Math.ceil((dias + inicioAno.getDay() + 1) / 7);
}

export function pegarSemanaPorNumero(ano, numeroSemana) {
  const primeiroDiaAno = new Date(ano, 0, 1);
  const diasAteSemana = (numeroSemana - 1) * 7;
  const dataBase = new Date(primeiroDiaAno);
  dataBase.setDate(primeiroDiaAno.getDate() + diasAteSemana);

  const diaSemana = dataBase.getDay();
  const diferencaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = new Date(dataBase);
  segunda.setDate(dataBase.getDate() + diferencaSegunda);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  return { inicio: dataISO(segunda), fim: dataISO(domingo) };
}

export function dataISO(date) {
  return date.toISOString().split("T")[0];
}


export async function calcularMetaPeriodo(meta, periodo, filtros) {
  if (!meta) return 0;

  const hojeTexto = dataISO(new Date());

  if (periodo === "dia") {
    const dataRef = filtros?.dataSelecionada || hojeTexto;
    return calcularMetaNecessariaNoDia(meta, dataRef);
  }

  const { inicio, fim } = intervaloPorFiltros(periodo, filtros);
  return calcularMetaPlanejadaPeriodo(meta, inicio, fim);
}

export function intervaloPorFiltros(periodo, filtros) {
  const hoje = new Date();
  const ano = Number(filtros?.anoSelecionado || hoje.getFullYear());

  if (periodo === "dia") {
    return { inicio: filtros.dataSelecionada, fim: filtros.dataSelecionada };
  }

  if (periodo === "semana") {
    return pegarSemanaPorNumero(ano, Number(filtros?.semanaSelecionada || getSemanaDoAno(hoje)));
  }

  if (periodo === "mes") {
    const mes = Number(filtros?.mesSelecionado || hoje.getMonth() + 1);
    return {
      inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
      fim: dataISO(new Date(ano, mes, 0)),
    };
  }

  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

export async function calcularMetaNecessariaHoje(meta, hojeTexto) {
  return calcularMetaNecessariaNoDia(meta, hojeTexto);
}

export async function calcularMetaNecessariaNoDia(meta, dataRef) {
  if (!meta) return 0;

  const valor = Number(meta.valor_base || 0);
  if (valor <= 0) return 0;

  if (meta.tipo === "diaria") return valor;

  const periodo = periodoBaseMeta(meta, dataRef);
  if (!periodo) return 0;

  const inicioCalculo = maiorData(periodo.inicio, meta.data_inicio || periodo.inicio);
  const diaAnterior = adicionarDiasISO(dataRef, -1);
  const realizadoAntesDia = inicioCalculo <= diaAnterior ? await buscarTotalEntradasDashboard(inicioCalculo, diaAnterior) : 0;
  const realizadoManual = deveConsiderarRealizadoManual(meta, periodo) ? Number(meta.valor_realizado_antes || 0) : 0;
  const restante = Math.max(Number(meta.valor_base || 0) - realizadoAntesDia - realizadoManual, 0);
  const diasRestantes = diasTrabalhoNoPeriodo(meta, dataRef, periodo.fim);

  return diasRestantes.length > 0 ? restante / diasRestantes.length : restante;
}

export function calcularMetaPlanejadaPeriodo(meta, inicio, fim) {
  if (!meta || !inicio || !fim || inicio > fim) return 0;

  const valor = Number(meta.valor_base || 0);
  if (valor <= 0) return 0;

  if (meta.tipo === "diaria") {
    return valor * contarDiasCalendario(inicio, fim);
  }

  if (meta.tipo === "semanal") {
    return somarMetaSemanalNoIntervalo(meta, inicio, fim);
  }

  if (meta.tipo === "mensal") {
    return somarMetaMensalNoIntervalo(meta, inicio, fim);
  }

  if (meta.tipo === "anual") {
    return somarMetaAnualNoIntervalo(meta, inicio, fim);
  }

  return 0;
}

export function periodoBaseMeta(meta, dataRef) {
  const data = new Date(`${dataRef}T00:00:00`);

  if (meta.tipo === "semanal") {
    const inicio = inicioSemanaISOGlobal(dataRef);
    return { inicio, fim: adicionarDiasISO(inicio, 6) };
  }

  if (meta.tipo === "mensal") {
    const ano = data.getFullYear();
    const mes = data.getMonth() + 1;
    return {
      inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
      fim: dataISO(new Date(ano, mes, 0)),
    };
  }

  if (meta.tipo === "anual") {
    const ano = data.getFullYear();
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  }

  return { inicio: dataRef, fim: dataRef };
}

export function deveConsiderarRealizadoManual(meta, periodo) {
  if (!meta?.data_inicio || !periodo?.inicio || !periodo?.fim) return false;
  return meta.data_inicio >= periodo.inicio && meta.data_inicio <= periodo.fim;
}

export function metaValorPeriodoBase(meta, inicio, fim) {
  if (meta.tipo === "semanal") return Number(meta.valor_base || 0);
  if (meta.tipo === "mensal") return Number(meta.valor_base || 0);
  if (meta.tipo === "anual") return Number(meta.valor_base || 0);
  return calcularMetaPlanejadaPeriodo(meta, inicio, fim);
}

export function somarMetaSemanalNoIntervalo(meta, inicio, fim) {
  const semanas = semanasEntre(inicio, fim);
  return semanas.reduce((total, semana) => {
    const diasSemanaCheia = diasTrabalhoNoPeriodo(meta, semana.inicio, semana.fim).length || 1;
    const inicioCorte = maiorData(inicio, semana.inicio);
    const fimCorte = menorData(fim, semana.fim);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasSemanaCheia);
  }, 0);
}

export function somarMetaMensalNoIntervalo(meta, inicio, fim) {
  const meses = mesesEntre(inicio, fim);
  return meses.reduce((total, mesRef) => {
    const inicioMes = `${mesRef.ano}-${String(mesRef.mes).padStart(2, "0")}-01`;
    const fimMes = dataISO(new Date(mesRef.ano, mesRef.mes, 0));
    const diasMesCheio = diasTrabalhoNoPeriodo(meta, inicioMes, fimMes).length || 1;
    const inicioCorte = maiorData(inicio, inicioMes);
    const fimCorte = menorData(fim, fimMes);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasMesCheio);
  }, 0);
}

export function somarMetaAnualNoIntervalo(meta, inicio, fim) {
  const anos = anosEntre(inicio, fim);
  return anos.reduce((total, ano) => {
    const inicioAno = `${ano}-01-01`;
    const fimAno = `${ano}-12-31`;
    const diasAnoCheio = diasTrabalhoNoPeriodo(meta, inicioAno, fimAno).length || 1;
    const inicioCorte = maiorData(inicio, inicioAno);
    const fimCorte = menorData(fim, fimAno);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasAnoCheio);
  }, 0);
}

export function diasTrabalhoNoPeriodo(meta, inicio, fim) {
  if (!inicio || !fim || inicio > fim) return [];

  const dias = [];
  const data = new Date(`${inicio}T00:00:00`);
  const fimData = new Date(`${fim}T00:00:00`);
  const diasSemana = normalizarDiasSemana(meta.dias_semana);
  const diasMes = normalizarArrayNumerico(meta.dias_mes || meta.dias_trabalho);

  while (data <= fimData) {
    const iso = dataISO(data);
    const diaSemana = data.getDay();
    const diaMes = data.getDate();

    let trabalha = true;

    if (meta.tipo === "semanal") {
      trabalha = diasSemana.length ? diasSemana.includes(diaSemana) : diaSemana >= 1 && diaSemana <= 6;
    }

    if (meta.tipo === "anual") {
      trabalha = true;
    }

    if (meta.tipo === "mensal") {
      trabalha = diasMes.length ? diasMes.includes(diaMes) : diaSemana >= 1 && diaSemana <= 6;
    }

    if (meta.tipo === "diaria") trabalha = true;

    if (trabalha) dias.push(iso);
    data.setDate(data.getDate() + 1);
  }

  return dias;
}

export async function buscarTotalEntradasDashboard(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return 0;

  const { data, error } = await supabase
    .from("entradas")
    .select(`
      id,
      data,
      entrada_plataformas (
        faturamento,
        valor_reembolso
      )
    `)
    .gte("data", inicio)
    .lte("data", fim);

  if (error) {
    console.error("Erro ao calcular realizado da meta:", error);
    return 0;
  }

  return (data || []).reduce((total, entrada) => {
    const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
      (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
      0
    );
    return total + totalPlataformas;
  }, 0);
}

export function normalizarArrayNumerico(valor) {
  if (Array.isArray(valor)) return valor.map(Number).filter((item) => !Number.isNaN(item));
  if (typeof valor === "string") {
    try {
      const convertido = JSON.parse(valor);
      return Array.isArray(convertido) ? convertido.map(Number).filter((item) => !Number.isNaN(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizarDiasSemana(valor) {
  const dias = normalizarArrayNumerico(valor);
  return dias.filter((dia) => dia >= 0 && dia <= 6);
}

export function contarDiasCalendario(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return 0;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  return Math.max(Math.floor((b - a) / 86400000) + 1, 0);
}

export function adicionarDiasISO(dataISOTexto, quantidade) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  data.setDate(data.getDate() + quantidade);
  return dataISO(data);
}

export function maiorData(a, b) {
  return String(a) > String(b) ? a : b;
}

export function menorData(a, b) {
  return String(a) < String(b) ? a : b;
}

export function inicioSemanaISOGlobal(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const diaSemana = data.getDay();
  const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + diferenca);
  return dataISO(data);
}

export function semanasEntre(inicio, fim) {
  const semanas = [];
  let inicioSemana = inicioSemanaISOGlobal(inicio);

  while (inicioSemana <= fim) {
    semanas.push({ inicio: inicioSemana, fim: adicionarDiasISO(inicioSemana, 6) });
    inicioSemana = adicionarDiasISO(inicioSemana, 7);
  }

  return semanas;
}

export function mesesEntre(inicio, fim) {
  const meses = [];
  const data = new Date(`${inicio.slice(0, 7)}-01T00:00:00`);
  const fimMes = new Date(`${fim.slice(0, 7)}-01T00:00:00`);

  while (data <= fimMes) {
    meses.push({ ano: data.getFullYear(), mes: data.getMonth() + 1 });
    data.setMonth(data.getMonth() + 1);
  }

  return meses;
}

export function anosEntre(inicio, fim) {
  const anoInicio = Number(inicio.slice(0, 4));
  const anoFim = Number(fim.slice(0, 4));
  const anos = [];
  for (let ano = anoInicio; ano <= anoFim; ano++) anos.push(ano);
  return anos;
}


export function listarDatasPeriodo(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return [];
  const datas = [];
  const data = new Date(`${inicio}T00:00:00`);
  const fimData = new Date(`${fim}T00:00:00`);

  while (data <= fimData) {
    datas.push(dataISO(data));
    data.setDate(data.getDate() + 1);
  }

  return datas;
}

export function nomeDiaSemanaCurto(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][data.getDay()];
}


export function construirHistoricoFaturamento(entradas, periodo, selecao) {
  if (periodo === "dia") return [];

  const totaisPorData = new Map();
  (entradas || []).forEach((entrada) => {
    if (!entrada?.data) return;
    const total = (entrada.entrada_plataformas || []).reduce(
      (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
      0
    );
    totaisPorData.set(entrada.data, (totaisPorData.get(entrada.data) || 0) + total);
  });

  if (periodo === "semana") {
    const intervalo = pegarSemanaPorNumero(Number(selecao.anoSelecionado), Number(selecao.semanaSelecionada));
    const inicio = new Date(`${intervalo.inicio}T12:00:00`);
    return Array.from({ length: 7 }, (_, indice) => {
      const data = new Date(inicio);
      data.setDate(inicio.getDate() + indice);
      const iso = data.toISOString().split("T")[0];
      return { label: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][data.getDay()], valor: totaisPorData.get(iso) || 0 };
    });
  }

  if (periodo === "mes") {
    const ano = Number(selecao.anoSelecionado);
    const mes = Number(selecao.mesSelecionado);
    const totalDias = new Date(ano, mes, 0).getDate();
    return Array.from({ length: totalDias }, (_, indice) => {
      const dia = indice + 1;
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      return { label: String(dia), valor: totaisPorData.get(iso) || 0 };
    });
  }

  const ano = Number(selecao.anoSelecionado);
  const mesesCurtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return mesesCurtos.map((label, indice) => {
    const prefixo = `${ano}-${String(indice + 1).padStart(2, "0")}-`;
    const valor = [...totaisPorData.entries()]
      .filter(([data]) => data.startsWith(prefixo))
      .reduce((soma, [, total]) => soma + total, 0);
    return { label, valor };
  });
}
