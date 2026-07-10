import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff, FiInfo, FiSettings } from "react-icons/fi";
import { supabase } from "../services/supabase";
import { detalheCartao } from "../cartoes/cartoesUtils";

import uberIcon from "../assets/plataformas/uber.png";
import noveNoveIcon from "../assets/plataformas/99.png";
import ifoodIcon from "../assets/plataformas/ifood.svg";
import inDriveIcon from "../assets/plataformas/indrive.svg";
import lalamoveIcon from "../assets/plataformas/lalamove.svg";
import mercadoLivreIcon from "../assets/plataformas/mercadolivre.png";
import rappiIcon from "../assets/plataformas/rappi.png";
import shopeeIcon from "../assets/plataformas/shopee.svg";

const CONTAS_DASHBOARD_KEY = "controldriver_dashboard_contas_ativas_v1";
const CONTAS_PAGAR_DIAS_KEY = "controldriver_dashboard_contas_pagar_dias_v1";
const CONTAS_ATRASADAS_CONFIG_KEY = "controldriver_dashboard_contas_atrasadas_config_v1";
const DASHBOARD_PREFERENCIAS_KEY = "controldriver_dashboard_preferencias_v1";

export default function Dashboard() {
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
  const [abaDashboard, setAbaDashboard] = useState(preferenciasDashboard.abaDashboard || "performance");

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
      valor: Math.max(Number(fatura.valor_total || 0) - Number(fatura.valor_pago || 0), 0),
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
      valor: Math.max(Number(fatura.valor_total || 0) - Number(fatura.valor_pago || 0), 0),
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

  return (
    <div className="space-y-6 pb-10">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="inline-flex min-w-max rounded-2xl border border-gray-800 bg-[#0B1120] p-1.5">
          {[
            { id: "performance", titulo: "Performance" },
            { id: "financeiro", titulo: "Financeiro" },
            { id: "veiculo", titulo: "Veículo" },
            { id: "pessoal", titulo: "Pessoal" },
          ].map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaDashboard(aba.id)}
              className={`min-w-[112px] rounded-xl px-4 py-2.5 text-sm font-black transition ${
                abaDashboard === aba.id
                  ? "bg-green-500 text-black"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {aba.titulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando dashboard...</p>
        </div>
      ) : (
        <>
          {abaDashboard === "performance" && (
            <section className="space-y-4">
              <PeriodoControle
                periodo={periodo}
                setPeriodo={setPeriodo}
                textoPeriodo={textoPeriodoSelecionado()}
                abrirPeriodo={() => setModalPeriodoAberto(true)}
              />

              <div className="grid grid-cols-1 xl:grid-cols-6 gap-3 items-stretch">
                <div className="xl:col-span-2 grid grid-cols-1 gap-3">
                  <FaturamentoCard titulo={`Faturamento bruto ${periodoTexto}`} valor={formatarMoeda(metricas.faturamento)} />
                  <MetaCard
                    metaLabel={metaTexto}
                    metaValor={formatarMoeda(metricas.meta)}
                    percentual={metricas.percentualMeta}
                    faltaMeta={metricas.faltaMeta}
                    formatarMoeda={formatarMoeda}
                  />
                </div>

                <div className="xl:col-span-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
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


function carregarPreferenciasDashboardLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_PREFERENCIAS_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function salvarPreferenciasDashboardLocalStorage(preferencias) {
  try {
    localStorage.setItem(DASHBOARD_PREFERENCIAS_KEY, JSON.stringify(preferencias));
  } catch (_) {
    // Ignora erro de armazenamento local.
  }
}

function criarMetricasPessoaisVazias() {
  return {
    entradas: 0,
    custos: { total: 0, categorias: [] },
    resultado: 0,
    periodo: null,
    rateioUsoVeiculo: null,
  };
}

function diasDoMesCalendarioGenerico(anoSelecionado, mesSelecionado) {
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

function entradaAvulsaPessoal(entrada) {
  const descricao = normalizarTexto(entrada?.descricao);
  if (descricao.includes("recargatag") || descricao.includes("recargadetag")) return false;
  return true;
}

function PeriodoControle({ periodo, setPeriodo, textoPeriodo, abrirPeriodo }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-green-400">Seleção de período</p>
        <p className="text-sm text-gray-500 mt-1">Escolha o intervalo usado nos indicadores.</p>
      </div>

      <div className="w-full md:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-gray-800 bg-[#111827] p-1 sm:w-[330px]">
          {[
            ["dia", "Dia"],
            ["semana", "Semana"],
            ["mes", "Mês"],
            ["ano", "Ano"],
          ].map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPeriodo(valor)}
              className={`min-w-0 px-2 py-2 rounded-lg text-sm font-black transition ${
                periodo === valor ? "bg-green-500 text-black" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={abrirPeriodo}
          className="w-full sm:w-[170px] bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2.5 text-gray-200 text-sm font-bold text-center transition"
        >
          {textoPeriodo}
        </button>
      </div>
    </div>
  );
}

function ResumoFinanceiroCard({ titulo, valor, destaque, formatarMoeda }) {
  const classe = destaque === "green" ? "text-green-400" : destaque === "red" ? "text-red-400" : "text-white";

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <p className="text-sm text-gray-400">{titulo}</p>
      <h3 className={`text-3xl font-black mt-2 ${classe}`}>{formatarMoeda(valor)}</h3>
    </div>
  );
}

function ResultadoOperacionalCard({ faturamento, custos, resultado, formatarMoeda }) {
  const positivo = Number(resultado || 0) >= 0;

  return (
    <div className={`rounded-3xl p-5 sm:p-6 border ${positivo ? "bg-green-500 border-green-400 text-black" : "bg-red-500 border-red-400 text-white"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <p className={`text-sm font-black ${positivo ? "text-black/70" : "text-white/75"}`}>Resultado operacional</p>
          <div className={`mt-3 flex flex-col gap-1.5 text-sm ${positivo ? "text-black/70" : "text-white/80"}`}>
            <span>Faturamento: <strong>{formatarMoeda(faturamento)}</strong></span>
            <span>Custos: <strong>{formatarMoeda(custos)}</strong></span>
          </div>
        </div>

        <h3 className="text-4xl sm:text-5xl font-black sm:text-right whitespace-nowrap">{formatarMoeda(resultado)}</h3>
      </div>
    </div>
  );
}

function CustosCategoriaCard({ titulo, dados, baseComparacao, labelBase, rateio, abrirRateio, formatarMoeda }) {
  const categorias = dados?.categorias || [];
  const total = Number(dados?.total || 0);
  const percentualBase = Number(baseComparacao || 0) > 0 ? (total / Number(baseComparacao || 0)) * 100 : 0;

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{titulo}</h3>
        {rateio && (
          <button
            type="button"
            onClick={abrirRateio}
            className="w-9 h-9 rounded-xl border border-gray-700 hover:border-blue-400 hover:text-blue-300 flex items-center justify-center text-gray-400 transition"
            title="Entender o rateio por uso do veículo"
            aria-label="Entender o rateio por uso do veículo"
          >
            <FiInfo />
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-col items-center">
        <GraficoAnelCategorias categorias={categorias} total={total} formatarMoeda={formatarMoeda} />
        <p className="text-xs text-gray-500 mt-3">{Math.round(percentualBase)}% {labelBase}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {categorias.length === 0 ? (
          <p className="text-sm text-gray-500 md:col-span-2 xl:col-span-3">Nenhum custo encontrado neste período.</p>
        ) : (
          categorias.map((categoria) => (
            <div key={categoria.nome} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: categoria.cor }} />
                  <span className="font-bold truncate" style={{ color: categoria.cor }}>{categoria.nome}</span>
                </div>
                <span className="font-black whitespace-nowrap">{formatarMoeda(categoria.valor)}</span>
              </div>
              <div className="mt-3 h-2.5 bg-[#111827] rounded-full overflow-hidden border border-gray-800">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(Number(categoria.percentualDoFaturamento || 0), 100)}%`,
                    backgroundColor: categoria.cor,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {Math.round(categoria.percentualDoCusto)}% dos custos • {Math.round(categoria.percentualDoFaturamento || 0)}% do faturamento
              </p>
            </div>
          ))
        )}
      </div>

      {rateio && !rateio?.calculado && (
        <p className="text-xs text-yellow-400 mt-4">
          Sem KM total de abastecimento no período. Categorias rateadas foram consideradas como trabalho até existir abastecimento no período.
        </p>
      )}
    </div>
  );
}

