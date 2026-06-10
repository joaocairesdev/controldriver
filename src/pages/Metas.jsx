import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

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

export default function Metas() {
  const hoje = new Date();
  const hojeISO = dataISO(hoje);

  const [metas, setMetas] = useState([]);
  const [metaAtiva, setMetaAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [realizado, setRealizado] = useState({ dia: 0, semana: 0, mes: 0, ano: 0 });
  const [metaHoje, setMetaHoje] = useState(0);

  useEffect(() => {
    carregarMetas();
  }, []);

  useEffect(() => {
    if (metaAtiva) carregarRealizado(metaAtiva);
  }, [metaAtiva]);

  const metasCalculadas = useMemo(() => {
    if (!metaAtiva) return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };
    return calcularMetasPlanejadas(metaAtiva, hojeISO);
  }, [metaAtiva, hojeISO]);

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

  async function carregarRealizado(meta) {
    const hojeTexto = dataISO(new Date());
    const semana = intervaloSemana(hojeTexto);
    const mes = intervaloMes(hojeTexto);
    const ano = intervaloAno(hojeTexto);

    const [diaData, semanaData, mesData, anoData] = await Promise.all([
      buscarTotalEntradas(hojeTexto, hojeTexto),
      buscarTotalEntradas(maiorData(semana.inicio, meta.data_inicio || semana.inicio), semana.fim),
      buscarTotalEntradas(maiorData(mes.inicio, meta.data_inicio || mes.inicio), mes.fim),
      buscarTotalEntradas(maiorData(ano.inicio, meta.data_inicio || ano.inicio), ano.fim),
    ]);

    setRealizado({
      dia: diaData,
      semana: semanaData,
      mes: mesData,
      ano: anoData + Number(meta.valor_realizado_antes || 0),
    });

    const necessariaHoje = await calcularMetaNecessariaHoje(meta, hojeTexto);
    setMetaHoje(necessariaHoje);
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

  async function calcularMetaNecessariaHoje(meta, hojeTexto) {
    if (!meta) return 0;
    const valor = Number(meta.valor_base || 0);
    if (valor <= 0) return 0;
    if (meta.tipo === "diaria") return valor;

    const periodo = periodoBaseMeta(meta, hojeTexto);
    const inicioCalculo = maiorData(periodo.inicio, meta.data_inicio || periodo.inicio);
    const ontem = adicionarDiasISO(hojeTexto, -1);
    const realizadoAntesHoje = inicioCalculo <= ontem ? await buscarTotalEntradas(inicioCalculo, ontem) : 0;
    const metaPeriodo = Number(meta.valor_base || 0);
    const restante = Math.max(metaPeriodo - realizadoAntesHoje, 0);
    const diasRestantes = diasTrabalhoNoPeriodo(meta, hojeTexto, periodo.fim);

    return diasRestantes.length > 0 ? restante / diasRestantes.length : restante;
  }

  async function salvarMeta(payload) {
    const dataInicio = payload.data_inicio || dataISO(new Date());
    const dataRef = new Date(`${dataInicio}T00:00:00`);

    const dados = {
      nome: "Meta principal",
      tipo: payload.tipo,
      valor_base: payload.valor_base,
      mes: dataRef.getMonth() + 1,
      ano: dataRef.getFullYear(),
      dias_trabalho: payload.tipo === "mensal" ? payload.dias_mes : [],
      dias_semana: payload.dias_semana || [],
      dias_mes: payload.dias_mes || [],
      data_inicio: dataInicio,
      valor_realizado_antes: payload.valor_realizado_antes || 0,
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
            Defina uma meta principal. O app calcula quanto precisa fazer hoje e as visões diária, semanal, mensal e anual.
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
          <section className="mt-8 bg-green-500 border border-green-400 rounded-3xl p-6 text-black">
            <p className="text-sm font-black uppercase tracking-wide text-black/70">Meta necessária hoje</p>
            <h2 className="text-4xl sm:text-5xl font-black mt-2">{formatarMoeda(metaHoje)}</h2>
            <p className="text-sm text-black/75 mt-3">
              Calculada com base na meta {textoTipo(metaAtiva.tipo).toLowerCase()}, no que já foi faturado e nos dias de trabalho restantes.
            </p>
          </section>

          <section className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <p className="text-sm text-gray-400">Meta principal ativa</p>
                <h2 className="text-3xl font-black mt-1">{textoTipo(metaAtiva.tipo)}</h2>
                <p className="text-gray-500 text-sm mt-2">
                  Início: <span className="text-white font-bold">{formatarDataBR(metaAtiva.data_inicio)}</span>
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Regra de trabalho: <span className="text-white font-bold">{descricaoRegraTrabalho(metaAtiva)}</span>
                </p>
              </div>

              <div className="bg-[#0B1120] border border-green-500/30 rounded-2xl p-5 min-w-[240px]">
                <p className="text-sm text-gray-400">Valor informado</p>
                <p className="text-3xl font-black text-green-400 mt-1">{formatarMoeda(metaAtiva.valor_base)}</p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetaCard titulo="Hoje" meta={metaHoje} realizado={realizado.dia} formatarMoeda={formatarMoeda} percentual={percentual(realizado.dia, metaHoje)} faltante={faltante(realizado.dia, metaHoje)} />
            <MetaCard titulo="Semana" meta={metasCalculadas.semanal} realizado={realizado.semana} formatarMoeda={formatarMoeda} percentual={percentual(realizado.semana, metasCalculadas.semanal)} faltante={faltante(realizado.semana, metasCalculadas.semanal)} />
            <MetaCard titulo="Mês" meta={metasCalculadas.mensal} realizado={realizado.mes} formatarMoeda={formatarMoeda} percentual={percentual(realizado.mes, metasCalculadas.mensal)} faltante={faltante(realizado.mes, metasCalculadas.mensal)} />
            <MetaCard titulo="Ano" meta={metasCalculadas.anual} realizado={realizado.ano} formatarMoeda={formatarMoeda} percentual={percentual(realizado.ano, metasCalculadas.anual)} faltante={faltante(realizado.ano, metasCalculadas.anual)} />
          </section>
        </>
      )}

      <MetaModal aberto={modalAberto} onClose={() => setModalAberto(false)} onSalvar={salvarMeta} metaAtual={metaAtiva} metas={metas} />
    </div>
  );
}

