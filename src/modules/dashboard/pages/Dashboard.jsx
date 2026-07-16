import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiDollarSign, FiEye, FiEyeOff, FiTruck, FiUser } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import {
  calcularSaldoAbertoFatura,
  detalheCartao,
} from "../../cartoes/utils/cartoesUtils";

import {
  DashboardHome, DashboardPainelHeader, PeriodoControle, ResumoFinanceiroCard,
  ResultadoOperacionalCard, CustosCategoriaCard, InvestimentosObjetivosCard,
  ContasAtrasadasCard, SaldoGeralCard, FaturamentoCard, MetaCard, MetricCard,
  ProximasContasCard, PlataformasCard, GraficoHistoricoFaturamento, DashboardAnimations,
} from "../components/DashboardComponentes";
import {
  ModalRateioDashboard, ModalContasAtrasadasDashboard, ModalContasPagarDashboard,
  ModalContasDashboard, ModalPeriodo, ModalAno, ModalMesAno,
} from "../components/DashboardModais";
import {
  criarMetricasVazias, calcularRateioUsoVeiculo, calcularCustosPorFinalidade,
  construirHistoricoFaturamento, calcularMetaPeriodo, getSemanaDoAno, pegarSemanaPorNumero,
} from "../utils/dashboardCalculos";
import {
  carregarPreferenciasDashboardLocalStorage, salvarPreferenciasDashboardLocalStorage,
  criarMetricasPessoaisVazias, diasDoMesCalendarioGenerico, entradaAvulsaPessoal,
} from "../utils/dashboardHelpers";


const CONTAS_DASHBOARD_KEY = "controldriver_dashboard_contas_ativas_v1";
const CONTAS_PAGAR_DIAS_KEY = "controldriver_dashboard_contas_pagar_dias_v1";
const CONTAS_ATRASADAS_CONFIG_KEY = "controldriver_dashboard_contas_atrasadas_config_v1";
const DASHBOARD_PREFERENCIAS_KEY = "controldriver_dashboard_preferencias_v1";

