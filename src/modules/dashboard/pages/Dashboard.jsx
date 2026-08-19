import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import {
  calcularSaldoAbertoFatura,
  detalheCartao,
} from "../../cartoes/utils/cartoesUtils";
import { carregarPlataformasFinanceiras } from "../../contas/services/plataformasFinanceiroService";

import {
  PeriodoControle, CustosCategoriaCard,
  ContasAtrasadasCard, SaldoGeralCard, FaturamentoCard, MetaCard, MetricCard,
  ProximasContasCard, PlataformasCard, GraficoHistoricoFaturamento, DashboardAnimations,
} from "../components/DashboardComponentes";
import {
  ModalRateioDashboard, ModalContasDashboard, ModalPeriodo, ModalAno, ModalMesAno,
} from "../components/DashboardModais";
import {
  criarMetricasVazias, calcularRateioUsoVeiculo, calcularCustosPorFinalidade,
  construirHistoricoFaturamento, calcularMetaPeriodo, calcularIndicadoresDiarios,
  getSemanaDoAno, pegarSemanaPorNumero,
} from "../utils/dashboardCalculos";
import {
  carregarPreferenciasDashboardLocalStorage, salvarPreferenciasDashboardLocalStorage,
  criarMetricasPessoaisVazias, criarContextoDashboard, entradaAvulsaPessoal,
} from "../utils/dashboardHelpers";