function MetaModal({ aberto, onClose, onSalvar, metaAtual, metas }) {
  const hojeTexto = dataISO(new Date());
  const [tipo, setTipo] = useState(metaAtual?.tipo || "diaria");
  const metaDoTipo = metas.find((meta) => meta.tipo === tipo) || (metaAtual?.tipo === tipo ? metaAtual : null);
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState(hojeTexto);
  const [diasSemana, setDiasSemana] = useState([1, 2, 3, 4, 5, 6]);
  const [diasMes, setDiasMes] = useState([]);
  const [valorRealizadoAntes, setValorRealizadoAntes] = useState("");

  useEffect(() => {
    if (!aberto) return;
    const inicial = metaAtual?.tipo || "diaria";
    setTipo(inicial);
  }, [aberto, metaAtual]);

  useEffect(() => {
    if (!aberto) return;

    const meta = metas.find((item) => item.tipo === tipo) || (metaAtual?.tipo === tipo ? metaAtual : null);
    const inicio = meta?.data_inicio || hojeTexto;

    setValor(meta?.valor_base ? numeroParaMoedaInput(meta.valor_base) : "");
    setDataInicio(inicio);
    setDiasSemana(normalizarDiasSemana(meta?.dias_semana).length ? normalizarDiasSemana(meta?.dias_semana) : [1, 2, 3, 4, 5, 6]);
    setDiasMes(normalizarArrayNumerico(meta?.dias_mes || meta?.dias_trabalho).length ? normalizarArrayNumerico(meta?.dias_mes || meta?.dias_trabalho) : gerarDiasUteisMes(inicio));
    setValorRealizadoAntes(meta?.valor_realizado_antes ? numeroParaMoedaInput(meta.valor_realizado_antes) : "");
  }, [tipo, aberto]);

  if (!aberto) return null;

  function alternarDiaSemana(dia) {
    setDiasSemana((lista) =>
      lista.includes(dia)
        ? lista.filter((item) => item !== dia)
        : [...lista, dia].sort((a, b) => ordemDiaSemana(a) - ordemDiaSemana(b))
    );
  }

  function alternarDiaMes(dia) {
    setDiasMes((lista) =>
      lista.includes(dia)
        ? lista.filter((item) => item !== dia)
        : [...lista, dia].sort((a, b) => a - b)
    );
  }

  function selecionarSegundaSexta() {
    setDiasSemana([1, 2, 3, 4, 5]);
  }

  function selecionarSegundaSabado() {
    setDiasSemana([1, 2, 3, 4, 5, 6]);
  }

  function selecionarTodosDiasMes() {
    setDiasMes(diasCalendario(dataInicio).map((dia) => dia.dia));
  }

  function selecionarDiasUteisMes() {
    setDiasMes(gerarDiasUteisMes(dataInicio));
  }

  function salvar() {
    const valorNumero = moedaParaNumero(valor);

    if (valorNumero <= 0) {
      alert("Informe o valor da meta.");
      return;
    }

    if (!dataInicio) {
      alert("Informe a data de início.");
      return;
    }

    if (["semanal", "anual"].includes(tipo) && diasSemana.length === 0) {
      alert("Selecione pelo menos um dia da semana.");
      return;
    }

    if (tipo === "mensal" && diasMes.length === 0) {
      alert("Selecione pelo menos um dia do mês.");
      return;
    }

    onSalvar({
      tipo,
      valor_base: valorNumero,
      data_inicio: dataInicio,
      dias_semana: ["semanal", "anual"].includes(tipo) ? diasSemana : [],
      dias_mes: tipo === "mensal" ? diasMes : [],
      valor_realizado_antes: moedaParaNumero(valorRealizadoAntes),
    });
  }

  const diasDoMes = diasCalendario(dataInicio);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Configurar Meta</h2>
            <p className="text-gray-400 mt-2">
              Escolha o tipo de meta. O app mantém somente um registro por tipo e atualiza quando você alterar.
            </p>
          </div>

          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shrink-0">
            ×
          </button>
        </div>

        <div className="mt-6">
          <p className="text-sm text-gray-300">Tipo de meta</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {TIPOS_META.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTipo(item)}
                className={`rounded-xl border p-4 font-bold ${
                  tipo === item
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {textoTipo(item).replace("Meta ", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-300">Valor da {textoTipo(tipo).toLowerCase()}</label>
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                placeholder="0,00"
                onChange={(e) => setValor(formatarMoedaDigitada(e.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Data de início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                if (tipo === "mensal") setDiasMes(gerarDiasUteisMes(e.target.value));
              }}
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
            />
          </div>
        </div>

        {tipo === "diaria" && (
          <InfoBox
            titulo="Meta diária simples"
            texto="Aqui você informa somente quanto deseja fazer por dia. Semana, mês e ano serão calculados automaticamente pelo valor diário."
          />
        )}

        {tipo === "semanal" && (
          <section className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Dias de trabalho da semana</h3>
                <p className="text-sm text-gray-400 mt-1">O valor semanal será dividido apenas entre os dias escolhidos.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selecionarSegundaSexta} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Seg-Sex</button>
                <button type="button" onClick={selecionarSegundaSabado} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Seg-Sáb</button>
              </div>
            </div>
            <DiasSemanaCards diasSelecionados={diasSemana} alternarDia={alternarDiaSemana} />
          </section>
        )}

        {tipo === "mensal" && (
          <section className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Dias de trabalho no mês</h3>
                <p className="text-sm text-gray-400 mt-1">Selecione no calendário os dias em que pretende trabalhar.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selecionarDiasUteisMes} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Dias úteis</button>
                <button type="button" onClick={selecionarTodosDiasMes} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Todos</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mt-4">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
                <div key={dia} className="text-center text-xs text-gray-500 font-bold py-1">{dia}</div>
              ))}
              {diasDoMes.map((item, index) =>
                item.vazio ? (
                  <div key={`vazio-${index}`} />
                ) : (
                  <button
                    key={item.dia}
                    type="button"
                    onClick={() => alternarDiaMes(item.dia)}
                    className={`rounded-xl border p-3 text-sm font-black ${
                      diasMes.includes(item.dia)
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-800 bg-[#0B1120] text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    {item.dia}
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {tipo === "anual" && (
          <section className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Dias de trabalho do ano</h3>
                <p className="text-sm text-gray-400 mt-1">A meta anual será diluída pelos dias da semana escolhidos até o fim do ano.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selecionarSegundaSexta} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Seg-Sex</button>
                <button type="button" onClick={selecionarSegundaSabado} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Seg-Sáb</button>
              </div>
            </div>
            <DiasSemanaCards diasSelecionados={diasSemana} alternarDia={alternarDiaSemana} />
          </section>
        )}

        <div className="mt-6">
          <label className="text-sm text-gray-300">Valor já realizado antes desta meta, se houver</label>
          <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
            <span className="px-3 text-gray-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={valorRealizadoAntes}
              placeholder="0,00"
              onChange={(e) => setValorRealizadoAntes(formatarMoedaDigitada(e.target.value))}
              className="w-full bg-transparent p-3 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button type="button" onClick={onClose} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">
            Salvar Meta
          </button>
        </div>
      </div>
    </div>
  );
}

function DiasSemanaCards({ diasSelecionados, alternarDia }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
      {DIAS_SEMANA.map((dia) => {
        const ativo = diasSelecionados.includes(dia.valor);
        return (
          <button
            key={dia.valor}
            type="button"
            onClick={() => alternarDia(dia.valor)}
            className={`rounded-2xl border p-4 text-left transition ${
              ativo
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
            }`}
          >
            <p className="text-lg font-black">{dia.curto}</p>
            <p className="text-xs text-gray-500 mt-1">{dia.nome}</p>
          </button>
        );
      })}
    </div>
  );
}

