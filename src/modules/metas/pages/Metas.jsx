import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiClock, FiDollarSign } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import { distribuirSaldoMensalRestante } from "../utils/metasCalculos";
import MetaModal from "../components/MetaModal";

const TIPOS_META = ["diaria", "semanal", "mensal", "anual"];
const DIAS_SEMANA = [
  { valor: 1, curto: "Seg", nome: "Segunda" },
  { valor: 2, curto: "Ter", nome: "Terça" },
  { valor: 3, curto: "Qua", nome: "Quarta" },
  { valor: 4, curto: "Qui", nome: "Quinta" },
  { valor: 5, curto: "Sex", nome: "Sexta" },
  { valor: 6, curto: "Sáb", nome: "Sábado" },
  { valor: 0, curto: "Dom", nome: "Domingo" },
];

function dataISOApp(date = new Date()) {
  if (typeof date === "string") return date.split("T")[0];
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function Metas() {
  const hoje = new Date();
  const hojeISO = dataISOApp(hoje);

  const [metas, setMetas] = useState([]);
  const [metaAtiva, setMetaAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [realizado, setRealizado] = useState({ dia: 0, semana: 0, mes: 0, ano: 0 });
  const [metaHoje, setMetaHoje] = useState(0);
  const [mediaGanhosHora, setMediaGanhosHora] = useState(null);
  const [resumoPeriodoMeta, setResumoPeriodoMeta] = useState(null);
  const [distribuicaoDiasMeta, setDistribuicaoDiasMeta] = useState([]);

  useEffect(() => {
    carregarMetas();
    carregarMediaGanhosHora();
  }, []);

  useEffect(() => {
    if (metaAtiva) carregarRealizado(metaAtiva);
  }, [metaAtiva]);

  const metasCalculadas = useMemo(() => {
    if (!metaAtiva) return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };
    return calcularMetasPlanejadas(metaAtiva, hojeISO);
  }, [metaAtiva, hojeISO]);

  const horasNecessariasHoje = mediaGanhosHora > 0 && metaHoje > 0 ? metaHoje / mediaGanhosHora : 0;
  const cardsVisiveis = cardsPorTipoMeta(metaAtiva?.tipo);

  async function carregarMetas() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("metas")
      .select("*")
      .order("tipo", { ascending: true });

    if (error) {
      console.error(error);
      setMetas([]);
      setMetaAtiva(null);
      setCarregando(false);
      return;
    }

    const lista = (data || []).filter((meta) => TIPOS_META.includes(meta.tipo));
    setMetas(lista);
    setMetaAtiva(lista.find((meta) => meta.ativa) || null);
    setCarregando(false);
  }

  async function carregarMediaGanhosHora() {
    const { data, error } = await supabase
      .from("entradas")
      .select(`
        id,
        horas_trabalhadas,
        entrada_plataformas (
          faturamento,
          valor_reembolso
        )
      `);

    if (error) {
      console.error("Erro ao carregar média por hora:", error);
      setMediaGanhosHora(null);
      return;
    }

    const resumo = (data || []).reduce(
      (acc, entrada) => {
        const totalEntrada = (entrada.entrada_plataformas || []).reduce(
          (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
          0
        );

        acc.faturamento += totalEntrada;
        acc.minutos += intervalParaMinutos(entrada.horas_trabalhadas);
        return acc;
      },
      { faturamento: 0, minutos: 0 }
    );

    const horas = resumo.minutos / 60;
    setMediaGanhosHora(horas > 0 && resumo.faturamento > 0 ? resumo.faturamento / horas : null);
  }

  async function carregarRealizado(meta) {
    const hojeTexto = dataISOApp(new Date());
    const semana = intervaloSemana(hojeTexto);
    const mes = intervaloMes(hojeTexto);
    const ano = intervaloAnoMeta(meta, hojeTexto);

    const [diaData, semanaData, mesData, anoData] = await Promise.all([
      buscarTotalEntradas(hojeTexto, hojeTexto),
      buscarTotalEntradas(maiorData(semana.inicio, meta.data_inicio || semana.inicio), semana.fim),
      buscarTotalEntradas(maiorData(mes.inicio, meta.data_inicio || mes.inicio), mes.fim),
      buscarTotalEntradas(ano.inicio, ano.fim),
    ]);

    const realizadoManual = Number(meta.valor_realizado_antes || 0);
    const extraManual = await calcularExtraManualRealizado(meta, hojeTexto, realizadoManual);

    setRealizado({
      dia: diaData,
      semana: semanaData + (meta.tipo === "semanal" ? extraManual : 0),
      mes: mesData + (meta.tipo === "mensal" ? extraManual : 0),
      ano: anoData + (meta.tipo === "anual" ? extraManual : 0),
    });

    const necessariaHoje = await calcularMetaNecessariaHoje(meta, hojeTexto);
    setMetaHoje(necessariaHoje);

    const plano = await montarDistribuicaoDiasMeta(meta, hojeTexto);
    setResumoPeriodoMeta(plano.resumo);
    setDistribuicaoDiasMeta(plano.dias);
  }

  async function buscarTotalEntradas(inicio, fim) {
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
      console.error(error);
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



  async function buscarFaturamentoPeriodoDetalhado(inicio, fim) {
    if (!inicio || !fim || inicio > fim) return { total: 0, porData: {} };

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
      console.error("Erro ao buscar faturamento do período:", error);
      return { total: 0, porData: {} };
    }

    return (data || []).reduce(
      (acc, entrada) => {
        const totalEntrada = (entrada.entrada_plataformas || []).reduce(
          (soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
          0
        );

        if (totalEntrada > 0 && entrada.data) {
          acc.total += totalEntrada;
          acc.porData[entrada.data] = Number(acc.porData[entrada.data] || 0) + totalEntrada;
        }

        return acc;
      },
      { total: 0, porData: {} }
    );
  }

  async function calcularMetaNecessariaHoje(meta, hojeTexto) {
    if (!meta) return 0;
    const valor = Number(meta.valor_base || 0);
    if (valor <= 0) return 0;
    if (meta.tipo === "diaria") return valor;

    const periodo = periodoBaseMeta(meta, hojeTexto);
    const inicioCalculo = meta.tipo === "anual" ? periodo.inicio : maiorData(periodo.inicio, meta.data_inicio || periodo.inicio);
    const ontem = adicionarDiasISO(hojeTexto, -1);
    const realizadoAntesHoje = inicioCalculo <= ontem ? await buscarTotalEntradas(inicioCalculo, ontem) : 0;
    const realizadoManual = Number(meta.valor_realizado_antes || 0);
    const extraManual = Math.max(realizadoManual - realizadoAntesHoje, 0);
    const restante = Math.max(valor - realizadoAntesHoje - extraManual, 0);
    const diasRestantes = diasTrabalhoNoPeriodo(meta, hojeTexto, periodo.fim);

    return diasRestantes.length > 0 ? restante / diasRestantes.length : restante;
  }

  async function calcularExtraManualRealizado(meta, hojeTexto, realizadoManual) {
    if (!meta || meta.tipo === "diaria" || !realizadoManual) return 0;

    const periodo = periodoBaseMeta(meta, hojeTexto);
    const inicioCalculo = meta.tipo === "anual" ? periodo.inicio : maiorData(periodo.inicio, meta.data_inicio || periodo.inicio);
    const ontem = adicionarDiasISO(hojeTexto, -1);
    const realizadoAntesHoje = inicioCalculo <= ontem ? await buscarTotalEntradas(inicioCalculo, ontem) : 0;

    return Math.max(realizadoManual - realizadoAntesHoje, 0);
  }

  async function montarDistribuicaoDiasMeta(meta, hojeTexto) {
    if (!meta || meta.tipo === "diaria") return { resumo: null, dias: [] };

    const valor = Number(meta.valor_base || 0);
    const periodo = periodoBaseMeta(meta, hojeTexto);
    const inicioCalculo = periodo.inicio;
    const diasTrabalho = diasTrabalhoNoPeriodo(meta, inicioCalculo, periodo.fim);

    if (!diasTrabalho.length || valor <= 0) {
      return {
        resumo: { meta: valor, realizado: 0, falta: valor, diasTrabalho: 0, mediaDia: 0 },
        dias: [],
      };
    }

    const detalhado = await buscarFaturamentoPeriodoDetalhado(inicioCalculo, periodo.fim);
    const porData = detalhado.porData || {};
    const realizadoAntesHoje = somarValoresPorData(porData, (data) => data < hojeTexto);
    const realizadoManual = Number(meta.valor_realizado_antes || 0);
    const extraManual = Math.max(realizadoManual - realizadoAntesHoje, 0);
    const realizadoPeriodo = Number(detalhado.total || 0) + extraManual;

    const diasRestantesHoje = diasTrabalho.filter((data) => data >= hojeTexto);
    const restanteHoje = Math.max(valor - realizadoAntesHoje - extraManual, 0);
    const valorNecessarioHoje = diasRestantesHoje.length ? restanteHoje / diasRestantesHoje.length : 0;
    const distribuicaoRestante = distribuirSaldoMensalRestante(restanteHoje, diasRestantesHoje.length);
    const metasRestantes = new Map(diasRestantesHoje.map((data, index) => [data, distribuicaoRestante[index]]));

    const dias = diasTrabalho.map((data, index) => {
      const realizadoDia = Number(porData[data] || 0);
      const passado = data < hojeTexto;
      const hoje = data === hojeTexto;
      const realizadoAntesDaData = somarValoresPorData(porData, (itemData) => itemData < data) + extraManual;
      const diasRestantesDaData = diasTrabalho.slice(index).length;
      const metaDia = data >= hojeTexto
        ? Number(metasRestantes.get(data) || 0)
        : diasRestantesDaData > 0
          ? Math.max(valor - realizadoAntesDaData, 0) / diasRestantesDaData
          : 0;

      return {
        data,
        mesChave: String(data).slice(0, 7),
        mesRotulo: rotuloMesAno(data),
        rotulo: rotuloDiaMeta(data, meta.tipo),
        subtitulo: formatarDataBR(data),
        realizado: realizadoDia,
        meta: metaDia,
        falta: Math.max(metaDia - realizadoDia, 0),
        status: passado ? "passado" : hoje ? "hoje" : "futuro",
      };
    });

    return {
      resumo: {
        meta: valor,
        realizado: realizadoPeriodo,
        falta: Math.max(valor - realizadoPeriodo, 0),
        diasTrabalho: diasTrabalho.length,
        mediaDia: valorNecessarioHoje,
      },
      dias,
    };
  }

  async function salvarMeta(payload) {
    const dataInicio = payload.tipo === "diaria" ? dataISOApp(new Date()) : (payload.data_inicio || dataISOApp(new Date()));
    const dataRef = new Date(`${dataInicio}T00:00:00`);

    const dados = {
      nome: "Meta principal",
      tipo: payload.tipo,
      valor_base: payload.valor_base,
      mes: dataRef.getMonth() + 1,
      ano: dataRef.getFullYear(),
      dias_trabalho: payload.tipo === "mensal" ? payload.dias_mes : [],
      dias_semana: payload.tipo === "semanal" ? payload.dias_semana || [] : [],
      dias_mes: payload.tipo === "mensal" ? payload.dias_mes || [] : [],
      data_inicio: dataInicio,
      valor_realizado_antes: payload.tipo === "diaria" ? 0 : payload.valor_realizado_antes || 0,
      ativa: true,
    };

    const existente = metas.find((meta) => meta.tipo === payload.tipo);

    if (existente) {
      const { error } = await supabase
        .from("metas")
        .update(dados)
        .eq("id", existente.id);

      if (error) {
        console.error(error);
        alert("Erro ao atualizar meta.");
        return;
      }
    } else {
      const { error } = await supabase.from("metas").insert(dados);

      if (error) {
        console.error(error);
        alert("Erro ao criar meta.");
        return;
      }
    }

    const { error: erroDesativar } = await supabase
      .from("metas")
      .update({ ativa: false })
      .neq("tipo", payload.tipo)
      .in("tipo", TIPOS_META);

    if (erroDesativar) console.error(erroDesativar);

    setModalAberto(false);
    carregarMetas();
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function percentual(realizadoAtual, metaAtual) {
    if (!metaAtual || metaAtual <= 0) return 0;
    return Math.min((Number(realizadoAtual || 0) / Number(metaAtual || 0)) * 100, 999);
  }

  function faltante(realizadoAtual, metaAtual) {
    return Math.max(Number(metaAtual || 0) - Number(realizadoAtual || 0), 0);
  }

  if (carregando) {
    return (
      <div>
        <h1 className="text-3xl font-bold">Metas</h1>
        <p className="text-gray-400 mt-2">Carregando metas...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Metas</h1>
          <p className="text-gray-400 mt-2">
            Defina uma meta principal. A tela mostra somente os indicadores ligados ao tipo de meta escolhido.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-5 py-3"
        >
          {metaAtiva ? "Alterar Meta" : "+ Criar Meta"}
        </button>
      </div>

      {!metaAtiva && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-green-400">Nenhuma meta ativa</h2>
          <p className="text-gray-400 mt-2">
            Crie ou ative uma meta para o ControlDriver calcular o objetivo do dia automaticamente.
          </p>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="mt-6 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-5 py-3"
          >
            Criar Meta
          </button>
        </div>
      )}

      {metaAtiva && (
        <>
          <section className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <p className="text-sm text-gray-400">Tipo de meta escolhido</p>
                <h2 className="text-3xl font-black mt-1">{textoTipo(metaAtiva.tipo)}</h2>
                <p className="text-gray-500 text-sm mt-2">
                  Dias escolhidos para trabalhar: <span className="text-white font-bold">{descricaoRegraTrabalho(metaAtiva)}</span>
                </p>
              </div>

              <div className="bg-[#0B1120] border border-green-500/30 rounded-2xl p-5 min-w-[240px]">
                <p className="text-sm text-gray-400">Valor informado</p>
                <p className="text-3xl font-black text-green-400 mt-1">{formatarMoeda(metaAtiva.valor_base)}</p>
              </div>
            </div>
          </section>

          <section className={`mt-6 grid grid-cols-1 ${cardsVisiveis.length > 0 ? "xl:grid-cols-2" : ""} gap-4 items-stretch`}>
            {cardsVisiveis.includes("semana") && (
              <MetaCard titulo="Meta semanal" meta={resumoPeriodoMeta?.meta ?? metasCalculadas.semanal} realizado={resumoPeriodoMeta?.realizado ?? realizado.semana} formatarMoeda={formatarMoeda} percentual={percentual(resumoPeriodoMeta?.realizado ?? realizado.semana, resumoPeriodoMeta?.meta ?? metasCalculadas.semanal)} faltante={resumoPeriodoMeta?.falta ?? faltante(realizado.semana, metasCalculadas.semanal)} />
            )}
            {cardsVisiveis.includes("mes") && (
              <MetaCard titulo="Meta mensal" meta={resumoPeriodoMeta?.meta ?? metasCalculadas.mensal} realizado={resumoPeriodoMeta?.realizado ?? realizado.mes} formatarMoeda={formatarMoeda} percentual={percentual(resumoPeriodoMeta?.realizado ?? realizado.mes, resumoPeriodoMeta?.meta ?? metasCalculadas.mensal)} faltante={resumoPeriodoMeta?.falta ?? faltante(realizado.mes, metasCalculadas.mensal)} />
            )}
            {cardsVisiveis.includes("ano") && (
              <MetaCard titulo="Meta anual" meta={resumoPeriodoMeta?.meta ?? metasCalculadas.anual} realizado={resumoPeriodoMeta?.realizado ?? realizado.ano} formatarMoeda={formatarMoeda} percentual={percentual(resumoPeriodoMeta?.realizado ?? realizado.ano, resumoPeriodoMeta?.meta ?? metasCalculadas.anual)} faltante={resumoPeriodoMeta?.falta ?? faltante(realizado.ano, metasCalculadas.anual)} />
            )}
            <MetaHojeCard
              metaHoje={metaHoje}
              realizadoHoje={realizado.dia}
              mediaGanhosHora={mediaGanhosHora}
              horasNecessariasHoje={horasNecessariasHoje}
              tipoMeta={metaAtiva.tipo}
              formatarMoeda={formatarMoeda}
              percentual={percentual(realizado.dia, metaHoje)}
            />
          </section>

          {metaAtiva.tipo !== "diaria" && (
            <DistribuicaoDiasMeta
              tipo={metaAtiva.tipo}
              dias={distribuicaoDiasMeta}
              resumo={resumoPeriodoMeta}
              formatarMoeda={formatarMoeda}
            />
          )}
        </>
      )}

      <MetaModal aberto={modalAberto} onClose={() => setModalAberto(false)} onSalvar={salvarMeta} metaAtual={metaAtiva} metas={metas} buscarFaturamentoPeriodo={buscarFaturamentoPeriodoDetalhado} />
    </div>
  );
}

function MetaHojeCard({ metaHoje, realizadoHoje, mediaGanhosHora, horasNecessariasHoje, tipoMeta, formatarMoeda, percentual }) {
  const faltaHoje = Math.max(Number(metaHoje || 0) - Number(realizadoHoje || 0), 0);

  return (
    <section className="h-full bg-green-500 border border-green-400 rounded-2xl p-5 sm:p-6 text-black">
      <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-black/70">Meta necessária hoje</p>
              <h2 className="text-4xl sm:text-5xl font-black mt-1">{formatarMoeda(metaHoje)}</h2>
            </div>
            <span className="rounded-full bg-yellow-400/90 text-black text-xs font-black px-3 py-1">{Math.round(percentual)}%</span>
          </div>

          <div className="mt-4 h-3 rounded-full bg-black/12 overflow-hidden">
            <div className="h-full rounded-full bg-black/45 transition-all" style={{ width: `${Math.min(percentual, 100)}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-black/60">Faturado hoje</p>
              <p className="text-xl sm:text-2xl font-black mt-1">{formatarMoeda(realizadoHoje)}</p>
            </div>
            <div>
              <p className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-black/60">Ainda falta hoje</p>
              <p className="text-xl sm:text-2xl font-black mt-1">{formatarMoeda(faltaHoje)}</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-black/75 mt-4">
            Calculada com base na {textoTipo(tipoMeta).toLowerCase()}, no faturamento registrado e no restante do período.
          </p>

          {mediaGanhosHora > 0 && horasNecessariasHoje > 0 && (
            <div className="mt-4 pt-4 border-t border-black/15 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
                  <FiDollarSign className="text-lg" />
                </span>
                <div>
                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-black/60">Seu ganho médio por hora é de</p>
                  <p className="text-xl sm:text-2xl font-black mt-0.5">{formatarMoeda(mediaGanhosHora)}/h</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
                  <FiClock className="text-lg" />
                </span>
                <div>
                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-black/60">Estimativa de horas para bater a meta</p>
                  <p className="text-xl sm:text-2xl font-black mt-0.5">{formatarHorasDecimais(horasNecessariasHoje)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
  );
}

function MetaCard({ titulo, meta, realizado, formatarMoeda, percentual, faltante }) {
  const bateuMeta = Number(realizado || 0) >= Number(meta || 0);

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">{titulo}</p>
          <p className="text-2xl font-black mt-1">{formatarMoeda(meta)}</p>
        </div>
        <div className={`rounded-full text-xs font-bold px-3 py-1 ${bateuMeta ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
          {Math.round(percentual)}%
        </div>
      </div>

      <div className="mt-5 h-3 rounded-full bg-[#0B1120] overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(percentual, 100)}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-3">
          <p className="text-xs text-gray-500">Realizado</p>
          <p className="font-bold text-green-400 mt-1">{formatarMoeda(realizado)}</p>
        </div>
        <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-3">
          <p className="text-xs text-gray-500">Falta</p>
          <p className="font-bold text-red-400 mt-1">{formatarMoeda(faltante)}</p>
        </div>
      </div>
    </div>
  );
}

function DistribuicaoDiasMeta({ tipo, dias, resumo, formatarMoeda }) {
  const [aberto, setAberto] = useState(false);
  const [mesesAbertos, setMesesAbertos] = useState({});

  const grupos = useMemo(() => agruparDistribuicaoPorTipo(tipo, dias), [tipo, dias]);

  useEffect(() => {
    if (tipo !== "anual" || !grupos.length) return;
    const hojeTexto = dataISOApp(new Date());
    const grupoAtual = grupos.find((grupo) => grupo.dias.some((dia) => dia.data === hojeTexto)) || grupos[0];
    setMesesAbertos((atual) => Object.keys(atual).length ? atual : { [grupoAtual.chave]: true });
  }, [tipo, grupos]);

  if (!dias.length) return null;

  function alternarMes(chave) {
    setMesesAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  const titulo = tipo === "semanal"
    ? "Distribuição da meta semanal"
    : tipo === "mensal"
      ? "Distribuição da meta mensal"
      : "Distribuição da meta anual";

  return (
    <section className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl border border-gray-800 bg-[#0B1120] flex items-center justify-center text-green-400 shrink-0">
            {aberto ? <FiChevronDown /> : <FiChevronRight />}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-gray-400">Projeção da meta</p>
            <h3 className="text-2xl font-black mt-1 text-white truncate">{titulo}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Acompanhe os dias anteriores, o dia atual e os próximos dias do período.
            </p>
          </div>
        </div>
      </button>

      {aberto && (
        <div className="px-5 pb-5">
          {tipo === "anual" ? (
            <div className="space-y-3">
              {grupos.map((grupo) => {
                const mesAberto = mesesAbertos[grupo.chave] === true;
                return (
                  <div key={grupo.chave} className="bg-[#0B1120] border border-gray-800 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => alternarMes(grupo.chave)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl border border-gray-800 bg-[#111827] flex items-center justify-center text-green-400 shrink-0">
                          {mesAberto ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-lg font-black text-white truncate">{grupo.rotulo}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {grupo.dias.length} dia(s) • realizado {formatarMoeda(grupo.realizado)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">Meta</p>
                        <p className="text-sm font-black text-green-400">{formatarMoeda(grupo.meta)}</p>
                      </div>
                    </button>

                    {mesAberto && (
                      <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {grupo.dias.map((dia) => (
                          <DiaMetaCard key={dia.data} dia={dia} formatarMoeda={formatarMoeda} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {dias.map((dia) => (
                <DiaMetaCard key={dia.data} dia={dia} formatarMoeda={formatarMoeda} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}


function DiaMetaCard({ dia, formatarMoeda }) {
  const atingiu = Number(dia.realizado || 0) >= Number(dia.meta || 0);

  const statusConfig = {
    passado: {
      label: atingiu ? "Meta atingida" : "Não atingiu",
      classe: atingiu
        ? "bg-green-500/15 text-green-400 border-green-500/35"
        : "bg-red-500/15 text-red-300 border-red-500/35",
      tituloValor: "Meta daquele dia",
      valorPrincipal: dia.meta,
      cardClasse: "bg-[#0B1120] border-gray-800",
      valorClasse: "text-gray-100",
      mostrarDetalhes: true,
    },
    hoje: {
      label: "Hoje",
      classe: "bg-green-500/15 text-green-400 border-green-500/40",
      tituloValor: "Precisa fazer hoje",
      valorPrincipal: dia.meta,
      cardClasse: "bg-green-500/10 border-green-500/40 shadow-[0_0_0_1px_rgba(34,197,94,0.12)]",
      valorClasse: "text-green-400",
      mostrarDetalhes: true,
    },
    futuro: {
      label: "Futuro",
      classe: "bg-gray-800/70 text-gray-500 border-gray-700/70",
      tituloValor: "Meta prevista",
      valorPrincipal: dia.meta,
      cardClasse: "bg-[#0B1120]/35 border-gray-800/60 opacity-45",
      valorClasse: "text-blue-300",
      mostrarDetalhes: false,
    },
  };

  const config = statusConfig[dia.status] || statusConfig.futuro;
  const saldoLabel = Number(dia.realizado || 0) > Number(dia.meta || 0) ? "Excedeu" : dia.status === "passado" ? "Faltou" : "Falta";
  const saldoValor = Number(dia.realizado || 0) > Number(dia.meta || 0)
    ? Number(dia.realizado || 0) - Number(dia.meta || 0)
    : Number(dia.falta || 0);

  return (
    <div className={`border rounded-2xl p-4 transition ${config.cardClasse}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{dia.rotulo}</p>
          <p className="text-xs text-gray-500 mt-1">{dia.subtitulo}</p>
        </div>
        <span className={`text-[11px] font-black rounded-full border px-2 py-1 ${config.classe}`}>
          {config.label}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs text-gray-500">{config.tituloValor}</p>
        <p className={`text-2xl font-black mt-1 ${config.valorClasse}`}>{formatarMoeda(config.valorPrincipal)}</p>
      </div>

      {config.mostrarDetalhes && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">Faturamento</p>
            <p className="text-sm font-bold text-white mt-1">{formatarMoeda(dia.realizado)}</p>
          </div>
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500">{saldoLabel}</p>
            <p className={`text-sm font-bold mt-1 ${saldoLabel === "Excedeu" ? "text-green-400" : "text-red-400"}`}>
              {formatarMoeda(saldoValor)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function agruparDistribuicaoPorTipo(tipo, dias) {
  if (tipo === "anual") return agruparDiasPorMes(dias);

  const chave = tipo === "semanal" ? "semana-atual" : "mes-atual";
  const rotulo = tipo === "semanal" ? "Semana atual" : "Mês atual";

  return [{
    chave,
    rotulo,
    dias,
    meta: somarValoresDias(dias, "meta"),
    realizado: somarValoresDias(dias, "realizado"),
  }];
}

function somarValoresDias(dias, campo) {
  return (dias || []).reduce((total, dia) => total + Number(dia?.[campo] || 0), 0);
}

function cardsPorTipoMeta(tipo) {
  if (tipo === "semanal") return ["semana"];
  if (tipo === "mensal") return ["mes"];
  if (tipo === "anual") return ["ano"];
  return [];
}

function calcularMetasPlanejadas(meta) {
  if (!meta) return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };
  const valor = Number(meta.valor_base || 0);

  return {
    diaria: meta.tipo === "diaria" ? valor : 0,
    semanal: meta.tipo === "semanal" ? valor : 0,
    mensal: meta.tipo === "mensal" ? valor : 0,
    anual: meta.tipo === "anual" ? valor : 0,
  };
}

function periodoBaseMeta(meta, dataRef) {
  if (meta.tipo === "semanal") return intervaloSemana(dataRef);
  if (meta.tipo === "mensal") return intervaloMes(dataRef);
  if (meta.tipo === "anual") return intervaloAnoMeta(meta, dataRef);
  return { inicio: dataRef, fim: dataRef };
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

    if (meta.tipo === "anual") trabalha = true;

    if (meta.tipo === "mensal") {
      trabalha = diasMes.length ? diasMes.includes(diaMes) : diaSemana >= 1 && diaSemana <= 6;
    }

    if (meta.tipo === "diaria") trabalha = true;

    if (trabalha) dias.push(iso);
    data.setDate(data.getDate() + 1);
  }

  return dias;
}

function descricaoRegraTrabalho(meta) {
  if (!meta) return "-";
  if (meta.tipo === "diaria") return "Meta fixa por dia";
  if (meta.tipo === "semanal") {
    const dias = normalizarDiasSemana(meta.dias_semana);
    if (!dias.length) return "Segunda a sábado";
    return DIAS_SEMANA.filter((dia) => dias.includes(dia.valor)).map((dia) => dia.curto).join(", ");
  }
  if (meta.tipo === "anual") return "Dias corridos até o fim do ano";
  const diasMes = normalizarArrayNumerico(meta.dias_mes || meta.dias_trabalho);
  return diasMes.length ? `${diasMes.length} dia(s) selecionado(s) no mês` : "Dias úteis do mês";
}

function textoTipo(tipo) {
  const mapa = {
    diaria: "Meta Diária",
    semanal: "Meta Semanal",
    mensal: "Meta Mensal",
    anual: "Meta Anual",
  };
  return mapa[tipo] || "Meta";
}

function somarValoresPorData(porData, filtro) {
  return Object.entries(porData || {}).reduce((total, [data, valor]) => {
    if (!filtro || filtro(data)) return total + Number(valor || 0);
    return total;
  }, 0);
}

function agruparDiasPorMes(dias) {
  const grupos = dias.reduce((acc, dia) => {
    const chave = dia.mesChave || String(dia.data).slice(0, 7);
    if (!acc[chave]) {
      acc[chave] = {
        chave,
        rotulo: dia.mesRotulo || rotuloMesAno(dia.data),
        dias: [],
        meta: 0,
        realizado: 0,
      };
    }

    acc[chave].dias.push(dia);
    acc[chave].meta += Number(dia.meta || 0);
    acc[chave].realizado += Number(dia.realizado || 0);
    return acc;
  }, {});

  return Object.values(grupos).sort((a, b) => String(a.chave).localeCompare(String(b.chave)));
}

function rotuloMesAno(dataISOTexto) {
  const [ano, mes] = String(dataISOTexto).split("-");
  const nomes = [
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
  return `${nomes[Number(mes) - 1] || mes} / ${ano}`;
}

function rotuloDiaMeta(dataISOTexto, tipo) {
  if (tipo === "mensal" || tipo === "anual") {
    return `${String(Number(String(dataISOTexto).slice(8, 10))).padStart(2, "0")} • ${nomeDiaSemanaCurto(dataISOTexto)}`;
  }

  return nomeDiaSemana(dataISOTexto);
}

function nomeDiaSemanaCurto(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return nomes[data.getDay()];
}

function nomeDiaSemana(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return nomes[data.getDay()];
}

function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHorasDecimais(horas) {
  const totalMinutos = Math.ceil(Number(horas || 0) * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  if (h <= 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function intervalParaMinutos(intervalo) {
  if (!intervalo) return 0;
  const partes = String(intervalo).split(":");
  const horas = Number(partes[0] || 0);
  const minutos = Number(partes[1] || 0);
  return horas * 60 + minutos;
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
  return normalizarArrayNumerico(valor).filter((dia) => dia >= 0 && dia <= 6);
}

function dataISO(data) {
  return dataISOApp(data);
}

function adicionarDiasISO(dataISOTexto, quantidade) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  data.setDate(data.getDate() + quantidade);
  return dataISO(data);
}

function intervaloSemana(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const diaSemana = data.getDay();
  const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + diferenca);
  const inicio = dataISO(data);
  return { inicio, fim: adicionarDiasISO(inicio, 6) };
}

function intervaloMes(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  return {
    inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
    fim: dataISO(new Date(ano, mes, 0)),
  };
}

function intervaloAnoMeta(meta, dataISOTexto) {
  const ano = Number(String(dataISOTexto).slice(0, 4));
  const dataInicio = meta?.data_inicio || dataISOTexto;
  const anoInicio = Number(String(dataInicio).slice(0, 4));
  const mesInicio = anoInicio === ano ? String(dataInicio).slice(5, 7) : "01";
  return { inicio: `${ano}-${mesInicio}-01`, fim: `${ano}-12-31` };
}

function intervaloAno(dataISOTexto) {
  const ano = Number(String(dataISOTexto).slice(0, 4));
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function maiorData(a, b) {
  return String(a) > String(b) ? a : b;
}
