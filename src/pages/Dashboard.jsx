import { useEffect, useMemo, useState } from "react";
import { FiSettings } from "react-icons/fi";
import { supabase } from "../services/supabase";

import uberLogo from "../assets/plataformas/uber.png";
import logo99 from "../assets/plataformas/99.png";
import ifoodLogo from "../assets/plataformas/ifood.svg";
import indriveLogo from "../assets/plataformas/indrive.svg";
import lalamoveLogo from "../assets/plataformas/lalamove.svg";
import mercadoLivreLogo from "../assets/plataformas/mercadolivre.png";
import rappiLogo from "../assets/plataformas/rappi.png";
import shopeeLogo from "../assets/plataformas/shopee.svg";

const CONTAS_DASHBOARD_KEY = "controldriver_dashboard_contas_ativas_v1";

export default function Dashboard() {
  const hoje = new Date();
  const hojeISO = dataISO(hoje);

  const [periodo, setPeriodo] = useState("dia");
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO);
  const [semanaSelecionada, setSemanaSelecionada] = useState(getSemanaDoAno(hoje));
  const [mesSelecionado, setMesSelecionado] = useState(String(hoje.getMonth() + 1));
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalContasAberto, setModalContasAberto] = useState(false);
  const [modalProximasContasAberto, setModalProximasContasAberto] = useState(false);
  const [diasProximasContas, setDiasProximasContas] = useState(30);
  const [modalAnoAberto, setModalAnoAberto] = useState(false);
  const [modalMesAnoAberto, setModalMesAnoAberto] = useState(false);
  const [etapaMesAno, setEtapaMesAno] = useState("ano");

  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState([]);
  const [contasSelecionadas, setContasSelecionadas] = useState([]);
  const [datasComMovimento, setDatasComMovimento] = useState([]);
  const [metaAtiva, setMetaAtiva] = useState(null);
  const [metricas, setMetricas] = useState(criarMetricasVazias());
  const [proximasContas, setProximasContas] = useState([]);

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
    carregarProximasContas();
  }, [diasProximasContas]);

  async function carregarTudo() {
    setCarregando(true);
    await Promise.all([
      carregarContasComSaldo(),
      carregarDatasComMovimento(),
      carregarMetaAtiva(),
      carregarProximasContas(),
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
    const { data: saidasData } = await supabase.from("saidas").select("data_compra");

    const datas = [
      ...(entradasData || []).map((item) => item.data),
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
    limite.setDate(limite.getDate() + Number(diasProximasContas || 30));
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
          final_cartao
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .gte("data_vencimento", hojeTexto)
      .lte("data_vencimento", limiteTexto)
      .order("data_vencimento", { ascending: true })
      .limit(8);

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("id, data_vencimento, data_compra, categoria, descricao, valor_total, status, tipo_movimentacao")
      .eq("tipo_movimentacao", "conta_pagar")
      .gte("data_vencimento", hojeTexto)
      .lte("data_vencimento", limiteTexto)
      .order("data_vencimento", { ascending: true })
      .limit(8);

    const faturas = (faturasData || []).map((fatura) => ({
      id: `fatura-${fatura.id}`,
      tipo: "Fatura",
      titulo: fatura.cartoes?.nome || "Cartão",
      subtitulo: fatura.cartoes?.final_cartao ? `Final ${fatura.cartoes.final_cartao}` : "Cartão de crédito",
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
      .slice(0, 6);

    setProximasContas(lista);
  }

  async function carregarPerformance() {
    const { inicio, fim } = intervaloDatas();

    const [entradasRes, saidasRes] = await Promise.all([
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
        .select("id, data_compra, categoria, valor_total, tipo_movimentacao")
        .neq("tipo_movimentacao", "conta_pagar")
        .gte("data_compra", inicio)
        .lte("data_compra", fim),
    ]);

    const entradasData = entradasRes.data || [];
    const saidasData = saidasRes.data || [];

    const resumo = entradasData.reduce((acc, entrada) => {
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

    saidasData.forEach((saida) => {
      if (!ehGastoOperacional(saida)) return;

      const categoria = normalizarCategoriaOperacional(saida.categoria);
      const valor = Number(saida.valor_total || 0);

      resumo.gastosTotal += valor;

      if (!resumo.gastosPorCategoria[categoria]) {
        resumo.gastosPorCategoria[categoria] = { nome: categoria, valor: 0 };
      }

      resumo.gastosPorCategoria[categoria].valor += valor;
    });

    const metaPeriodo = calcularMetaPeriodo(metaAtiva, periodo, {
      dataSelecionada,
      semanaSelecionada,
      mesSelecionado,
      anoSelecionado,
    });

    resumo.meta = metaPeriodo;
    resumo.percentualMeta = metaPeriodo > 0 ? Math.min((resumo.faturamento / metaPeriodo) * 100, 999) : 0;
    resumo.faltaMeta = Math.max(metaPeriodo - resumo.faturamento, 0);

    setMetricas(resumo);
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
    if (periodo === "dia") return { inicio: dataSelecionada, fim: dataSelecionada };

    if (periodo === "semana") {
      return pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada));
    }

    if (periodo === "mes") {
      const inicio = new Date(Number(anoSelecionado), Number(mesSelecionado) - 1, 1);
      const fim = new Date(Number(anoSelecionado), Number(mesSelecionado), 0);
      return { inicio: dataISO(inicio), fim: dataISO(fim) };
    }

    return { inicio: `${anoSelecionado}-01-01`, fim: `${anoSelecionado}-12-31` };
  }

  function textoPeriodoSelecionado() {
    if (periodo === "dia") return formatarDataBR(dataSelecionada);

    if (periodo === "semana") {
      const semana = pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada));
      return `${semanaSelecionada}ª Semana • ${formatarDataBR(semana.inicio)} à ${formatarDataBR(semana.fim)}`;
    }

    if (periodo === "mes") return `${meses[Number(mesSelecionado) - 1]} / ${anoSelecionado}`;

    return String(anoSelecionado);
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
  const gastos = Object.values(metricas.gastosPorCategoria || {}).sort((a, b) => b.valor - a.valor);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-2">Visão rápida da sua operação.</p>
      </div>

      {carregando ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando dashboard...</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="relative bg-green-500 border border-green-400 rounded-3xl p-6 sm:p-7 text-white overflow-hidden">
              <button
                type="button"
                onClick={() => setModalContasAberto(true)}
                className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-black/10 border border-white/20 hover:bg-black/20 flex items-center justify-center text-white/90 transition"
                title="Configurar contas exibidas"
                aria-label="Configurar contas exibidas"
              >
                <FiSettings />
              </button>

              <div className="pr-12">
                <p className="text-sm font-black uppercase tracking-wide text-white/80">Saldo Atual Geral</p>
                <h2 className="text-4xl sm:text-5xl font-black mt-2">{formatarMoeda(saldoGeral)}</h2>
                <p className="text-sm text-white/80 mt-3">
                  {contasAtivasDashboard.length} conta(s) incluída(s) neste saldo.
                </p>
              </div>

              <div className="mt-5 divide-y divide-white/15">
                {contasAtivasDashboard.slice(0, 6).map((conta) => (
                  <div key={conta.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/85 truncate">{conta.nome}</span>
                    <span className="text-white/90 whitespace-nowrap">{formatarMoeda(conta.saldo_atual)}</span>
                  </div>
                ))}

                {contasAtivasDashboard.length === 0 && (
                  <p className="text-sm text-white/80 py-2">Nenhuma conta selecionada.</p>
                )}
              </div>
            </div>

            <ProximasContasCard
              contas={proximasContas}
              dias={diasProximasContas}
              abrirConfiguracao={() => setModalProximasContasAberto(true)}
              formatarMoeda={formatarMoeda}
              formatarDataBR={formatarDataBR}
            />
          </section>

          <section>
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Performance</h2>
                <p className="text-gray-400 text-sm mt-1">Filtros aplicados em faturamento, meta, plataformas e gastos.</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="grid grid-cols-4 gap-2">
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
                      className={`px-3 py-2 rounded-xl border text-sm font-black transition ${
                        periodo === valor
                          ? "border-green-400 bg-green-500/10 text-green-400"
                          : "border-gray-700 text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setModalPeriodoAberto(true)}
                  className="bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl px-4 py-3 text-gray-200 font-semibold text-left"
                >
                  {textoPeriodoSelecionado()}
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 sm:p-6">
                <p className="text-sm text-gray-400">Faturamento bruto</p>
                <h3 className="text-4xl sm:text-5xl font-black mt-2 text-white">{formatarMoeda(metricas.faturamento)}</h3>

                <div className="mt-6">
                  <div className="text-sm mb-2">
                    <span className="text-gray-400">Meta {textoMetaPeriodo(periodo)}: </span>
                    <span className="text-white font-semibold">{formatarMoeda(metricas.meta)}</span>
                  </div>

                  <div className="h-4 rounded-full bg-[#0B1120] overflow-hidden border border-gray-800">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(metricas.percentualMeta || 0, 100)}%` }}
                    />
                  </div>

                  <p className="text-xs sm:text-sm mt-2 text-gray-400 text-right font-normal">
                    {metricas.meta <= 0
                      ? "Nenhuma meta ativa encontrada."
                      : metricas.faltaMeta > 0
                      ? `${Math.round(metricas.percentualMeta || 0)}% concluído / Falta ${formatarMoeda(metricas.faltaMeta)} para concluir.`
                      : `${Math.round(metricas.percentualMeta || 0)}% concluído / Meta batida.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricCard titulo="KM Rodados" valor={formatarNumero(metricas.km)} />
                <MetricCard titulo="Horas" valor={formatarHoras(metricas.minutosTrabalhados)} />
                <MetricCard titulo="Corridas" valor={formatarNumero(metricas.corridas)} />
                <MetricCard titulo="Ganho/KM" valor={formatarMoeda(ganhoPorKm)} />
                <MetricCard titulo="Ganho/Hora" valor={formatarMoeda(ganhoPorHora)} />
                <MetricCard titulo="Ganho/Corrida" valor={formatarMoeda(ganhoPorCorrida)} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <PlataformasCard plataformas={plataformas} total={metricas.faturamento} formatarMoeda={formatarMoeda} />
              <GastosCard gastos={gastos} total={metricas.gastosTotal} formatarMoeda={formatarMoeda} />
            </div>
          </section>
        </>
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

      {modalProximasContasAberto && (
        <ModalProximasContas
          dias={diasProximasContas}
          setDias={setDiasProximasContas}
          fechar={() => setModalProximasContasAberto(false)}
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

function criarMetricasVazias() {
  return {
    faturamento: 0,
    km: 0,
    corridas: 0,
    minutosTrabalhados: 0,
    plataformas: {},
    gastosPorCategoria: {},
    gastosTotal: 0,
    meta: 0,
    percentualMeta: 0,
    faltaMeta: 0,
  };
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

function calcularMetaPeriodo(meta, periodo, filtros) {
  if (!meta) return 0;

  const metas = calcularMetas(meta);

  if (periodo === "dia") return metas.diaria;
  if (periodo === "semana") return metas.semanal;
  if (periodo === "mes") return metas.mensal;
  if (periodo === "ano") return metas.anual;

  return 0;
}

function calcularMetas(meta) {
  if (!meta) return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };

  const inicio = dataInicioMeta(meta);
  const fimMes = dataFimMesDaMeta(meta);
  const diasTrabalho = diasTrabalhoValidos(meta).length || 1;
  const diasPeriodoMes = Math.max(diferencaDias(inicio, fimMes), 1);
  const semanasPeriodoMes = Math.max(diasPeriodoMes / 7, 1);
  const mediaDiasPorSemana = Math.max(diasTrabalho / semanasPeriodoMes, 1);
  const valor = Number(meta.valor_base || 0);
  const mesesAno = mesesRestantesAno(meta);

  if (meta.tipo === "diaria") {
    const diaria = valor;
    return {
      diaria,
      semanal: diaria * mediaDiasPorSemana,
      mensal: diaria * diasTrabalho,
      anual: diaria * diasTrabalho * mesesAno,
    };
  }

  if (meta.tipo === "semanal") {
    const semanal = valor;
    const diaria = semanal / mediaDiasPorSemana;
    const mensal = diaria * diasTrabalho;
    return { diaria, semanal, mensal, anual: mensal * mesesAno };
  }

  if (meta.tipo === "anual") {
    const anual = valor;
    const mensal = anual / mesesAno;
    return {
      diaria: mensal / diasTrabalho,
      semanal: mensal / semanasPeriodoMes,
      mensal,
      anual,
    };
  }

  const mensal = valor;
  return {
    diaria: mensal / diasTrabalho,
    semanal: mensal / semanasPeriodoMes,
    mensal,
    anual: mensal * mesesAno,
  };
}

function dataInicioMeta(meta) {
  if (meta?.data_inicio) return meta.data_inicio;
  const ano = Number(meta?.ano || new Date().getFullYear());
  const mes = Number(meta?.mes || new Date().getMonth() + 1);
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

function dataFimMesDaMeta(meta) {
  const ano = Number(meta?.ano || new Date().getFullYear());
  const mes = Number(meta?.mes || new Date().getMonth() + 1);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function diferencaDias(inicioISO, fimISO) {
  const inicio = new Date(`${inicioISO}T00:00:00`);
  const fim = new Date(`${fimISO}T00:00:00`);
  return Math.max(Math.floor((fim - inicio) / 86400000) + 1, 0);
}

function mesesRestantesAno(meta) {
  const inicio = new Date(`${dataInicioMeta(meta)}T00:00:00`);
  return Math.max(12 - inicio.getMonth(), 1);
}

function diasTrabalhoValidos(meta) {
  const dias = meta?.dias_trabalho || [];
  const inicio = new Date(`${dataInicioMeta(meta)}T00:00:00`);
  const mesInicio = inicio.getMonth() + 1;
  const anoInicio = inicio.getFullYear();

  if (Number(meta?.mes) !== mesInicio || Number(meta?.ano) !== anoInicio) return dias;
  return dias.filter((dia) => Number(dia) >= inicio.getDate());
}

function ehGastoOperacional(saida) {
  const categoria = String(saida?.categoria || "").toLowerCase();
  const tipo = String(saida?.tipo_movimentacao || "").toLowerCase();

  if (tipo === "conta_pagar") return false;
  if (categoria.includes("pagamento de fatura")) return false;
  if (categoria.includes("transfer")) return false;

  const categoriasOperacionais = [
    "abastecimento",
    "combustível",
    "combustivel",
    "manutenção",
    "manutencao",
    "pedágio",
    "pedagio",
    "tag",
    "estacionamento",
    "alimentação",
    "alimentacao",
    "impostos",
    "recarga elétrica",
    "recarga eletrica",
  ];

  return categoriasOperacionais.some((item) => categoria.includes(item));
}

function normalizarCategoriaOperacional(categoria) {
  const texto = String(categoria || "Outros").trim();
  const minusculo = texto.toLowerCase();

  if (minusculo.includes("abaste") || minusculo.includes("combust")) return "Combustível";
  if (minusculo.includes("manuten")) return "Manutenção";
  if (minusculo.includes("pedágio") || minusculo.includes("pedagio") || minusculo.includes("tag")) return "Pedágios/TAG";
  if (minusculo.includes("estacion")) return "Estacionamento";
  if (minusculo.includes("aliment")) return "Alimentação";
  if (minusculo.includes("imposto")) return "Impostos";
  if (minusculo.includes("recarga")) return "Recarga elétrica";

  return texto || "Outros";
}

function textoMetaPeriodo(periodo) {
  const mapa = {
    dia: "do dia",
    semana: "da semana",
    mes: "do mês",
    ano: "do ano",
  };

  return mapa[periodo] || "do período";
}

function MetricCard({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 min-w-0">
      <p className="text-xs text-gray-400">{titulo}</p>
      <h3 className="text-xl font-black mt-2 truncate">{valor}</h3>
    </div>
  );
}

function ProximasContasCard({ contas, dias, abrirConfiguracao, formatarMoeda, formatarDataBR }) {
  const total = contas.reduce((soma, item) => soma + Number(item.valor || 0), 0);

  return (
    <div className="relative bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <button
        type="button"
        onClick={abrirConfiguracao}
        className="absolute right-4 top-4 w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="Configurar próximas contas"
        aria-label="Configurar próximas contas"
      >
        <FiSettings />
      </button>

      <div className="pr-12">
        <p className="text-sm text-gray-400">Próximas contas a pagar</p>
        <h3 className="text-3xl font-black mt-1">{formatarMoeda(total)}</h3>
        <p className="text-xs text-gray-500 mt-1">Vencimentos dos próximos {dias} dias.</p>
      </div>

      <div className="mt-4 divide-y divide-gray-800">
        {contas.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">Nenhuma conta próxima encontrada.</p>
        ) : (
          contas.map((conta) => (
            <div key={conta.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{conta.titulo}</p>
                <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wide">
                  {conta.tipo === "Fatura" ? "Cartão de crédito" : "Conta a pagar"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
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
      <p className="text-gray-400 text-sm mt-1">Participação no faturamento do período.</p>

      <div className="mt-5 space-y-4">
        {plataformas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma plataforma no período.</p>
        ) : (
          plataformas.map((item) => {
            const percentual = total > 0 ? (item.valor / total) * 100 : 0;
            return (
              <div key={item.nome}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <PlataformaLogo nome={item.nome} />
                    <span className="font-bold truncate">{item.nome}</span>
                  </span>
                  <span className="font-black whitespace-nowrap">{formatarMoeda(item.valor)}</span>
                </div>
                <div className="mt-2 h-3 bg-[#0B1120] rounded-full overflow-hidden border border-gray-800">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(percentual, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(percentual)}% • {item.corridas} corrida(s)
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PlataformaLogo({ nome }) {
  const logo = pegarLogoPlataforma(nome);

  return (
    <span className="w-9 h-9 rounded-xl bg-[#0B1120] border border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
      {logo ? (
        <img src={logo} alt={nome || "Plataforma"} className="w-6 h-6 object-contain" />
      ) : (
        <span className="text-xs font-black text-gray-300">{iniciaisPlataforma(nome)}</span>
      )}
    </span>
  );
}

function pegarLogoPlataforma(nome) {
  const texto = String(nome || "").toLowerCase();

  if (texto.includes("uber")) return uberLogo;
  if (texto.includes("99")) return logo99;
  if (texto.includes("ifood") || texto.includes("i food")) return ifoodLogo;
  if (texto.includes("indrive") || texto.includes("in drive")) return indriveLogo;
  if (texto.includes("lalamove")) return lalamoveLogo;
  if (texto.includes("mercado")) return mercadoLivreLogo;
  if (texto.includes("rappi")) return rappiLogo;
  if (texto.includes("shopee")) return shopeeLogo;

  return null;
}

function iniciaisPlataforma(nome) {
  const texto = String(nome || "").trim();
  if (!texto) return "•";
  return texto
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}


function GastosCard({ gastos, total, formatarMoeda }) {
  const top = gastos.slice(0, 5);
  const gradiente = montarGradienteDonut(top, total);

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5">
      <h3 className="text-xl font-bold">Gastos da operação</h3>
      <p className="text-gray-400 text-sm mt-1">Visão aproximada dos gastos ligados ao trabalho. Não inclui faturas em aberto nem pagamento de fatura.</p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-5 items-center">
        <div className="mx-auto w-36 h-36 rounded-full flex items-center justify-center" style={{ background: gradiente }}>
          <div className="w-24 h-24 rounded-full bg-[#111827] border border-gray-800 flex flex-col items-center justify-center text-center px-2">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-sm font-black">{formatarMoeda(total)}</span>
          </div>
        </div>

        <div className="space-y-3">
          {top.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum gasto no período.</p>
          ) : (
            top.map((item, index) => {
              const percentual = total > 0 ? (item.valor / total) * 100 : 0;
              return (
                <div key={item.nome} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full ${corBolinha(index)}`} />
                    <span className="text-sm font-bold truncate">{item.nome}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black">{formatarMoeda(item.valor)}</p>
                    <p className="text-xs text-gray-500">{Math.round(percentual)}%</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function montarGradienteDonut(items, total) {
  if (!items.length || total <= 0) return "conic-gradient(#1f2937 0deg, #1f2937 360deg)";

  const cores = ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#a855f7"];
  let inicio = 0;
  const partes = items.map((item, index) => {
    const graus = (Number(item.valor || 0) / total) * 360;
    const fim = inicio + graus;
    const parte = `${cores[index % cores.length]} ${inicio}deg ${fim}deg`;
    inicio = fim;
    return parte;
  });

  if (inicio < 360) partes.push(`#1f2937 ${inicio}deg 360deg`);
  return `conic-gradient(${partes.join(", ")})`;
}

function corBolinha(index) {
  const cores = ["bg-green-500", "bg-yellow-500", "bg-red-500", "bg-blue-500", "bg-purple-500"];
  return cores[index % cores.length];
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

function ModalProximasContas({ dias, setDias, fechar }) {
  const opcoes = [7, 15, 30, 60, 90];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Próximas contas</h2>
            <p className="text-gray-400 text-sm mt-2">Escolha o período de vencimentos que aparece no Dashboard.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black">
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {opcoes.map((opcao) => {
            const ativo = Number(dias) === opcao;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => setDias(opcao)}
                className={`rounded-xl border p-4 font-black transition ${
                  ativo
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {opcao} dias
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