const CONTAS_DASHBOARD_KEY = "controldriver_dashboard_contas_ativas_v1";
const PLATAFORMAS_DASHBOARD_KEY = "controldriver_dashboard_plataformas_ativas_v1";
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Dashboard({ navegarPara }) {
  const hoje = new Date();
  const hojeISO = dataISO(hoje);
  const preferenciasDashboard = useMemo(() => carregarPreferenciasDashboardLocalStorage(), []);

  const [periodo, setPeriodo] = useState(preferenciasDashboard.periodo || "dia");
  const [dataSelecionada, setDataSelecionada] = useState(preferenciasDashboard.dataSelecionada || hojeISO);
  const [semanaSelecionada, setSemanaSelecionada] = useState(preferenciasDashboard.semanaSelecionada || getSemanaDoAno(hoje));
  const [mesSelecionado, setMesSelecionado] = useState(preferenciasDashboard.mesSelecionado || String(hoje.getMonth() + 1));
  const [anoSelecionado, setAnoSelecionado] = useState(preferenciasDashboard.anoSelecionado || hoje.getFullYear());

  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalContasAberto, setModalContasAberto] = useState(false);
  const [modalAnoAberto, setModalAnoAberto] = useState(false);
  const [modalMesAnoAberto, setModalMesAnoAberto] = useState(false);
  const [etapaMesAno, setEtapaMesAno] = useState("ano");

  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState([]);
  const [plataformasFinanceiras, setPlataformasFinanceiras] = useState([]);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [plataformasSelecionadas, setPlataformasSelecionadas] = useState([]);
  const [datasComMovimento, setDatasComMovimento] = useState([]);
  const [metaAtiva, setMetaAtiva] = useState(null);
  const [metricas, setMetricas] = useState(criarMetricasVazias());
  const [metricasPessoais, setMetricasPessoais] = useState(criarMetricasPessoaisVazias());
  const [proximasContas, setProximasContas] = useState([]);
  const [contasAtrasadas, setContasAtrasadas] = useState([]);
  const [modalRateioAberto, setModalRateioAberto] = useState(false);
  const [tipoRateioModal, setTipoRateioModal] = useState("trabalho");

  const [valoresFinanceirosVisiveis, setValoresFinanceirosVisiveis] = useState(preferenciasDashboard.valoresFinanceirosVisiveis !== false);
  const [selecaoGrafico, setSelecaoGrafico] = useState(null);
  const contextoGrafico = `${periodo}:${dataSelecionada}:${semanaSelecionada}:${mesSelecionado}:${anoSelecionado}`;
  const selecaoGraficoAtiva = selecaoGrafico?.contexto === contextoGrafico ? selecaoGrafico : null;
  const contextoDashboard = useMemo(() => criarContextoDashboard({
    periodo,
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
    selecaoGrafico: selecaoGraficoAtiva,
    meses: MESES,
  }), [
    periodo,
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
    selecaoGraficoAtiva,
  ]);

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  async function carregarTudo() {
    setCarregando(true);
    await Promise.all([
      carregarContasComSaldo(),
      carregarSaldosPlataformas(),
      carregarDatasComMovimento(),
      carregarMetaAtiva(),
      carregarProximasContas(),
      carregarContasAtrasadas(),
    ]);
    setCarregando(false);
  }

  async function carregarSaldosPlataformas() {
    try {
      const plataformasData = await carregarPlataformasFinanceiras();
      setPlataformasFinanceiras(plataformasData);
      const idsExistentes = plataformasData.map((plataforma) => String(plataforma.id));
      const idsSalvos = carregarPlataformasSelecionadasLocalStorage();
      const selecionadas = idsSalvos === null
        ? idsExistentes
        : idsSalvos.filter((id) => idsExistentes.includes(String(id)));
      setPlataformasSelecionadas(selecionadas);
      if (idsSalvos === null) salvarPlataformasSelecionadasLocalStorage(selecionadas);
    } catch (error) {
      console.error("Erro ao carregar saldos das plataformas no dashboard:", error);
      setPlataformasFinanceiras([]);
    }
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
    limite.setDate(limite.getDate() + 30);
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
      .order("data_vencimento", { ascending: true });

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("id, data_vencimento, data_compra, categoria, descricao, valor_total, status, tipo_movimentacao")
      .eq("tipo_movimentacao", "conta_pagar")
      .gte("data_vencimento", hojeTexto)
      .lte("data_vencimento", limiteTexto)
      .order("data_vencimento", { ascending: true });

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
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));

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
      .order("data_vencimento", { ascending: true });

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("id, data_vencimento, data_compra, categoria, descricao, valor_total, status, tipo_movimentacao")
      .eq("tipo_movimentacao", "conta_pagar")
      .neq("status", "pago")
      .lt("data_vencimento", hojeTexto)
      .order("data_vencimento", { ascending: true });

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
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));

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

    const indicadoresDiarios = calcularIndicadoresDiarios(entradasData);
    resumoBase.diasTrabalhados = indicadoresDiarios.diasTrabalhados;
    resumoBase.maiorFaturamento = indicadoresDiarios.maiorFaturamento;

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
    const { inicio, fim } = contextoDashboard.intervaloBase;
    const { resumoBase, entradasData } = await buscarDadosOperacao(inicio, fim);
    const historicoFaturamento = construirHistoricoFaturamento(
      entradasData,
      contextoDashboard.periodoBase,
      contextoDashboard.filtrosBase,
    );

    const metricasIndicadores = contextoDashboard.temSelecao
      ? (await buscarDadosOperacao(contextoDashboard.inicio, contextoDashboard.fim)).resumoBase
      : resumoBase;
    const metaPeriodo = await calcularMetaPeriodo(
      metaAtiva,
      contextoDashboard.periodo,
      contextoDashboard.filtrosMeta,
    );

    metricasIndicadores.meta = metaPeriodo;
    metricasIndicadores.percentualMeta = metaPeriodo > 0 ? Math.min((metricasIndicadores.faturamento / metaPeriodo) * 100, 999) : 0;
    metricasIndicadores.faltaMeta = Math.max(metaPeriodo - metricasIndicadores.faturamento, 0);
    metricasIndicadores.historicoFaturamento = historicoFaturamento;

    setMetricas(metricasIndicadores);
  }

  async function carregarFinancasPessoais() {
    const { inicio, fim } = contextoDashboard;
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
    } catch {
      return [];
    }
  }

  function salvarContasSelecionadasLocalStorage(ids) {
    localStorage.setItem(CONTAS_DASHBOARD_KEY, JSON.stringify(ids.map(String)));
  }

  function carregarPlataformasSelecionadasLocalStorage() {
    try {
      const valor = localStorage.getItem(PLATAFORMAS_DASHBOARD_KEY);
      return valor === null ? null : JSON.parse(valor).map(String);
    } catch {
      return null;
    }
  }

  function salvarPlataformasSelecionadasLocalStorage(ids) {
    localStorage.setItem(PLATAFORMAS_DASHBOARD_KEY, JSON.stringify(ids.map(String)));
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

  function alternarPlataformaDashboard(plataformaId) {
    setPlataformasSelecionadas((listaAtual) => {
      const id = String(plataformaId);
      const novaLista = listaAtual.includes(id)
        ? listaAtual.filter((item) => item !== id)
        : [...listaAtual, id];
      salvarPlataformasSelecionadasLocalStorage(novaLista);
      return novaLista;
    });
  }

  function aplicarTodosItensSaldo() {
    aplicarTodasContas();
    const todasPlataformas = plataformasFinanceiras.map((plataforma) => String(plataforma.id));
    setPlataformasSelecionadas(todasPlataformas);
    salvarPlataformasSelecionadasLocalStorage(todasPlataformas);
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

  function criarSelecaoGrafico(indice) {
    if (periodo === "semana") {
      const semana = pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada));
      const data = new Date(`${semana.inicio}T12:00:00`);
      data.setDate(data.getDate() + indice);
      const dataSelecionadaGrafico = dataISO(data);
      return {
        chave: `${periodo}-${dataSelecionadaGrafico}`,
        contexto: contextoGrafico,
        indice,
        inicio: dataSelecionadaGrafico,
        fim: dataSelecionadaGrafico,
        periodoMeta: "dia",
        filtrosMeta: { dataSelecionada: dataSelecionadaGrafico },
        rotulo: formatarDataBR(dataSelecionadaGrafico),
      };
    }

    if (periodo === "mes") {
      const dataSelecionadaGrafico = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}-${String(indice + 1).padStart(2, "0")}`;
      return {
        chave: `${periodo}-${dataSelecionadaGrafico}`,
        contexto: contextoGrafico,
        indice,
        inicio: dataSelecionadaGrafico,
        fim: dataSelecionadaGrafico,
        periodoMeta: "dia",
        filtrosMeta: { dataSelecionada: dataSelecionadaGrafico },
        rotulo: formatarDataBR(dataSelecionadaGrafico),
      };
    }

    const mesGrafico = indice + 1;
    const inicio = `${anoSelecionado}-${String(mesGrafico).padStart(2, "0")}-01`;
    const fim = dataISO(new Date(Number(anoSelecionado), mesGrafico, 0));
    return {
      chave: `${periodo}-${anoSelecionado}-${mesGrafico}`,
      contexto: contextoGrafico,
      indice,
      inicio,
      fim,
      periodoMeta: "mes",
      filtrosMeta: { mesSelecionado: String(mesGrafico), anoSelecionado },
      rotulo: `${MESES[mesGrafico - 1]}/${anoSelecionado}`,
    };
  }

  function alternarSelecaoGrafico(_, indice) {
    if (periodo === "dia") return;
    const novaSelecao = criarSelecaoGrafico(indice);
    setSelecaoGrafico((atual) => atual?.chave === novaSelecao.chave ? null : novaSelecao);
  }

  useEffect(() => {
    // Consulta inicial: o estado é atualizado pelas respostas assíncronas do Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarTudo();
    // A carga inicial é intencionalmente executada uma única vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Sincroniza os indicadores com o filtro principal e a seleção rápida do gráfico.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarPerformance();
    // As dependências abaixo representam integralmente as entradas da função de carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextoDashboard, metaAtiva]);

  useEffect(() => {
    // Mantém o card pessoal no mesmo intervalo visual dos demais indicadores.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarFinancasPessoais();
    // O contexto central contém todas as entradas usadas pela função de carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextoDashboard]);

  useEffect(() => {
    salvarPreferenciasDashboardLocalStorage({
      periodo,
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
      valoresFinanceirosVisiveis,
    });
  }, [
    periodo,
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
    valoresFinanceirosVisiveis,
  ]);

  const contasAtivasDashboard = contas.filter((conta) => contasSelecionadas.includes(String(conta.id)));
  const plataformasSaldoConsolidado = plataformasFinanceiras.filter(
    (plataforma) => plataformasSelecionadas.includes(String(plataforma.id)),
  );
  const saldoContas = contasAtivasDashboard.reduce((total, conta) => total + Number(conta.saldo_atual || 0), 0);
  const saldoPlataformas = plataformasSaldoConsolidado.reduce(
    (total, plataforma) => total + Number(plataforma.saldo || 0),
    0,
  );
  const saldoGeral = saldoContas + saldoPlataformas;
  const horasDecimal = metricas.minutosTrabalhados / 60;
  const ganhoPorKm = metricas.km > 0 ? metricas.faturamento / metricas.km : 0;
  const ganhoPorHora = horasDecimal > 0 ? metricas.faturamento / horasDecimal : 0;
  const ganhoPorCorrida = metricas.corridas > 0 ? metricas.faturamento / metricas.corridas : 0;
  const plataformas = Object.values(metricas.plataformas || {}).sort((a, b) => b.valor - a.valor);
  const mediaPorDiaTrabalhado = metricas.diasTrabalhados > 0 ? metricas.faturamento / metricas.diasTrabalhados : 0;
  const mediaHorasPorDia = metricas.diasTrabalhados > 0
    ? metricas.minutosTrabalhados / metricas.diasTrabalhados
    : 0;
  const totalProximasContas = proximasContas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const totalContasAtrasadas = contasAtrasadas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const custoTrabalho = metricas.custos?.trabalho || { total: 0, categorias: [] };
  const resultadoOperacional = metricas.faturamento - Number(custoTrabalho.total || 0);
  const formatarValorFinanceiro = (valor) => valoresFinanceirosVisiveis ? formatarMoeda(valor) : "••••";
  const indicadoresTotais = [
    { titulo: `KM Rodados ${contextoDashboard.complementoTitulo}`, valor: formatarNumero(metricas.km), badge: "Total" },
    { titulo: `Horas Trabalhadas ${contextoDashboard.complementoTitulo}`, valor: formatarHoras(metricas.minutosTrabalhados), badge: "Total" },
    { titulo: `Dias Trabalhados ${contextoDashboard.complementoTitulo}`, valor: formatarNumero(metricas.diasTrabalhados), badge: "Total" },
    { titulo: `Corridas Realizadas ${contextoDashboard.complementoTitulo}`, valor: formatarNumero(metricas.corridas), badge: "Total" },
    { titulo: `Maior Faturamento ${contextoDashboard.complementoTitulo}`, valor: formatarMoeda(metricas.maiorFaturamento), badge: "Total" },
  ];
  const indicadoresMedios = [
    { titulo: `Ganho por KM ${contextoDashboard.complementoTitulo}`, valor: formatarMoeda(ganhoPorKm), badge: "Média" },
    { titulo: `Ganho por Hora ${contextoDashboard.complementoTitulo}`, valor: formatarMoeda(ganhoPorHora), badge: "Média" },
    { titulo: `Ganho por Dia ${contextoDashboard.complementoTitulo}`, valor: formatarMoeda(mediaPorDiaTrabalhado), badge: "Média" },
    { titulo: `Horas Trabalhadas por Dia ${contextoDashboard.complementoTitulo}`, valor: formatarHoras(Math.round(mediaHorasPorDia)), badge: "Média" },
    { titulo: `Ganho por Corrida Realizada ${contextoDashboard.complementoTitulo}`, valor: formatarMoeda(ganhoPorCorrida), badge: "Média" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-10">
      <DashboardAnimations />

      <section className="space-y-4">
        <PeriodoControle
          periodo={periodo}
          setPeriodo={setPeriodo}
          textoPeriodo={contextoDashboard.texto}
          abrirPeriodo={() => setModalPeriodoAberto(true)}
        />

        {carregando ? (
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400">Carregando dashboard...</p>
          </div>
        ) : (
          <>
            {contextoDashboard.periodoBase !== "dia" && (
              <GraficoHistoricoFaturamento
                dados={metricas.historicoFaturamento || []}
                periodo={contextoDashboard.periodoBase}
                periodoLabel={contextoDashboard.texto}
                formatarMoeda={formatarMoeda}
                selecionadoIndex={selecaoGraficoAtiva?.indice ?? null}
                onSelecionar={alternarSelecaoGrafico}
              />
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                <FaturamentoCard
                  titulo={`Faturamento Bruto ${contextoDashboard.complementoTitulo}`}
                  valor={formatarMoeda(metricas.faturamento)}
                />
                <MetaCard
                  metaLabel={`Meta ${contextoDashboard.complementoTitulo}`}
                  metaValor={formatarMoeda(metricas.meta)}
                  percentual={metricas.percentualMeta}
                  faltaMeta={metricas.faltaMeta}
                  formatarMoeda={formatarMoeda}
                />
              </div>

              <div className="space-y-3 md:hidden">
                <div className="grid grid-cols-2 gap-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-gray-500">
                    Indicadores Totais
                  </h3>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-gray-500">
                    Indicadores Médios
                  </h3>
                </div>
                {indicadoresTotais.map((indicadorTotal, indice) => (
                  <div key={indicadorTotal.titulo} className="grid grid-cols-2 gap-3 items-stretch">
                    <MetricCard {...indicadorTotal} />
                    <MetricCard {...indicadoresMedios[indice]} />
                  </div>
                ))}
              </div>

              <div className="hidden md:block space-y-5">
                <section className="space-y-3" aria-labelledby="indicadores-totais-titulo">
                  <div className="flex items-center gap-3">
                    <h3 id="indicadores-totais-titulo" className="text-xs font-black uppercase tracking-[0.16em] text-gray-500 whitespace-nowrap">
                      Indicadores Totais
                    </h3>
                    <div className="h-px flex-1 border-t border-dashed border-gray-800" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-5 gap-3 items-stretch">
                    {indicadoresTotais.map((indicador) => <MetricCard key={indicador.titulo} {...indicador} />)}
                  </div>
                </section>

                <section className="space-y-3" aria-labelledby="indicadores-medios-titulo">
                  <div className="flex items-center gap-3">
                    <h3 id="indicadores-medios-titulo" className="text-xs font-black uppercase tracking-[0.16em] text-gray-500 whitespace-nowrap">
                      Indicadores Médios
                    </h3>
                    <div className="h-px flex-1 border-t border-dashed border-gray-800" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-5 gap-3 items-stretch">
                    {indicadoresMedios.map((indicador) => <MetricCard key={indicador.titulo} {...indicador} />)}
                  </div>
                </section>
              </div>
            </div>

            <PlataformasCard plataformas={plataformas} total={metricas.faturamento} formatarMoeda={formatarMoeda} />
          </>
        )}
      </section>

      {!carregando && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 xl:auto-rows-fr gap-4 xl:items-stretch">
            <CustosCategoriaCard
              titulo="Custos do Trabalho"
              dados={custoTrabalho}
              baseComparacao={metricas.faturamento}
              labelBase="do faturamento"
              rateio={metricas.rateioUsoVeiculo}
              abrirRateio={() => {
                setTipoRateioModal("trabalho");
                setModalRateioAberto(true);
              }}
              formatarMoeda={formatarMoeda}
              tema="trabalho"
              indicadores={[
                { titulo: "Faturamento Bruto", valor: metricas.faturamento, destaque: "text-green-400" },
                { titulo: "Custos do Trabalho", valor: custoTrabalho.total, destaque: "text-red-400" },
                { titulo: "Resultado Operacional", valor: resultadoOperacional, destaque: resultadoOperacional >= 0 ? "text-green-400" : "text-red-400" },
              ]}
            />

            <CustosCategoriaCard
              titulo="Custos Pessoais"
              dados={metricasPessoais.custos}
              baseComparacao={metricasPessoais.entradas}
              labelBase="das entradas pessoais"
              rateio={metricasPessoais.rateioUsoVeiculo}
              abrirRateio={() => {
                setTipoRateioModal("pessoal");
                setModalRateioAberto(true);
              }}
              formatarMoeda={formatarMoeda}
              tema="pessoal"
              indicadores={[
                { titulo: "Entradas Pessoais", valor: metricasPessoais.entradas, destaque: "text-purple-300" },
                { titulo: "Custos Pessoais", valor: metricasPessoais.custos.total, destaque: "text-red-400" },
                { titulo: "Resultado Pessoal", valor: metricasPessoais.resultado, destaque: metricasPessoais.resultado >= 0 ? "text-purple-300" : "text-red-400" },
              ]}
            />
          </div>
        </section>
      )}

      {!carregando && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setValoresFinanceirosVisiveis((valor) => !valor)}
              className="w-10 h-10 rounded-xl border border-gray-700 hover:border-green-400 hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-green-400 transition shrink-0"
              title={valoresFinanceirosVisiveis ? "Ocultar valores" : "Mostrar valores"}
              aria-label={valoresFinanceirosVisiveis ? "Ocultar valores" : "Mostrar valores"}
            >
              {valoresFinanceirosVisiveis ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
            <SaldoGeralCard
              saldoGeral={saldoGeral}
              contas={contasAtivasDashboard}
              plataformas={plataformasSaldoConsolidado}
              quantidadePlataformasSaldo={plataformasSaldoConsolidado.length}
              abrirConfiguracao={() => setModalContasAberto(true)}
              abrirPagina={() => navegarPara?.("contas")}
              formatarMoeda={formatarValorFinanceiro}
            />
            <ContasAtrasadasCard
              contas={contasAtrasadas}
              total={totalContasAtrasadas}
              abrirPagina={() => navegarPara?.("contas-pagar")}
              formatarMoeda={formatarValorFinanceiro}
              formatarDataBR={formatarDataBR}
            />
            <ProximasContasCard
              contas={proximasContas}
              abrirPagina={() => navegarPara?.("contas-pagar")}
              formatarMoeda={formatarValorFinanceiro}
              formatarDataBR={formatarDataBR}
              total={totalProximasContas}
            />
          </div>
        </section>
      )}

      {modalRateioAberto && (
        <ModalRateioDashboard
          rateio={tipoRateioModal === "pessoal" ? metricasPessoais.rateioUsoVeiculo : metricas.rateioUsoVeiculo}
          fechar={() => setModalRateioAberto(false)}
        />
      )}

      {modalContasAberto && (
        <ModalContasDashboard
          contas={contas}
          contasSelecionadas={contasSelecionadas}
          plataformas={plataformasFinanceiras}
          plataformasSelecionadas={plataformasSelecionadas}
          alternarConta={alternarContaDashboard}
          alternarPlataforma={alternarPlataformaDashboard}
          selecionarTodas={aplicarTodosItensSaldo}
          fechar={() => setModalContasAberto(false)}
          formatarMoeda={formatarMoeda}
        />
      )}

      {modalPeriodoAberto && (
        <ModalPeriodo
          periodo={periodo}
          setPeriodo={setPeriodo}
          meses={MESES}
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
          meses={MESES}
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