function InfoBox({ titulo, texto }) {
  return (
    <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
      <p className="font-bold text-white">{titulo}</p>
      <p className="text-sm text-gray-400 mt-1">{texto}</p>
    </div>
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

function calcularMetasPlanejadas(meta, hojeTexto) {
  if (!meta) return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };

  const semana = intervaloSemana(hojeTexto);
  const mes = intervaloMes(hojeTexto);
  const ano = intervaloAno(hojeTexto);

  return {
    diaria: Number(meta.valor_base || 0),
    semanal: calcularMetaPlanejadaPeriodo(meta, semana.inicio, semana.fim),
    mensal: calcularMetaPlanejadaPeriodo(meta, mes.inicio, mes.fim),
    anual: calcularMetaPlanejadaPeriodo(meta, ano.inicio, ano.fim),
  };
}

function calcularMetaPlanejadaPeriodo(meta, inicio, fim) {
  if (!meta || !inicio || !fim || inicio > fim) return 0;
  const valor = Number(meta.valor_base || 0);
  if (valor <= 0) return 0;

  const inicioConsiderado = maiorData(inicio, meta.data_inicio || inicio);
  if (inicioConsiderado > fim) return 0;

  if (meta.tipo === "diaria") return valor * contarDiasCalendario(inicioConsiderado, fim);
  if (meta.tipo === "semanal") return somarMetaSemanal(meta, inicioConsiderado, fim);
  if (meta.tipo === "mensal") return somarMetaMensal(meta, inicioConsiderado, fim);
  if (meta.tipo === "anual") return somarMetaAnual(meta, inicioConsiderado, fim);
  return 0;
}

function somarMetaSemanal(meta, inicio, fim) {
  return semanasEntre(inicio, fim).reduce((total, semana) => {
    const diasSemanaCheia = diasTrabalhoNoPeriodo(meta, semana.inicio, semana.fim).length || 1;
    const inicioCorte = maiorData(inicio, semana.inicio);
    const fimCorte = menorData(fim, semana.fim);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasSemanaCheia);
  }, 0);
}