function criarMetricasVazias() {
  return {
    faturamento: 0,
    km: 0,
    corridas: 0,
    minutosTrabalhados: 0,
    diasTrabalhados: 0,
    datasTrabalhadas: new Set(),
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
  };
}


function criarCustosVazios() {
  return {
    trabalho: { total: 0, categorias: [] },
    pessoal: { total: 0, categorias: [] },
  };
}


function calcularRateioUsoVeiculo(kmTotalVeiculoPeriodo, kmTrabalhoPeriodo) {
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

function calcularCustosPorFinalidade(saidas, categorias, faturamentoPeriodo = 0, rateioUsoVeiculo = null, saidasTag = []) {
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

function calcularRateioUsoTag(saidas, saidasTagPorId) {
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

function adicionarCustoCategoria(resumo, finalidade, nome, valor, categoria, rateado) {
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

function obterCategoriaDaSaida(saida, categoriasPorId, categoriasPorNome) {
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

function normalizarTipoUsoCategoria(tipoUso) {
  const valor = String(tipoUso || "opcional").toLowerCase();

  if (["trabalho", "uso_trabalho", "uso a trabalho"].includes(valor)) return "trabalho";
  if (["pessoal", "uso_pessoal", "uso pessoal"].includes(valor)) return "pessoal";
  if (["rateada", "rateado", "calculada", "calculado", "calculada_pelo_uso", "uso_veiculo"].includes(valor)) return "rateada";
  if (["proporcional", "uso_proporcional", "proporcao_tag"].includes(valor)) return "proporcional";

  return "opcional";
}

function custoRealParaDashboard(saida) {
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
  ]);

  return !categoriasIgnoradas.has(categoria);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function corCategoria(nome, corSalva = null) {
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

function getSemanaDoAno(data) {
  const inicioAno = new Date(data.getFullYear(), 0, 1);
  const dias = Math.floor((data - inicioAno) / 86400000);
  return Math.ceil((dias + inicioAno.getDay() + 1) / 7);
}

function pegarSemanaPorNumero(ano, numeroSemana) {
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

function dataISO(date) {
  return date.toISOString().split("T")[0];
}


async function calcularMetaPeriodo(meta, periodo, filtros) {
  if (!meta) return 0;

  const hojeTexto = dataISO(new Date());

  if (periodo === "dia") {
    const dataRef = filtros?.dataSelecionada || hojeTexto;
    return calcularMetaNecessariaNoDia(meta, dataRef);
  }

  const { inicio, fim } = intervaloPorFiltros(periodo, filtros);
  return calcularMetaPlanejadaPeriodo(meta, inicio, fim);
}

function intervaloPorFiltros(periodo, filtros) {
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

async function calcularMetaNecessariaHoje(meta, hojeTexto) {
  return calcularMetaNecessariaNoDia(meta, hojeTexto);
}

async function calcularMetaNecessariaNoDia(meta, dataRef) {
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

function calcularMetaPlanejadaPeriodo(meta, inicio, fim) {
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

function periodoBaseMeta(meta, dataRef) {
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

function deveConsiderarRealizadoManual(meta, periodo) {
  if (!meta?.data_inicio || !periodo?.inicio || !periodo?.fim) return false;
  return meta.data_inicio >= periodo.inicio && meta.data_inicio <= periodo.fim;
}

function metaValorPeriodoBase(meta, inicio, fim) {
  if (meta.tipo === "semanal") return Number(meta.valor_base || 0);
  if (meta.tipo === "mensal") return Number(meta.valor_base || 0);
  if (meta.tipo === "anual") return Number(meta.valor_base || 0);
  return calcularMetaPlanejadaPeriodo(meta, inicio, fim);
}

function somarMetaSemanalNoIntervalo(meta, inicio, fim) {
  const semanas = semanasEntre(inicio, fim);
  return semanas.reduce((total, semana) => {
    const diasSemanaCheia = diasTrabalhoNoPeriodo(meta, semana.inicio, semana.fim).length || 1;
    const inicioCorte = maiorData(inicio, semana.inicio);
    const fimCorte = menorData(fim, semana.fim);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasSemanaCheia);
  }, 0);
}

function somarMetaMensalNoIntervalo(meta, inicio, fim) {
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

function somarMetaAnualNoIntervalo(meta, inicio, fim) {
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

function diasTrabalhoNoPeriodo(meta, inicio, fim) {
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

async function buscarTotalEntradasDashboard(inicio, fim) {
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

function normalizarArrayNumerico(valor) {
  if (Array.isArray(valor)) return valor.map(Number).filter((item) => !Number.isNaN(item));
  if (typeof valor === "string") {
    try {
      const convertido = JSON.parse(valor);
      return Array.isArray(convertido) ? convertido.map(Number).filter((item) => !Number.isNaN(item)) : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function normalizarDiasSemana(valor) {
  const dias = normalizarArrayNumerico(valor);
  return dias.filter((dia) => dia >= 0 && dia <= 6);
}

function contarDiasCalendario(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return 0;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  return Math.max(Math.floor((b - a) / 86400000) + 1, 0);
}

function adicionarDiasISO(dataISOTexto, quantidade) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  data.setDate(data.getDate() + quantidade);
  return dataISO(data);
}

function maiorData(a, b) {
  return String(a) > String(b) ? a : b;
}

function menorData(a, b) {
  return String(a) < String(b) ? a : b;
}

function inicioSemanaISOGlobal(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const diaSemana = data.getDay();
  const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + diferenca);
  return dataISO(data);
}

function semanasEntre(inicio, fim) {
  const semanas = [];
  let inicioSemana = inicioSemanaISOGlobal(inicio);

  while (inicioSemana <= fim) {
    semanas.push({ inicio: inicioSemana, fim: adicionarDiasISO(inicioSemana, 6) });
    inicioSemana = adicionarDiasISO(inicioSemana, 7);
  }

  return semanas;
}

function mesesEntre(inicio, fim) {
  const meses = [];
  const data = new Date(`${inicio.slice(0, 7)}-01T00:00:00`);
  const fimMes = new Date(`${fim.slice(0, 7)}-01T00:00:00`);

  while (data <= fimMes) {
    meses.push({ ano: data.getFullYear(), mes: data.getMonth() + 1 });
    data.setMonth(data.getMonth() + 1);
  }

  return meses;
}

function anosEntre(inicio, fim) {
  const anoInicio = Number(inicio.slice(0, 4));
  const anoFim = Number(fim.slice(0, 4));
  const anos = [];
  for (let ano = anoInicio; ano <= anoFim; ano++) anos.push(ano);
  return anos;
}


function listarDatasPeriodo(inicio, fim) {
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

function nomeDiaSemanaCurto(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][data.getDay()];
}

function InvestimentosObjetivosCard({ formatarMoeda }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <p className="text-sm text-gray-400">Investimentos / Objetivos</p>
      <h3 className="text-2xl font-black mt-1">{formatarMoeda(0)}</h3>
      <p className="text-xs text-gray-500 mt-2">
        Espaço reservado para reservas, objetivos e investimentos quando essa parte for implementada.
      </p>
      <div className="mt-4 h-3 rounded-full bg-[#0B1120] border border-gray-800 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: "0%" }} />
      </div>
    </div>
  );
}

function ContasAtrasadasCard({ contas, total, abrirConfiguracao, formatarMoeda, formatarDataBR }) {
  return (
    <div className="relative bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="Configurar contas atrasadas e negativas"
        aria-label="Configurar contas atrasadas e negativas"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm text-gray-400">Contas atrasadas / negativas</p>
        <h3 className="text-2xl font-black mt-1 text-red-400">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Faturas vencidas, contas em atraso e contas negativas configuradas.</p>
      </div>

      <div className="mt-4 space-y-3">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500">Nada para mostrar conforme sua configuração.</p>
        ) : (
          contas.slice(0, 5).map((conta) => (
            <div key={conta.id} className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 bg-red-500/10 text-red-300 border border-red-500/30">
                    {conta.tipo}
                  </span>
                  <p className="font-bold truncate">{conta.titulo}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {conta.data ? `${formatarDataBR(conta.data)} • ` : ""}{conta.subtitulo}
                </p>
              </div>
              <p className="font-black text-red-400 whitespace-nowrap">{formatarMoeda(conta.valor)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SaldoGeralCard({ saldoGeral, contas, abrirConfiguracao, formatarMoeda }) {
  return (
    <div className="relative bg-green-500 border border-green-400 rounded-3xl p-6 sm:p-7 text-white overflow-hidden">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-black/10 hover:bg-black/20 border border-white/15 flex items-center justify-center text-white/90 transition"
        title="Configurar contas do saldo"
        aria-label="Configurar contas do saldo"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm font-black uppercase tracking-wide text-white/80">Saldo Atual Geral</p>
        <h2 className="text-4xl sm:text-5xl font-black mt-2">{formatarMoeda(saldoGeral)}</h2>
        <p className="text-sm text-white/80 mt-3">
          {contas.length} conta(s) incluída(s) neste saldo.
        </p>
      </div>

      <div className="mt-5 divide-y divide-white/15">
        {contas.slice(0, 6).map((conta) => (
          <div key={conta.id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-white/85">{conta.nome}</span>
            <span className="whitespace-nowrap text-white/90">{formatarMoeda(conta.saldo_atual)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaturamentoCard({ titulo, valor }) {
  return (
    <div className="bg-gradient-to-br from-green-500/15 to-[#111827] border border-green-500/30 rounded-3xl p-5 sm:p-6 min-h-[138px] flex flex-col justify-between">
      <p className="text-sm font-bold text-green-300">{titulo}</p>
      <h3 className="text-3xl sm:text-4xl font-black mt-4 text-white">{valor}</h3>
    </div>
  );
}

function MetaCard({ metaLabel, metaValor, percentual, faltaMeta, formatarMoeda }) {
  const percentualSeguro = Math.max(Number(percentual || 0), 0);

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-[#111827] border border-blue-500/25 rounded-3xl p-5 sm:p-6 min-h-[138px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-400">{metaLabel}</p>
        <span className="text-sm font-black text-green-400">{Math.round(percentualSeguro)}%</span>
      </div>
      <p className="text-lg font-black mt-2">{metaValor}</p>
      <div className="mt-3 h-2.5 rounded-full bg-[#0B1120] overflow-hidden border border-gray-800">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(percentualSeguro, 100)}%` }} />
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        {faltaMeta > 0 ? `Falta ${formatarMoeda(faltaMeta)}` : "Meta concluída"}
      </p>
    </div>
  );
}

function MetricCard({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 min-h-[104px] flex flex-col justify-between min-w-0">
      <p className="text-xs text-gray-400 leading-snug">{titulo}</p>
      <h3 className="text-xl font-black mt-3 truncate">{valor}</h3>
    </div>
  );
}

function ProximasContasCard({ contas, dias, abrirConfiguracao, formatarMoeda, formatarDataBR, total }) {

  return (
    <div className="relative bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="Configurar contas a pagar"
        aria-label="Configurar contas a pagar"
      >
        <FiSettings className="text-lg" />
      </button>

      <div className="pr-12">
        <p className="text-sm text-gray-400">Próximas contas a pagar</p>
        <h3 className="text-2xl font-black mt-1">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Vencimentos dos próximos {dias} dias.</p>
      </div>

      <div className="mt-4 space-y-3">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta próxima encontrada.</p>
        ) : (
          contas.map((conta) => (
            <div key={conta.id} className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 ${
                    conta.tipo === "Fatura"
                      ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                      : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                  }`}>
                    {conta.tipo}
                  </span>
                  <p className="font-bold truncate">{conta.titulo}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatarDataBR(conta.data)} • {conta.subtitulo}
                </p>
              </div>
              <p className="font-black text-red-400 whitespace-nowrap">{formatarMoeda(conta.valor)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


function PlataformasCard({ plataformas, total, formatarMoeda }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <h3 className="text-xl font-bold">Ganhos por plataforma</h3>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-1 scrollbar-hide xl:grid xl:grid-cols-4 xl:overflow-visible">
        {plataformas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma plataforma no período selecionado.</p>
        ) : (
          plataformas.map((item) => {
            const percentual = total > 0 ? (item.valor / total) * 100 : 0;
            const icone = iconePlataforma(item.nome);

            return (
              <div key={item.nome} className="min-w-[180px] rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
                <div className="flex items-center gap-3">
                  {icone ? (
                    <img src={icone} alt={item.nome} className="w-10 h-10 object-contain rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-center text-xs font-black shrink-0">
                      {String(item.nome || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold truncate">{item.nome}</p>
                    <p className="text-xs text-gray-500">{item.corridas} corrida(s)</p>
                  </div>
                </div>
                <p className="text-xl font-black mt-4">{formatarMoeda(item.valor)}</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round(percentual)}% do faturamento</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function GraficoAnelCategorias({ categorias, total = 0, formatarMoeda }) {
  const lista = (categorias || []).filter((categoria) => Number(categoria.valor || 0) > 0);
  const totalCategorias = lista.reduce((soma, categoria) => soma + Number(categoria.valor || 0), 0);

  if (totalCategorias <= 0) {
    return (
      <div className="w-48 h-48 rounded-full flex items-center justify-center border border-gray-800 bg-[#0B1120]">
        <div className="w-32 h-32 rounded-full bg-[#111827] border border-gray-800 flex items-center justify-center text-center px-2">
          <span className="text-lg font-black text-gray-500">{formatarMoeda ? formatarMoeda(0) : "R$ 0,00"}</span>
        </div>
      </div>
    );
  }

  let acumulado = 0;
  const partes = lista.map((categoria) => {
    const inicio = acumulado;
    const percentual = (Number(categoria.valor || 0) / totalCategorias) * 100;
    acumulado += percentual;
    return `${categoria.cor} ${inicio}% ${acumulado}%`;
  });

  return (
    <div className="w-48 h-48 rounded-full flex items-center justify-center border border-gray-800 shadow-lg shadow-black/20" style={{ background: `conic-gradient(${partes.join(", ")})` }}>
      <div className="w-32 h-32 rounded-full bg-[#111827] border border-gray-800 flex items-center justify-center text-center px-2">
        <span className="text-lg font-black text-white leading-tight">{formatarMoeda ? formatarMoeda(total) : total}</span>
      </div>
    </div>
  );
}

function iconePlataforma(nome) {
  const chave = normalizarNomePlataforma(nome);

  const icones = {
    uber: uberIcon,
    "99": noveNoveIcon,
    ifood: ifoodIcon,
    indrive: inDriveIcon,
    lalamove: lalamoveIcon,
    mercadolivre: mercadoLivreIcon,
    rappi: rappiIcon,
    shopee: shopeeIcon,
  };

  return icones[chave] || null;
}

function normalizarNomePlataforma(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}


function ModalRateioDashboard({ rateio, fechar }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4" onMouseDown={fechar}>
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Rateio pelo uso do veículo</h2>
            <p className="text-gray-400 text-sm mt-2">Custos rateados são divididos entre trabalho e uso pessoal conforme os quilômetros do período.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black">×</button>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 text-sm">
          <p>KM total: <strong>{Number(rateio?.kmTotal || 0).toLocaleString("pt-BR")}</strong></p>
          <p>KM de trabalho: <strong>{Number(rateio?.kmTrabalho || 0).toLocaleString("pt-BR")}</strong></p>
          <p>KM pessoal: <strong>{Number(rateio?.kmPessoal || 0).toLocaleString("pt-BR")}</strong></p>
          <p>Parte de trabalho: <strong className="text-green-400">{Math.round(rateio?.percentualTrabalho || 0)}%</strong></p>
          <p>Parte pessoal: <strong className="text-blue-400">{Math.round(rateio?.percentualPessoal || 0)}%</strong></p>
        </div>

        {!rateio?.calculado && (
          <p className="text-sm text-yellow-400 mt-4">Ainda não existe KM total suficiente para calcular o rateio deste período.</p>
        )}
      </div>
    </div>
  );
}

function ModalContasAtrasadasDashboard({ config, alterarConfig, fechar }) {
  const opcoes = [
    { chave: "mostrarAtrasadas", titulo: "Contas atrasadas", descricao: "Faturas e contas vencidas ainda em aberto." },
    { chave: "mostrarNegativas", titulo: "Contas negativas", descricao: "Contas bancárias, carteira ou TAG com saldo negativo." },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Contas atrasadas / negativas</h2>
            <p className="text-gray-400 text-sm mt-2">Escolha o que aparece no card financeiro.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black">×</button>
        </div>

        <div className="mt-5 space-y-3">
          {opcoes.map((opcao) => {
            const ativo = Boolean(config?.[opcao.chave]);
            return (
              <button
                key={opcao.chave}
                type="button"
                onClick={() => alterarConfig({ [opcao.chave]: !ativo })}
                className={`w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left border transition ${
                  ativo ? "bg-green-500/10 border-green-500/50" : "bg-[#0B1120] border-gray-800 hover:border-green-500/40"
                }`}
              >
                <div>
                  <p className="font-black">{opcao.titulo}</p>
                  <p className="text-sm text-gray-500 mt-1">{opcao.descricao}</p>
                </div>
                <div className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={fechar} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3">
          Concluir
        </button>
      </div>
    </div>
  );
}

function ModalContasPagarDashboard({ diasSelecionados, alterarDias, fechar }) {
  const opcoes = [
    { dias: 7, titulo: "Próximos 7 dias", descricao: "Melhor para acompanhar o curto prazo." },
    { dias: 15, titulo: "Próximos 15 dias", descricao: "Boa visão para a quinzena." },
    { dias: 30, titulo: "Próximos 30 dias", descricao: "Visão mensal das obrigações." },
    { dias: 60, titulo: "Próximos 60 dias", descricao: "Planejamento mais aberto." },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Contas a pagar no Dashboard</h2>
            <p className="text-gray-400 text-sm mt-2">
              Escolha o período de vencimentos exibido no card inicial.
            </p>
          </div>

          <button
            type="button"
            onClick={fechar}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black"
          >
            ×
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {opcoes.map((opcao) => {
            const ativo = Number(diasSelecionados) === Number(opcao.dias);

            return (
              <button
                key={opcao.dias}
                type="button"
                onClick={() => alterarDias(opcao.dias)}
                className={`w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left border transition ${
                  ativo
                    ? "bg-green-500/10 border-green-500/50"
                    : "bg-[#0B1120] border-gray-800 hover:border-green-500/40"
                }`}
              >
                <div>
                  <p className="font-black">{opcao.titulo}</p>
                  <p className="text-sm text-gray-500 mt-1">{opcao.descricao}</p>
                </div>

                <div className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={fechar}
          className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

function ModalContasDashboard({ contas, contasSelecionadas, alternarConta, selecionarTodas, fechar, formatarMoeda }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Contas no Dashboard</h2>
            <p className="text-gray-400 text-sm mt-2">Escolha quais contas entram no Saldo Atual Geral.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black">
            ×
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {contas.map((conta) => {
            const ativo = contasSelecionadas.includes(String(conta.id));
            return (
              <button
                key={conta.id}
                type="button"
                onClick={() => alternarConta(conta.id)}
                className="w-full bg-[#0B1120] border border-gray-800 hover:border-green-500/50 rounded-2xl p-4 flex items-center justify-between gap-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-black truncate">{conta.nome}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatarMoeda(conta.saldo_atual)}</p>
                </div>

                <div className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={selecionarTodas} className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3">
            Ativar todas
          </button>
          <button type="button" onClick={fechar} className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3">
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPeriodo(props) {
  const {
    periodo,
    meses,
    diasSemana,
    dataSelecionada,
    mesSelecionado,
    anoSelecionado,
    semanaSelecionada,
    setMesSelecionado,
    setAnoSelecionado,
    setSemanaSelecionada,
    alterarMes,
    selecionarHoje,
    selecionarSemanaAtual,
    selecionarMesAtual,
    selecionarAnoAtual,
    diasDoMesCalendario,
    diaTemMovimento,
    semanaTemMovimento,
    mesTemMovimento,
    anoTemMovimento,
    selecionarDia,
    anosComDados,
    pegarSemanaPorNumero,
    formatarDataBR,
    setModalAnoAberto,
    setModalMesAnoAberto,
    setEtapaMesAno,
    fechar,
  } = props;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-5 scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Selecionar Período</h2>
            <p className="text-gray-400 mt-2">Escolha o período que deseja visualizar.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">
            ×
          </button>
        </div>

        {periodo === "dia" && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => alterarMes(-1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">‹</button>
              <button
                type="button"
                onClick={() => {
                  setEtapaMesAno("ano");
                  setModalMesAnoAberto(true);
                }}
                className="flex-1 text-center hover:text-green-400 transition cursor-pointer py-2 rounded-xl hover:bg-white/5"
              >
                <span className="text-xl sm:text-2xl font-bold">{meses[Number(mesSelecionado) - 1]}</span>
                <span className="text-xl sm:text-2xl font-bold mx-2 text-gray-500">/</span>
                <span className="text-xl sm:text-2xl font-bold">{anoSelecionado}</span>
              </button>
              <button type="button" onClick={() => alterarMes(1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">›</button>
            </div>

            <button type="button" onClick={selecionarHoje} className="mt-3 text-sm text-green-400 hover:text-green-300 font-semibold">Hoje</button>

            <div className="grid grid-cols-7 gap-1.5 mt-4 min-h-[292px]">
              {diasSemana.map((dia) => <div key={dia} className="text-center text-[11px] text-gray-500 font-bold h-5">{dia}</div>)}
              {diasDoMesCalendario().map((dia, index) => {
                if (!dia) return <div key={`vazio-${index}`} className="h-10" />;
                const data = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const ativo = dataSelecionada === data;
                const temMovimento = diaTemMovimento(data);
                return (
                  <button
                    key={data}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => selecionarDia(dia)}
                    className={`h-10 rounded-lg border text-xs font-bold transition ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : temMovimento
                        ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                        : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {periodo === "semana" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <button type="button" onClick={selecionarSemanaAtual} className="text-sm text-green-400 hover:text-green-300 font-semibold">Esta semana</button>
              <button type="button" onClick={() => setModalAnoAberto(true)} className="hover:text-green-400 transition cursor-pointer">
                <span className="text-gray-400 text-sm mr-2">Ano</span><span className="text-lg font-bold">{anoSelecionado}</span>
              </button>
            </div>

            <p className="text-gray-400 text-sm mt-3">
              Semana selecionada: <span className="text-white font-semibold">{semanaSelecionada}ª</span> • {formatarDataBR(pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada)).inicio)} à {formatarDataBR(pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada)).fim)}
            </p>

            <div className="grid grid-cols-4 gap-2 mt-4 max-h-56 overflow-y-auto pr-1 scrollbar-hide">
              {Array.from({ length: 53 }, (_, i) => i + 1).map((semana) => {
                const ativa = Number(semanaSelecionada) === semana;
                const temMovimento = semanaTemMovimento(semana);
                return (
                  <button
                    key={semana}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => temMovimento && setSemanaSelecionada(semana)}
                    className={`rounded-lg border p-2 text-sm font-bold transition ${
                      ativa
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : temMovimento
                        ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                        : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {semana}ª
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {periodo === "mes" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <button type="button" onClick={selecionarMesAtual} className="text-sm text-green-400 hover:text-green-300 font-semibold">Este mês</button>
              <button type="button" onClick={() => setModalAnoAberto(true)} className="hover:text-green-400 transition cursor-pointer">
                <span className="text-gray-400 text-sm mr-2">Ano</span><span className="text-lg font-bold">{anoSelecionado}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              {meses.map((mes, index) => {
                const valor = String(index + 1);
                const ativo = mesSelecionado === valor;
                const temMovimento = mesTemMovimento(index + 1);
                return (
                  <button
                    key={mes}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => temMovimento && setMesSelecionado(valor)}
                    className={`rounded-xl border p-3 font-semibold ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : temMovimento
                        ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                        : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {mes}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {periodo === "ano" && (
          <div className="mt-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">Somente anos com lançamentos aparecem aqui.</p>
              <button type="button" onClick={selecionarAnoAtual} className="text-sm text-green-400 hover:text-green-300 font-semibold">Este ano</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {anosComDados().map((ano) => {
                const ativo = Number(anoSelecionado) === ano;
                const temMovimento = anoTemMovimento(ano);
                return (
                  <button
                    key={ano}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => temMovimento && setAnoSelecionado(ano)}
                    className={`rounded-xl border p-3 font-semibold ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : temMovimento
                        ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                        : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {ano}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button type="button" onClick={fechar} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">Cancelar</button>
          <button type="button" onClick={fechar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">Aplicar</button>
        </div>
      </div>
    </div>
  );
}

function ModalAno({ anos, anoSelecionado, setAnoSelecionado, fechar }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Selecionar Ano</h2>
            <p className="text-gray-400 mt-2">Somente anos com lançamentos aparecem aqui.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {anos.map((ano) => (
            <button
              key={ano}
              type="button"
              onClick={() => {
                setAnoSelecionado(ano);
                fechar();
              }}
              className={`rounded-xl border p-3 font-semibold ${
                Number(anoSelecionado) === ano
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              {ano}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalMesAno({ etapa, setEtapa, anos, meses, anoSelecionado, setAnoSelecionado, mesSelecionado, setMesSelecionado, mesTemMovimento, fechar }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{etapa === "ano" ? "Selecionar Ano" : "Selecionar Mês"}</h2>
            <p className="text-gray-400 mt-2">Primeiro escolha o ano, depois escolha o mês.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">×</button>
        </div>

        {etapa === "ano" ? (
          <div className="grid grid-cols-3 gap-3 mt-6">
            {anos.map((ano) => (
              <button
                key={ano}
                type="button"
                onClick={() => {
                  setAnoSelecionado(ano);
                  setEtapa("mes");
                }}
                className={`rounded-xl border p-3 font-semibold ${
                  Number(anoSelecionado) === ano
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {ano}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setEtapa("ano")} className="mt-4 text-sm text-gray-400 hover:text-white">
              ← Voltar para anos
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {meses.map((mes, index) => {
                const valor = String(index + 1);
                const ativo = mesSelecionado === valor;
                const temMovimento = mesTemMovimento(index + 1);
                return (
                  <button
                    key={mes}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => {
                      if (!temMovimento) return;
                      setMesSelecionado(valor);
                      fechar();
                    }}
                    className={`rounded-xl border p-3 font-semibold ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : temMovimento
                        ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                        : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {mes}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