export default function Dashboard({ entradaKey = 0 }) {
  const hoje = new Date();
  const hojeISO = dataISO(hoje);
  const preferenciasDashboard = useMemo(() => carregarPreferenciasDashboardLocalStorage(), []);

  const [periodo, setPeriodo] = useState(preferenciasDashboard.periodo || "dia");
  const [dataSelecionada, setDataSelecionada] = useState(preferenciasDashboard.dataSelecionada || hojeISO);
  const [semanaSelecionada, setSemanaSelecionada] = useState(preferenciasDashboard.semanaSelecionada || getSemanaDoAno(hoje));
  const [mesSelecionado, setMesSelecionado] = useState(preferenciasDashboard.mesSelecionado || String(hoje.getMonth() + 1));
  const [anoSelecionado, setAnoSelecionado] = useState(preferenciasDashboard.anoSelecionado || hoje.getFullYear());

  const [periodoPessoal, setPeriodoPessoal] = useState(preferenciasDashboard.periodoPessoal || "mes");
  const [dataPessoalSelecionada, setDataPessoalSelecionada] = useState(preferenciasDashboard.dataPessoalSelecionada || hojeISO);
  const [semanaPessoalSelecionada, setSemanaPessoalSelecionada] = useState(preferenciasDashboard.semanaPessoalSelecionada || getSemanaDoAno(hoje));
  const [mesPessoalSelecionado, setMesPessoalSelecionado] = useState(preferenciasDashboard.mesPessoalSelecionado || String(hoje.getMonth() + 1));
  const [anoPessoalSelecionado, setAnoPessoalSelecionado] = useState(preferenciasDashboard.anoPessoalSelecionado || hoje.getFullYear());

  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalPeriodoPessoalAberto, setModalPeriodoPessoalAberto] = useState(false);
  const [modalContasAberto, setModalContasAberto] = useState(false);
  const [modalContasPagarAberto, setModalContasPagarAberto] = useState(false);
  const [modalAnoAberto, setModalAnoAberto] = useState(false);
  const [modalMesAnoAberto, setModalMesAnoAberto] = useState(false);
  const [etapaMesAno, setEtapaMesAno] = useState("ano");

  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState([]);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [datasComMovimento, setDatasComMovimento] = useState([]);
  const [metaAtiva, setMetaAtiva] = useState(null);
  const [metricas, setMetricas] = useState(criarMetricasVazias());
  const [metricasPessoais, setMetricasPessoais] = useState(criarMetricasPessoaisVazias());
  const [proximasContas, setProximasContas] = useState([]);
  const [contasAtrasadas, setContasAtrasadas] = useState([]);
  const [diasContasPagar, setDiasContasPagar] = useState(carregarDiasContasPagarLocalStorage());
  const [configContasAtrasadas, setConfigContasAtrasadas] = useState(carregarConfigContasAtrasadasLocalStorage());
  const [modalContasAtrasadasAberto, setModalContasAtrasadasAberto] = useState(false);
  const [modalRateioAberto, setModalRateioAberto] = useState(false);

  const [valoresFinanceirosVisiveis, setValoresFinanceirosVisiveis] = useState(preferenciasDashboard.valoresFinanceirosVisiveis !== false);
  const [abaDashboard, setAbaDashboard] = useState(null);

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    carregarTudo();
  }, []);

  useEffect(() => {
    setAbaDashboard(null);
    setModalRateioAberto(false);
    setModalPeriodoAberto(false);
    setModalPeriodoPessoalAberto(false);
  }, [entradaKey]);

  useEffect(() => {
    const containerRolagem = document.querySelector('[data-scroll-container="true"]');
    if (!containerRolagem) return;

    containerRolagem.scrollTo({ top: 0, behavior: "auto" });
  }, [abaDashboard]);

  useEffect(() => {
    carregarPerformance();
  }, [periodo, dataSelecionada, semanaSelecionada, mesSelecionado, anoSelecionado, metaAtiva]);

  useEffect(() => {
    carregarFinancasPessoais();
  }, [periodoPessoal, dataPessoalSelecionada, semanaPessoalSelecionada, mesPessoalSelecionado, anoPessoalSelecionado]);

  useEffect(() => {
    if (!carregando) {
      carregarProximasContas();
      carregarContasAtrasadas();
    }
  }, [diasContasPagar]);

  useEffect(() => {
    salvarPreferenciasDashboardLocalStorage({
      periodo,
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
      periodoPessoal,
      dataPessoalSelecionada,
      semanaPessoalSelecionada,
      mesPessoalSelecionado,
      anoPessoalSelecionado,
      valoresFinanceirosVisiveis,
      abaDashboard,
    });
  }, [
    periodo,
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
    periodoPessoal,
    dataPessoalSelecionada,
    semanaPessoalSelecionada,
    mesPessoalSelecionado,
    anoPessoalSelecionado,
    valoresFinanceirosVisiveis,
    abaDashboard,
  ]);

  async function carregarTudo() {
    setCarregando(true);
    await Promise.all([
      carregarContasComSaldo(),
      carregarDatasComMovimento(),
      carregarMetaAtiva(),
      carregarProximasContas(),
      carregarContasAtrasadas(),
    ]);
    setCarregando(false);
  }

  async function carregarContasComSaldo() {
    const { data: contasData, error: erroContas } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (erroContas) {
      console.error("Erro ao carregar contas:", erroContas);
      setContas([]);
      return;
    }

    const [entradasRes, entradasAvulsasRes, saidasRes, transferenciasRes] = await Promise.all([
      supabase.from("entradas").select(`
        id,
        conta_id,
        entrada_plataformas (
          faturamento,
          valor_reembolso
        )
      `),
      supabase.from("entradas_avulsas").select("id, conta_id, valor"),
      supabase.from("saidas").select("id, conta_id, valor_total, tipo_movimentacao, status"),
      supabase.from("transferencias").select("id, conta_origem_id, conta_destino_id, valor"),
    ]);

    const entradasData = entradasRes.data || [];
    const entradasAvulsasData = entradasAvulsasRes.data || [];
    const saidasData = saidasRes.data || [];
    const transferenciasData = transferenciasRes.data || [];

    const contasComSaldo = (contasData || []).map((conta) => {
      const entradasDaConta = entradasData.filter((entrada) => entrada.conta_id === conta.id);
      const totalEntradas = entradasDaConta.reduce((total, entrada) => {
        const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
          (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
          0
        );
        return total + totalPlataformas;
      }, 0);

      const totalEntradasAvulsas = entradasAvulsasData
        .filter((entrada) => entrada.conta_id === conta.id)
        .reduce((total, entrada) => total + Number(entrada.valor || 0), 0);

      const totalSaidas = saidasData
        .filter((saida) => saida.conta_id === conta.id && saida.tipo_movimentacao !== "conta_pagar")
        .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

      const totalTransferenciasEntrada = transferenciasData
        .filter((item) => item.conta_destino_id === conta.id)
        .reduce((total, item) => total + Number(item.valor || 0), 0);

      const totalTransferenciasSaida = transferenciasData
        .filter((item) => item.conta_origem_id === conta.id)
        .reduce((total, item) => total + Number(item.valor || 0), 0);

      return {
        ...conta,
        saldo_atual:
          Number(conta.saldo_inicial || 0) +
          totalEntradas +
          totalEntradasAvulsas -
          totalSaidas +
          totalTransferenciasEntrada -
          totalTransferenciasSaida,
      };
    });

    setContas(contasComSaldo);

    const idsSalvos = carregarContasSelecionadasLocalStorage();
    if (idsSalvos.length > 0) {
      const idsExistentes = contasComSaldo.map((conta) => String(conta.id));
      setContasSelecionadas(idsSalvos.filter((id) => idsExistentes.includes(String(id))));
      return;
    }

    const todas = contasComSaldo.map((conta) => String(conta.id));
    setContasSelecionadas(todas);
    salvarContasSelecionadasLocalStorage(todas);
  }

  async function carregarDatasComMovimento() {
    const { data: entradasData } = await supabase.from("entradas").select("data");
    const { data: entradasAvulsasData } = await supabase.from("entradas_avulsas").select("data");
    const { data: saidasData } = await supabase.from("saidas").select("data_compra");

    const datas = [
      ...(entradasData || []).map((item) => item.data),
      ...(entradasAvulsasData || []).map((item) => item.data),
      ...(saidasData || []).map((item) => item.data_compra),
    ].filter(Boolean);

    setDatasComMovimento([...new Set(datas)]);
  }

  async function carregarMetaAtiva() {
    const { data, error } = await supabase
      .from("metas")
      .select("*")
      .eq("ativa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error("Erro ao carregar meta ativa:", error);
    setMetaAtiva(data || null);
  }

  async function carregarProximasContas() {
    const hojeTexto = dataISO(new Date());
    const limite = new Date();
    limite.setDate(limite.getDate() + Number(diasContasPagar || 7));
    const limiteTexto = dataISO(limite);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select(`
        id,
        data_vencimento,
        valor_total,
        valor_pago,
        status,
        cartoes (
          nome,
          final_cartao,
          tipo_cartao
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .gte("data_vencimento", hojeTexto)
      .lte("data_vencimento", limiteTexto)
      .order("data_vencimento", { ascending: true })
      .limit(5);

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("id, data_vencimento, data_compra, categoria, descricao, valor_total, status, tipo_movimentacao")
      .eq("tipo_movimentacao", "conta_pagar")
      .gte("data_vencimento", hojeTexto)
      .lte("data_vencimento", limiteTexto)
      .order("data_vencimento", { ascending: true })
      .limit(5);

    const faturas = (faturasData || []).map((fatura) => ({
      id: `fatura-${fatura.id}`,
      tipo: "Fatura",
      titulo: fatura.cartoes?.nome || "Cartão",
      subtitulo: detalheCartao(fatura.cartoes),
      data: fatura.data_vencimento,
      valor: calcularSaldoAbertoFatura(fatura),
    }));

    const contas = (contasPagarData || []).map((conta) => ({
      id: `conta-${conta.id}`,
      tipo: "Conta",
      titulo: conta.descricao || conta.categoria || "Conta a pagar",
      subtitulo: conta.categoria || "Boleto",
      data: conta.data_vencimento || conta.data_compra,
      valor: Number(conta.valor_total || 0),
    }));

    const lista = [...faturas, ...contas]
      .filter((item) => item.valor > 0)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .slice(0, 5);

    setProximasContas(lista);
  }

  async function carregarContasAtrasadas() {
    const hojeTexto = dataISO(new Date());

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select(`
        id,
        data_vencimento,
        valor_total,
        valor_pago,
        status,
        cartoes (
          nome,
          final_cartao,
          tipo_cartao
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .lt("data_vencimento", hojeTexto)
      .order("data_vencimento", { ascending: true })
      .limit(10);

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("id, data_vencimento, data_compra, categoria, descricao, valor_total, status, tipo_movimentacao")
      .eq("tipo_movimentacao", "conta_pagar")
      .neq("status", "pago")
      .lt("data_vencimento", hojeTexto)
      .order("data_vencimento", { ascending: true })
      .limit(10);

    const faturas = (faturasData || []).map((fatura) => ({
      id: `fatura-atrasada-${fatura.id}`,
      tipo: "Fatura",
      titulo: fatura.cartoes?.nome || "Cartão",
      subtitulo: detalheCartao(fatura.cartoes),
      data: fatura.data_vencimento,
      valor: calcularSaldoAbertoFatura(fatura),
    }));

    const contas = (contasPagarData || []).map((conta) => ({
      id: `conta-atrasada-${conta.id}`,
      tipo: "Conta",
      titulo: conta.descricao || conta.categoria || "Conta a pagar",
      subtitulo: conta.categoria || "Boleto",
      data: conta.data_vencimento || conta.data_compra,
      valor: Number(conta.valor_total || 0),
    }));

    const lista = [...faturas, ...contas]
      .filter((item) => item.valor > 0)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .slice(0, 8);

    setContasAtrasadas(lista);
  }

  async function buscarDadosOperacao(inicio, fim) {
    const [entradasRes, saidasRes, categoriasRes] = await Promise.all([
      supabase
        .from("entradas")
        .select(`
          id,
          data,
          km_rodados,
          horas_trabalhadas,
          entrada_plataformas (
            faturamento,
            numero_corridas,
            valor_reembolso,
            plataformas ( nome )
          )
        `)
        .gte("data", inicio)
        .lte("data", fim),
      supabase
        .from("saidas")
        .select("id, data_compra, categoria, categoria_id, valor_total, finalidade, tipo_movimentacao, status, forma_pagamento, fatura_pagamento_id")
        .gte("data_compra", inicio)
        .lte("data_compra", fim),
      supabase
        .from("categorias")
        .select("id, nome, tipo_uso, uso, operacional, cor"),
    ]);

    const entradasData = entradasRes.data || [];
    const saidasData = saidasRes.data || [];
    const categoriasData = categoriasRes.data || [];
    const saidaIds = saidasData.map((saida) => saida.id).filter(Boolean);

    const [{ data: abastecimentosData = [] }, { data: saidasTagData = [] }] = saidaIds.length
      ? await Promise.all([
          supabase
            .from("saidas_abastecimentos")
            .select("saida_id, km_rodados, km_total_periodo")
            .in("saida_id", saidaIds),
          supabase
            .from("saidas_tag")
            .select("saida_id, tipo_uso, uso")
            .in("saida_id", saidaIds),
        ])
      : [{ data: [] }, { data: [] }];

    const resumoBase = entradasData.reduce((acc, entrada) => {
      const plataformas = entrada.entrada_plataformas || [];

      const totalEntrada = plataformas.reduce(
        (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
        0
      );

      const totalCorridas = plataformas.reduce(
        (soma, item) => soma + Number(item.numero_corridas || 0),
        0
      );

      acc.faturamento += totalEntrada;
      acc.km += Number(entrada.km_rodados || 0);
      acc.corridas += totalCorridas;
      acc.minutosTrabalhados += intervalParaMinutos(entrada.horas_trabalhadas);
      if (entrada.data) acc.datasTrabalhadas.add(entrada.data);

      plataformas.forEach((item) => {
        const nome = item.plataformas?.nome || "Sem plataforma";
        const valor = Number(item.faturamento || 0) + Number(item.valor_reembolso || 0);
        const corridas = Number(item.numero_corridas || 0);

        if (!acc.plataformas[nome]) {
          acc.plataformas[nome] = { nome, valor: 0, corridas: 0 };
        }

        acc.plataformas[nome].valor += valor;
        acc.plataformas[nome].corridas += corridas;
      });

      return acc;
    }, criarMetricasVazias());

    resumoBase.diasTrabalhados = resumoBase.datasTrabalhadas.size;
    delete resumoBase.datasTrabalhadas;

    const kmTotalVeiculoPeriodo = (abastecimentosData || []).reduce(
      (total, item) => total + Number(item.km_rodados || 0),
      0
    );
    resumoBase.rateioUsoVeiculo = calcularRateioUsoVeiculo(kmTotalVeiculoPeriodo, resumoBase.km);
    resumoBase.custos = calcularCustosPorFinalidade(
      saidasData,
      categoriasData,
      resumoBase.faturamento,
      resumoBase.rateioUsoVeiculo,
      saidasTagData
    );

    return { resumoBase, entradasData, saidasData, categoriasData };
  }

  async function carregarPerformance() {
    const { inicio, fim } = intervaloDatas();
    const { resumoBase, entradasData } = await buscarDadosOperacao(inicio, fim);


    const metaPeriodo = await calcularMetaPeriodo(metaAtiva, periodo, {
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
    });

    resumoBase.meta = metaPeriodo;
    resumoBase.percentualMeta = metaPeriodo > 0 ? Math.min((resumoBase.faturamento / metaPeriodo) * 100, 999) : 0;
    resumoBase.faltaMeta = Math.max(metaPeriodo - resumoBase.faturamento, 0);
    resumoBase.historicoFaturamento = construirHistoricoFaturamento(entradasData, periodo, {
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
    });

    setMetricas(resumoBase);
  }

  async function carregarFinancasPessoais() {
    const { inicio, fim } = intervaloDatasPessoais();
    const { resumoBase } = await buscarDadosOperacao(inicio, fim);

    const { data: entradasAvulsasData = [] } = await supabase
      .from("entradas_avulsas")
      .select("id, data, valor, descricao, conta_id")
      .gte("data", inicio)
      .lte("data", fim);

    const entradasPessoais = (entradasAvulsasData || [])
      .filter((entrada) => entradaAvulsaPessoal(entrada))
      .reduce((total, entrada) => total + Number(entrada.valor || 0), 0);

    const custosPessoais = resumoBase.custos.pessoal || { total: 0, categorias: [] };
    const resultado = entradasPessoais - Number(custosPessoais.total || 0);

    setMetricasPessoais({
      entradas: entradasPessoais,
      custos: custosPessoais,
      resultado,
      periodo: { inicio, fim },
      rateioUsoVeiculo: resumoBase.rateioUsoVeiculo,
    });
  }

  function carregarContasSelecionadasLocalStorage() {
    try {
      return JSON.parse(localStorage.getItem(CONTAS_DASHBOARD_KEY) || "[]").map(String);
    } catch (_) {
      return [];
    }
  }

  function salvarContasSelecionadasLocalStorage(ids) {
    localStorage.setItem(CONTAS_DASHBOARD_KEY, JSON.stringify(ids.map(String)));
  }

  function carregarDiasContasPagarLocalStorage() {
    const valor = Number(localStorage.getItem(CONTAS_PAGAR_DIAS_KEY) || 7);
    return [7, 15, 30, 60].includes(valor) ? valor : 7;
  }

  function carregarConfigContasAtrasadasLocalStorage() {
    try {
      const config = JSON.parse(localStorage.getItem(CONTAS_ATRASADAS_CONFIG_KEY) || "{}");
      return {
        mostrarAtrasadas: config.mostrarAtrasadas !== false,
        mostrarNegativas: config.mostrarNegativas === true,
      };
    } catch (_) {
      return { mostrarAtrasadas: true, mostrarNegativas: false };
    }
  }

  function alterarConfigContasAtrasadas(novaConfig) {
    const config = { ...configContasAtrasadas, ...novaConfig };
    setConfigContasAtrasadas(config);
    localStorage.setItem(CONTAS_ATRASADAS_CONFIG_KEY, JSON.stringify(config));
  }

  function alterarDiasContasPagar(dias) {
    const novoValor = Number(dias || 7);
    setDiasContasPagar(novoValor);
    localStorage.setItem(CONTAS_PAGAR_DIAS_KEY, String(novoValor));
  }

  function alternarContaDashboard(contaId) {
    setContasSelecionadas((listaAtual) => {
      const id = String(contaId);
      const novaLista = listaAtual.includes(id)
        ? listaAtual.filter((item) => item !== id)
        : [...listaAtual, id];
      salvarContasSelecionadasLocalStorage(novaLista);
      return novaLista;
    });
  }

  function aplicarTodasContas() {
    const todas = contas.map((conta) => String(conta.id));
    setContasSelecionadas(todas);
    salvarContasSelecionadasLocalStorage(todas);
  }

  function dataISO(date) {
    return date.toISOString().split("T")[0];
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarNumero(valor) {
    return Number(valor || 0).toLocaleString("pt-BR");
  }

  function formatarHoras(minutos) {
    const total = Math.max(Number(minutos || 0), 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function intervaloDatas() {
    return intervaloPorSelecao(periodo, dataSelecionada, semanaSelecionada, mesSelecionado, anoSelecionado);
  }

  function intervaloDatasPessoais() {
    return intervaloPorSelecao(periodoPessoal, dataPessoalSelecionada, semanaPessoalSelecionada, mesPessoalSelecionado, anoPessoalSelecionado);
  }

  function intervaloPorSelecao(periodoAtual, dataAtual, semanaAtual, mesAtual, anoAtual) {
    if (periodoAtual === "dia") return { inicio: dataAtual, fim: dataAtual };

    if (periodoAtual === "semana") {
      return pegarSemanaPorNumero(Number(anoAtual), Number(semanaAtual));
    }

    if (periodoAtual === "mes") {
      const inicio = new Date(Number(anoAtual), Number(mesAtual) - 1, 1);
      const fim = new Date(Number(anoAtual), Number(mesAtual), 0);
      return { inicio: dataISO(inicio), fim: dataISO(fim) };
    }

    return { inicio: `${anoAtual}-01-01`, fim: `${anoAtual}-12-31` };
  }

  function textoPeriodoSelecionado() {
    return textoPeriodo(periodo, dataSelecionada, semanaSelecionada, mesSelecionado, anoSelecionado);
  }

  function textoPeriodoPessoalSelecionado() {
    return textoPeriodo(periodoPessoal, dataPessoalSelecionada, semanaPessoalSelecionada, mesPessoalSelecionado, anoPessoalSelecionado);
  }

  function textoPeriodo(periodoAtual, dataAtual, semanaAtual, mesAtual, anoAtual) {
    if (periodoAtual === "dia") return formatarDataBR(dataAtual);

    if (periodoAtual === "semana") {
      const semana = pegarSemanaPorNumero(Number(anoAtual), Number(semanaAtual));
      return `${semanaAtual}ª Semana • ${formatarDataBR(semana.inicio)} à ${formatarDataBR(semana.fim)}`;
    }

    if (periodoAtual === "mes") return `${meses[Number(mesAtual) - 1]} / ${anoAtual}`;

    return String(anoAtual);
  }

  function rotuloPeriodo() {
    const mapa = {
      dia: "do dia",
      semana: "da semana",
      mes: "do mês",
      ano: "do ano",
    };

    return mapa[periodo] || "do período";
  }

  function rotuloMeta() {
    const mapa = {
      dia: "Meta do dia",
      semana: "Meta da semana",
      mes: "Meta do mês",
      ano: "Meta do ano",
    };

    return mapa[periodo] || "Meta do período";
  }

  function intervalParaMinutos(intervalo) {
    if (!intervalo) return 0;
    const partes = String(intervalo).split(":");
    const horas = Number(partes[0] || 0);
    const minutos = Number(partes[1] || 0);
    return horas * 60 + minutos;
  }

  function anosComDados() {
    const anos = [...new Set(datasComMovimento.map((data) => Number(String(data).slice(0, 4))))]
      .filter(Boolean)
      .sort((a, b) => a - b);
    return anos.length > 0 ? anos : [new Date().getFullYear()];
  }

  function diaTemMovimento(data) {
    return datasComMovimento.includes(data);
  }

  function semanaTemMovimento(semana) {
    const datas = pegarSemanaPorNumero(Number(anoSelecionado), semana);
    return datasComMovimento.some((data) => data >= datas.inicio && data <= datas.fim);
  }

  function mesTemMovimento(mes) {
    const mesTexto = String(mes).padStart(2, "0");
    return datasComMovimento.some((data) => String(data).startsWith(`${anoSelecionado}-${mesTexto}`));
  }

  function anoTemMovimento(ano) {
    return datasComMovimento.some((data) => String(data).startsWith(`${ano}-`));
  }

  function diasDoMesCalendario() {
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

  function alterarMes(delta) {
    let novoMes = Number(mesSelecionado) + delta;
    let novoAno = Number(anoSelecionado);

    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    }

    if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }

    setMesSelecionado(String(novoMes));
    setAnoSelecionado(novoAno);
  }

  function selecionarHoje() {
    const agora = new Date();
    setDataSelecionada(dataISO(agora));
    setMesSelecionado(String(agora.getMonth() + 1));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarSemanaAtual() {
    const agora = new Date();
    setSemanaSelecionada(getSemanaDoAno(agora));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarMesAtual() {
    const agora = new Date();
    setMesSelecionado(String(agora.getMonth() + 1));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarAnoAtual() {
    setAnoSelecionado(new Date().getFullYear());
  }

  function selecionarDia(dia) {
    const data = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (!diaTemMovimento(data)) return;
    setDataSelecionada(data);
  }

  const contasAtivasDashboard = contas.filter((conta) => contasSelecionadas.includes(String(conta.id)));
  const saldoGeral = contasAtivasDashboard.reduce((total, conta) => total + Number(conta.saldo_atual || 0), 0);
  const horasDecimal = metricas.minutosTrabalhados / 60;
  const ganhoPorKm = metricas.km > 0 ? metricas.faturamento / metricas.km : 0;
  const ganhoPorHora = horasDecimal > 0 ? metricas.faturamento / horasDecimal : 0;
  const ganhoPorCorrida = metricas.corridas > 0 ? metricas.faturamento / metricas.corridas : 0;
  const plataformas = Object.values(metricas.plataformas || {}).sort((a, b) => b.valor - a.valor);
  const periodoTexto = rotuloPeriodo();
  const metaTexto = rotuloMeta();
  const mostrarMetricasPorDia = periodo !== "dia";
  const mediaPorDiaTrabalhado = metricas.diasTrabalhados > 0 ? metricas.faturamento / metricas.diasTrabalhados : 0;
  const totalProximasContas = proximasContas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const contasNegativas = contasAtivasDashboard
    .filter((conta) => Number(conta.saldo_atual || 0) < 0)
    .map((conta) => ({
      id: `negativa-${conta.id}`,
      tipo: "Conta negativa",
      titulo: conta.nome,
      subtitulo: conta.tipo_conta === "tag" ? "TAG" : conta.tipo_conta || "Conta",
      data: hojeISO,
      valor: Math.abs(Number(conta.saldo_atual || 0)),
    }));
  const itensContasAtrasadasCard = [
    ...(configContasAtrasadas.mostrarAtrasadas ? contasAtrasadas : []),
    ...(configContasAtrasadas.mostrarNegativas ? contasNegativas : []),
  ];
  const totalContasAtrasadas = itensContasAtrasadasCard.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const custoTrabalho = metricas.custos?.trabalho || { total: 0, categorias: [] };
  const resultadoOperacional = metricas.faturamento - Number(custoTrabalho.total || 0);
  const formatarValorFinanceiro = (valor) => valoresFinanceirosVisiveis ? formatarMoeda(valor) : "••••";

  const paineisDashboard = [
    {
      id: "performance",
      titulo: "Performance",
      descricao: "Acompanhe faturamento, metas, produtividade e custos da sua operação.",
      Icone: FiActivity,
      destaque: "green",
    },
    {
      id: "financeiro",
      titulo: "Financeiro",
      descricao: "Visualize saldos, contas, cartões, investimentos e compromissos financeiros.",
      Icone: FiDollarSign,
      destaque: "blue",
    },
    {
      id: "veiculo",
      titulo: "Veículo",
      descricao: "Gerencie custos, abastecimentos, manutenções, documentos e uso do veículo.",
      Icone: FiTruck,
      destaque: "orange",
    },
    {
      id: "pessoal",
      titulo: "Pessoal",
      descricao: "Acompanhe receitas, despesas e a evolução da sua vida financeira pessoal.",
      Icone: FiUser,
      destaque: "purple",
    },
  ];

  const painelAtual = paineisDashboard.find((painel) => painel.id === abaDashboard) || null;

  return (
    <div className="space-y-6 pb-10">
      <DashboardAnimations />

      {!abaDashboard ? (
        <DashboardHome paineis={paineisDashboard} abrirPainel={setAbaDashboard} />
      ) : (
        <>
          <DashboardPainelHeader
            painel={painelAtual}
            voltar={() => setAbaDashboard(null)}
          >
            {!carregando && abaDashboard === "performance" && (
              <PeriodoControle
                periodo={periodo}
                setPeriodo={setPeriodo}
                textoPeriodo={textoPeriodoSelecionado()}
                abrirPeriodo={() => setModalPeriodoAberto(true)}
                compacto
              />
            )}
          </DashboardPainelHeader>

          {carregando ? (
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
              <p className="text-gray-400">Carregando dashboard...</p>
            </div>
          ) : (
            <>
              {abaDashboard === "performance" && (
                <section className="space-y-4">
                  {periodo !== "dia" && (
                    <GraficoHistoricoFaturamento
                      dados={metricas.historicoFaturamento || []}
                      periodo={periodo}
                      periodoLabel={textoPeriodoSelecionado()}
                      formatarMoeda={formatarMoeda}
                    />
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch xl:min-h-[286px]">
                    <div className="xl:col-span-5 grid grid-rows-2 gap-3 h-full min-h-0">
                      <FaturamentoCard titulo={`Faturamento bruto ${periodoTexto}`} valor={formatarMoeda(metricas.faturamento)} />
                      <MetaCard
                        metaLabel={metaTexto}
                        metaValor={formatarMoeda(metricas.meta)}
                        percentual={metricas.percentualMeta}
                        faltaMeta={metricas.faltaMeta}
                        formatarMoeda={formatarMoeda}
                      />
                    </div>

                    <div className="xl:col-span-7 grid grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 gap-3 h-full min-h-0">
                      <MetricCard titulo={`KM rodados ${periodoTexto}`} valor={formatarNumero(metricas.km)} />
                      <MetricCard titulo={`Horas ${periodoTexto}`} valor={formatarHoras(metricas.minutosTrabalhados)} />
                      <MetricCard titulo={`Corridas ${periodoTexto}`} valor={formatarNumero(metricas.corridas)} />
                      <MetricCard titulo={`Ganho/KM ${periodoTexto}`} valor={formatarMoeda(ganhoPorKm)} />
                      <MetricCard titulo={`Ganho/Hora ${periodoTexto}`} valor={formatarMoeda(ganhoPorHora)} />
                      <MetricCard titulo={`Ganho/Corrida ${periodoTexto}`} valor={formatarMoeda(ganhoPorCorrida)} />
                      {mostrarMetricasPorDia && (
                        <>
                          <MetricCard titulo={`Dias trabalhados ${periodoTexto}`} valor={formatarNumero(metricas.diasTrabalhados)} />
                          <MetricCard titulo={`Média por dia trabalhado ${periodoTexto}`} valor={formatarMoeda(mediaPorDiaTrabalhado)} />
                        </>
                      )}
                    </div>
                  </div>

                  <PlataformasCard plataformas={plataformas} total={metricas.faturamento} formatarMoeda={formatarMoeda} />

                  <CustosCategoriaCard
                    titulo="Custos de trabalho"
                    dados={custoTrabalho}
                    baseComparacao={metricas.faturamento}
                    labelBase="do faturamento"
                    rateio={metricas.rateioUsoVeiculo}
                    abrirRateio={() => setModalRateioAberto(true)}
                    formatarMoeda={formatarMoeda}
                  />

                  <ResultadoOperacionalCard
                    faturamento={metricas.faturamento}
                    custos={custoTrabalho.total}
                    resultado={resultadoOperacional}
                    formatarMoeda={formatarMoeda}
                  />
                </section>
              )}

              {abaDashboard === "financeiro" && (
                <section className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setValoresFinanceirosVisiveis((valor) => !valor)}
                      className="w-10 h-10 rounded-xl border border-gray-700 hover:border-green-400 hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-green-400 transition"
                      title={valoresFinanceirosVisiveis ? "Ocultar valores" : "Mostrar valores"}
                      aria-label={valoresFinanceirosVisiveis ? "Ocultar valores" : "Mostrar valores"}
                    >
                      {valoresFinanceirosVisiveis ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                    <SaldoGeralCard saldoGeral={saldoGeral} contas={contasAtivasDashboard} abrirConfiguracao={() => setModalContasAberto(true)} formatarMoeda={formatarValorFinanceiro} />
                    <ContasAtrasadasCard contas={itensContasAtrasadasCard} total={totalContasAtrasadas} abrirConfiguracao={() => setModalContasAtrasadasAberto(true)} formatarMoeda={formatarValorFinanceiro} formatarDataBR={formatarDataBR} />
                    <ProximasContasCard contas={proximasContas} dias={diasContasPagar} abrirConfiguracao={() => setModalContasPagarAberto(true)} formatarMoeda={formatarValorFinanceiro} formatarDataBR={formatarDataBR} total={totalProximasContas} />
                    <InvestimentosObjetivosCard formatarMoeda={formatarValorFinanceiro} />
                  </div>
                </section>
              )}

              {abaDashboard === "veiculo" && (
                <section>
                  <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6">
                    <h3 className="text-xl font-bold">Área do veículo</h3>
                    <p className="text-gray-400 mt-2">Aqui vamos concentrar km, custos por km, abastecimentos, manutenções, TAG e indicadores do carro.</p>
                  </div>
                </section>
              )}

              {abaDashboard === "pessoal" && (
                <section className="space-y-4">
                  <PeriodoControle
                    periodo={periodoPessoal}
                    setPeriodo={setPeriodoPessoal}
                    textoPeriodo={textoPeriodoPessoalSelecionado()}
                    abrirPeriodo={() => setModalPeriodoPessoalAberto(true)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ResumoFinanceiroCard titulo="Entradas pessoais" valor={metricasPessoais.entradas} destaque="green" formatarMoeda={formatarMoeda} />
                    <ResumoFinanceiroCard titulo="Custos pessoais" valor={metricasPessoais.custos.total} destaque="red" formatarMoeda={formatarMoeda} />
                    <ResumoFinanceiroCard titulo="Resultado pessoal" valor={metricasPessoais.resultado} destaque={metricasPessoais.resultado >= 0 ? "green" : "red"} formatarMoeda={formatarMoeda} />
                  </div>

                  <CustosCategoriaCard
                    titulo="Custos pessoais"
                    dados={metricasPessoais.custos}
                    baseComparacao={metricasPessoais.entradas}
                    labelBase="das entradas pessoais"
                    rateio={metricasPessoais.rateioUsoVeiculo}
                    abrirRateio={() => setModalRateioAberto(true)}
                    formatarMoeda={formatarMoeda}
                  />
                </section>
              )}
            </>
          )}
        </>
      )}

      {modalRateioAberto && (
        <ModalRateioDashboard
          rateio={abaDashboard === "pessoal" ? metricasPessoais.rateioUsoVeiculo : metricas.rateioUsoVeiculo}
          fechar={() => setModalRateioAberto(false)}
        />
      )}

      {modalContasAberto && (
        <ModalContasDashboard
          contas={contas}
          contasSelecionadas={contasSelecionadas}
          alternarConta={alternarContaDashboard}
          selecionarTodas={aplicarTodasContas}
          fechar={() => setModalContasAberto(false)}
          formatarMoeda={formatarMoeda}
        />
      )}

      {modalContasPagarAberto && (
        <ModalContasPagarDashboard
          diasSelecionados={diasContasPagar}
          alterarDias={alterarDiasContasPagar}
          fechar={() => setModalContasPagarAberto(false)}
        />
      )}

      {modalContasAtrasadasAberto && (
        <ModalContasAtrasadasDashboard
          config={configContasAtrasadas}
          alterarConfig={alterarConfigContasAtrasadas}
          fechar={() => setModalContasAtrasadasAberto(false)}
        />
      )}

      {modalPeriodoAberto && (
        <ModalPeriodo
          periodo={periodo}
          setPeriodo={setPeriodo}
          meses={meses}
          diasSemana={diasSemana}
          dataSelecionada={dataSelecionada}
          mesSelecionado={mesSelecionado}
          anoSelecionado={anoSelecionado}
          semanaSelecionada={semanaSelecionada}
          setMesSelecionado={setMesSelecionado}
          setAnoSelecionado={setAnoSelecionado}
          setSemanaSelecionada={setSemanaSelecionada}
          alterarMes={alterarMes}
          selecionarHoje={selecionarHoje}
          selecionarSemanaAtual={selecionarSemanaAtual}
          selecionarMesAtual={selecionarMesAtual}
          selecionarAnoAtual={selecionarAnoAtual}
          diasDoMesCalendario={diasDoMesCalendario}
          diaTemMovimento={diaTemMovimento}
          semanaTemMovimento={semanaTemMovimento}
          mesTemMovimento={mesTemMovimento}
          anoTemMovimento={anoTemMovimento}
          selecionarDia={selecionarDia}
          anosComDados={anosComDados}
          pegarSemanaPorNumero={pegarSemanaPorNumero}
          formatarDataBR={formatarDataBR}
          setModalAnoAberto={setModalAnoAberto}
          setModalMesAnoAberto={setModalMesAnoAberto}
          setEtapaMesAno={setEtapaMesAno}
          fechar={() => setModalPeriodoAberto(false)}
        />
      )}

      {modalPeriodoPessoalAberto && (
        <ModalPeriodo
          periodo={periodoPessoal}
          setPeriodo={setPeriodoPessoal}
          meses={meses}
          diasSemana={diasSemana}
          dataSelecionada={dataPessoalSelecionada}
          mesSelecionado={mesPessoalSelecionado}
          anoSelecionado={anoPessoalSelecionado}
          semanaSelecionada={semanaPessoalSelecionada}
          setMesSelecionado={setMesPessoalSelecionado}
          setAnoSelecionado={setAnoPessoalSelecionado}
          setSemanaSelecionada={setSemanaPessoalSelecionada}
          alterarMes={(delta) => {
            let novoMes = Number(mesPessoalSelecionado) + delta;
            let novoAno = Number(anoPessoalSelecionado);
            if (novoMes < 1) {
              novoMes = 12;
              novoAno -= 1;
            }
            if (novoMes > 12) {
              novoMes = 1;
              novoAno += 1;
            }
            setMesPessoalSelecionado(String(novoMes));
            setAnoPessoalSelecionado(novoAno);
          }}
          selecionarHoje={() => {
            const agora = new Date();
            setDataPessoalSelecionada(dataISO(agora));
            setMesPessoalSelecionado(String(agora.getMonth() + 1));
            setAnoPessoalSelecionado(agora.getFullYear());
          }}
          selecionarSemanaAtual={() => {
            const agora = new Date();
            setSemanaPessoalSelecionada(getSemanaDoAno(agora));
            setAnoPessoalSelecionado(agora.getFullYear());
          }}
          selecionarMesAtual={() => {
            const agora = new Date();
            setMesPessoalSelecionado(String(agora.getMonth() + 1));
            setAnoPessoalSelecionado(agora.getFullYear());
          }}
          selecionarAnoAtual={() => setAnoPessoalSelecionado(new Date().getFullYear())}
          diasDoMesCalendario={() => diasDoMesCalendarioGenerico(anoPessoalSelecionado, mesPessoalSelecionado)}
          diaTemMovimento={diaTemMovimento}
          semanaTemMovimento={semanaTemMovimento}
          mesTemMovimento={mesTemMovimento}
          anoTemMovimento={anoTemMovimento}
          selecionarDia={(dia) => {
            const data = `${anoPessoalSelecionado}-${String(mesPessoalSelecionado).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            setDataPessoalSelecionada(data);
          }}
          anosComDados={anosComDados}
          pegarSemanaPorNumero={pegarSemanaPorNumero}
          formatarDataBR={formatarDataBR}
          setModalAnoAberto={setModalAnoAberto}
          setModalMesAnoAberto={setModalMesAnoAberto}
          setEtapaMesAno={setEtapaMesAno}
          fechar={() => setModalPeriodoPessoalAberto(false)}
        />
      )}

      {modalAnoAberto && (
        <ModalAno
          anos={anosComDados()}
          anoSelecionado={anoSelecionado}
          setAnoSelecionado={setAnoSelecionado}
          fechar={() => setModalAnoAberto(false)}
        />
      )}

      {modalMesAnoAberto && (
        <ModalMesAno
          etapa={etapaMesAno}
          setEtapa={setEtapaMesAno}
          anos={anosComDados()}
          meses={meses}
          anoSelecionado={anoSelecionado}
          setAnoSelecionado={setAnoSelecionado}
          mesSelecionado={mesSelecionado}
          setMesSelecionado={setMesSelecionado}
          mesTemMovimento={mesTemMovimento}
          fechar={() => setModalMesAnoAberto(false)}
        />
      )}
    </div>
  );
}