function somarMetaMensal(meta, inicio, fim) {
  return mesesEntre(inicio, fim).reduce((total, mesRef) => {
    const inicioMes = `${mesRef.ano}-${String(mesRef.mes).padStart(2, "0")}-01`;
    const fimMes = dataISO(new Date(mesRef.ano, mesRef.mes, 0));
    const diasMesCheio = diasTrabalhoNoPeriodo(meta, inicioMes, fimMes).length || 1;
    const inicioCorte = maiorData(inicio, inicioMes);
    const fimCorte = menorData(fim, fimMes);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasMesCheio);
  }, 0);
}

function somarMetaAnual(meta, inicio, fim) {
  return anosEntre(inicio, fim).reduce((total, ano) => {
    const inicioAno = `${ano}-01-01`;
    const fimAno = `${ano}-12-31`;
    const diasAnoCheio = diasTrabalhoNoPeriodo(meta, inicioAno, fimAno).length || 1;
    const inicioCorte = maiorData(inicio, inicioAno);
    const fimCorte = menorData(fim, fimAno);
    const diasNoCorte = diasTrabalhoNoPeriodo(meta, inicioCorte, fimCorte).length;
    return total + Number(meta.valor_base || 0) * (diasNoCorte / diasAnoCheio);
  }, 0);
}

function periodoBaseMeta(meta, dataRef) {
  if (meta.tipo === "semanal") return intervaloSemana(dataRef);
  if (meta.tipo === "mensal") return intervaloMes(dataRef);
  if (meta.tipo === "anual") return intervaloAno(dataRef);
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

    if (["semanal", "anual"].includes(meta.tipo)) {
      trabalha = diasSemana.length ? diasSemana.includes(diaSemana) : diaSemana >= 1 && diaSemana <= 6;
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

function descricaoRegraTrabalho(meta) {
  if (!meta) return "-";
  if (meta.tipo === "diaria") return "Todos os dias corridos";
  if (["semanal", "anual"].includes(meta.tipo)) {
    const dias = normalizarDiasSemana(meta.dias_semana);
    if (!dias.length) return "Segunda a sábado";
    return DIAS_SEMANA.filter((dia) => dias.includes(dia.valor)).map((dia) => dia.curto).join(", ");
  }
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

function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarMoedaDigitada(valor) {
  let texto = String(valor || "").replace(/\D/g, "");
  const numero = Number(texto || 0) / 100;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moedaParaNumero(valor) {
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", "."));
}

function numeroParaMoedaInput(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  return data.toISOString().split("T")[0];
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

function intervaloAno(dataISOTexto) {
  const ano = Number(String(dataISOTexto).slice(0, 4));
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function contarDiasCalendario(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return 0;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  return Math.max(Math.floor((b - a) / 86400000) + 1, 0);
}

function maiorData(a, b) {
  return String(a) > String(b) ? a : b;
}

function menorData(a, b) {
  return String(a) < String(b) ? a : b;
}

function semanasEntre(inicio, fim) {
  const semanas = [];
  let inicioSemana = intervaloSemana(inicio).inicio;

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

function gerarDiasUteisMes(dataInicio) {
  return diasCalendario(dataInicio)
    .filter((item) => !item.vazio && item.diaSemana >= 1 && item.diaSemana <= 5)
    .map((item) => item.dia);
}

function diasCalendario(dataInicio) {
  const data = new Date(`${dataInicio}T00:00:00`);
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  const total = new Date(ano, mes, 0).getDate();
  const primeiro = new Date(ano, mes - 1, 1).getDay();
  const dias = [];

  for (let i = 0; i < primeiro; i++) dias.push({ vazio: true });
  for (let dia = 1; dia <= total; dia++) {
    dias.push({ dia, diaSemana: new Date(ano, mes - 1, dia).getDay() });
  }

  return dias;
}

function ordemDiaSemana(dia) {
  return dia === 0 ? 7 : dia;
}
