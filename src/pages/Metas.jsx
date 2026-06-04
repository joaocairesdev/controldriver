import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

export default function Metas() {
  const hoje = new Date();
  const hojeISO = dataISO(hoje);
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const [metaAtiva, setMetaAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [realizado, setRealizado] = useState({
    dia: 0,
    semana: 0,
    mes: 0,
    ano: 0,
  });

  useEffect(() => {
    carregarMeta();
  }, []);

  useEffect(() => {
    if (metaAtiva) carregarRealizado(metaAtiva);
  }, [metaAtiva]);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function nomeMes(mes, ano) {
    const data = new Date(ano, mes - 1, 1);
    return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function inicioSemanaISO(data) {
    const novaData = new Date(data);
    const diaSemana = novaData.getDay();
    const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
    novaData.setDate(novaData.getDate() + diferenca);
    novaData.setHours(0, 0, 0, 0);
    return novaData;
  }

  function dataISO(data) {
    return data.toISOString().split("T")[0];
  }

  function diasDoMes(mes, ano) {
    return new Date(ano, mes, 0).getDate();
  }

  function dataInicioMeta(meta) {
    if (meta?.data_inicio) return meta.data_inicio;
    const ano = Number(meta?.ano || anoAtual);
    const mes = Number(meta?.mes || mesAtual);
    return `${ano}-${String(mes).padStart(2, "0")}-01`;
  }

  function dataFimMesDaMeta(meta) {
    const ano = Number(meta?.ano || anoAtual);
    const mes = Number(meta?.mes || mesAtual);
    return `${ano}-${String(mes).padStart(2, "0")}-${String(diasDoMes(mes, ano)).padStart(2, "0")}`;
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
    if (!meta) return [];

    const dias = meta.dias_trabalho || [];
    const inicio = new Date(`${dataInicioMeta(meta)}T00:00:00`);
    const mesInicio = inicio.getMonth() + 1;
    const anoInicio = inicio.getFullYear();

    if (Number(meta.mes) !== mesInicio || Number(meta.ano) !== anoInicio) {
      return dias;
    }

    return dias.filter((dia) => Number(dia) >= inicio.getDate());
  }

  function calcularMetas(meta) {
    if (!meta) {
      return { diaria: 0, semanal: 0, mensal: 0, anual: 0 };
    }

    const diasTrabalho = diasTrabalhoValidos(meta).length || 1;
    const fimMes = dataFimMesDaMeta(meta);
    const diasPeriodoMes = Math.max(diferencaDias(dataInicioMeta(meta), fimMes), 1);
    const semanasPeriodoMes = Math.max(diasPeriodoMes / 7, 1);
    const mediaDiasPorSemana = Math.max(diasTrabalho / semanasPeriodoMes, 1);
    const valor = Number(meta.valor_base || 0);
    const mesesAno = mesesRestantesAno(meta);

    let diaria = 0;
    let semanal = 0;
    let mensal = 0;
    let anual = 0;

    if (meta.tipo === "diaria") {
      diaria = valor;
      mensal = diaria * diasTrabalho;
      semanal = diaria * mediaDiasPorSemana;
      anual = mensal * mesesAno;
    }

    if (meta.tipo === "semanal") {
      semanal = valor;
      diaria = semanal / mediaDiasPorSemana;
      mensal = diaria * diasTrabalho;
      anual = mensal * mesesAno;
    }

    if (meta.tipo === "mensal") {
      mensal = valor;
      diaria = mensal / diasTrabalho;
      semanal = mensal / semanasPeriodoMes;
      anual = mensal * mesesAno;
    }

    if (meta.tipo === "anual") {
      anual = valor;
      mensal = anual / mesesAno;
      diaria = mensal / diasTrabalho;
      semanal = mensal / semanasPeriodoMes;
    }

    return { diaria, semanal, mensal, anual };
  }

  const metasCalculadas = useMemo(() => calcularMetas(metaAtiva), [metaAtiva]);

  async function carregarMeta() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("metas")
      .select("*")
      .eq("ativa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error(error);

    setMetaAtiva(data || null);
    setCarregando(false);
  }

  async function carregarRealizado(meta) {
    const inicioMeta = dataInicioMeta(meta);
    const ano = Number(meta.ano || anoAtual);
    const mes = Number(meta.mes || mesAtual);

    const inicioMesOriginal = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const inicioMes = inicioMeta > inicioMesOriginal ? inicioMeta : inicioMesOriginal;
    const fimMes = `${ano}-${String(mes).padStart(2, "0")}-${String(diasDoMes(mes, ano)).padStart(2, "0")}`;

    const inicioAnoOriginal = `${ano}-01-01`;
    const inicioAno = inicioMeta > inicioAnoOriginal ? inicioMeta : inicioAnoOriginal;
    const fimAno = `${ano}-12-31`;

    const dataHoje = new Date();
    const hojeTexto = dataISO(dataHoje);
    const inicioSemana = inicioSemanaISO(dataHoje);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);

    const inicioSemanaTexto = dataISO(inicioSemana);
    const fimSemanaTexto = dataISO(fimSemana);
    const inicioSemanaAjustado = inicioMeta > inicioSemanaTexto ? inicioMeta : inicioSemanaTexto;

    const [mesData, anoData, semanaData, diaData] = await Promise.all([
      buscarTotalEntradas(inicioMes, fimMes),
      buscarTotalEntradas(inicioAno, fimAno),
      buscarTotalEntradas(inicioSemanaAjustado, fimSemanaTexto),
      buscarTotalEntradas(hojeTexto, hojeTexto),
    ]);

    const realizadoAntes = Number(meta.valor_realizado_antes || 0);

    setRealizado({
      mes: mesData,
      ano: anoData + realizadoAntes,
      semana: semanaData,
      dia: diaData,
    });
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

  async function salvarMeta(payload) {
    const { error: erroDesativar } = await supabase
      .from("metas")
      .update({ ativa: false })
      .eq("ativa", true);

    if (erroDesativar) {
      console.error(erroDesativar);
      alert("Erro ao atualizar metas antigas.");
      return;
    }

    const { error } = await supabase.from("metas").insert({
      nome: "Meta principal",
      tipo: payload.tipo,
      valor_base: payload.valor_base,
      mes: payload.mes,
      ano: payload.ano,
      dias_trabalho: payload.dias_trabalho,
      data_inicio: payload.data_inicio,
      valor_realizado_antes: payload.valor_realizado_antes || 0,
      ativa: true,
    });

    if (error) {
      console.error(error);
      alert("Erro ao salvar meta.");
      return;
    }

    setModalAberto(false);
    carregarMeta();
  }

  function percentual(realizadoAtual, metaAtual) {
    if (!metaAtual || metaAtual <= 0) return 0;
    return Math.min((realizadoAtual / metaAtual) * 100, 999);
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
            Defina uma meta principal e acompanhe a visão diária, semanal, mensal e anual.
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
          <h2 className="text-xl font-bold text-green-400">Nenhuma meta criada</h2>
          <p className="text-gray-400 mt-2">
            Crie sua primeira meta para o Control Driver calcular o objetivo diário, semanal, mensal e anual automaticamente.
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
                <p className="text-sm text-gray-400">Meta principal</p>
                <h2 className="text-3xl font-black mt-1">{textoTipo(metaAtiva.tipo)}</h2>
                <p className="text-gray-400 mt-2 capitalize">
                  Referência: {nomeMes(metaAtiva.mes, metaAtiva.ano)}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Início da meta: <span className="text-white font-bold">{formatarDataBR(dataInicioMeta(metaAtiva))}</span>
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Dias planejados a partir do início: <span className="text-white font-bold">{diasTrabalhoValidos(metaAtiva).length || 0}</span>
                </p>
                {Number(metaAtiva.valor_realizado_antes || 0) > 0 && (
                  <p className="text-gray-500 text-sm mt-1">
                    Realizado antes da meta: <span className="text-white font-bold">{formatarMoeda(metaAtiva.valor_realizado_antes)}</span>
                  </p>
                )}
              </div>

              <div className="bg-[#0B1120] border border-green-500/30 rounded-2xl p-5 min-w-[240px]">
                <p className="text-sm text-gray-400">Valor informado</p>
                <p className="text-3xl font-black text-green-400 mt-1">
                  {formatarMoeda(metaAtiva.valor_base)}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetaCard titulo="Meta Diária" meta={metasCalculadas.diaria} realizado={realizado.dia} formatarMoeda={formatarMoeda} percentual={percentual(realizado.dia, metasCalculadas.diaria)} faltante={faltante(realizado.dia, metasCalculadas.diaria)} />
            <MetaCard titulo="Meta Semanal" meta={metasCalculadas.semanal} realizado={realizado.semana} formatarMoeda={formatarMoeda} percentual={percentual(realizado.semana, metasCalculadas.semanal)} faltante={faltante(realizado.semana, metasCalculadas.semanal)} />
            <MetaCard titulo="Meta Mensal" meta={metasCalculadas.mensal} realizado={realizado.mes} formatarMoeda={formatarMoeda} percentual={percentual(realizado.mes, metasCalculadas.mensal)} faltante={faltante(realizado.mes, metasCalculadas.mensal)} />
            <MetaCard titulo="Meta Anual" meta={metasCalculadas.anual} realizado={realizado.ano} formatarMoeda={formatarMoeda} percentual={percentual(realizado.ano, metasCalculadas.anual)} faltante={faltante(realizado.ano, metasCalculadas.anual)} />
          </section>

          <section className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold">Visão do mês</h2>
            <p className="text-gray-400 mt-2">
              A meta conta a partir da data escolhida. Isso evita cobrar dias anteriores ao início do uso do app.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResumoItem titulo="Meta mensal calculada" valor={formatarMoeda(metasCalculadas.mensal)} />
              <ResumoItem titulo="Já faturado no mês" valor={formatarMoeda(realizado.mes)} />
              <ResumoItem titulo="Falta no mês" valor={formatarMoeda(faltante(realizado.mes, metasCalculadas.mensal))} />
            </div>
          </section>
        </>
      )}

      <MetaModal aberto={modalAberto} onClose={() => setModalAberto(false)} onSalvar={salvarMeta} metaAtual={metaAtiva} />
    </div>
  );
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

function ResumoItem({ titulo, valor }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
      <p className="text-sm text-gray-400">{titulo}</p>
      <p className="text-2xl font-black mt-2">{valor}</p>
    </div>
  );
}

function MetaModal({ aberto, onClose, onSalvar, metaAtual }) {
  const hoje = new Date();
  const hojeTexto = dataISO(hoje);

  const dataInicioInicial = metaAtual?.data_inicio || hojeTexto;
  const mesInicial = dataInicioInicial.slice(0, 7);

  const [tipo, setTipo] = useState(metaAtual?.tipo || "mensal");
  const [valor, setValor] = useState(metaAtual?.valor_base ? numeroParaMoedaInput(metaAtual.valor_base) : "");
  const [dataInicio, setDataInicio] = useState(dataInicioInicial);
  const [mesAno, setMesAno] = useState(mesInicial);
  const [diasSelecionados, setDiasSelecionados] = useState(metaAtual?.dias_trabalho || []);
  const [valorRealizadoAntes, setValorRealizadoAntes] = useState(
    metaAtual?.valor_realizado_antes ? numeroParaMoedaInput(metaAtual.valor_realizado_antes) : ""
  );

  useEffect(() => {
    if (!aberto) return;

    const inicio = metaAtual?.data_inicio || hojeTexto;
    const mesRef = inicio.slice(0, 7);

    setTipo(metaAtual?.tipo || "mensal");
    setValor(metaAtual?.valor_base ? numeroParaMoedaInput(metaAtual.valor_base) : "");
    setDataInicio(inicio);
    setMesAno(mesRef);
    setDiasSelecionados(metaAtual?.dias_trabalho || gerarDiasUteis(mesRef, "seg-sex", inicio));
    setValorRealizadoAntes(metaAtual?.valor_realizado_antes ? numeroParaMoedaInput(metaAtual.valor_realizado_antes) : "");
  }, [aberto]);

  if (!aberto) return null;

  const [ano, mes] = mesAno.split("-").map(Number);
  const totalDias = new Date(ano, mes, 0).getDate();
  const inicioMesmoMes = dataInicio.slice(0, 7) === mesAno;
  const diaInicio = inicioMesmoMes ? Number(dataInicio.split("-")[2]) : 1;

  function formatarMoedaDigitada(texto) {
    return String(texto)
      .replace(/[^\d,]/g, "")
      .replace(/,+/g, ",")
      .replace(/^,/, "")
      .replace(/(,\d{2}).+/, "$1");
  }

  function moedaParaNumero(texto) {
    if (!texto) return 0;
    return Number(String(texto).replace(",", "."));
  }

  function numeroParaMoedaInput(numero) {
    return Number(numero || 0).toFixed(2).replace(".", ",");
  }

  function dataISO(data) {
    return data.toISOString().split("T")[0];
  }

  function gerarDiasUteis(valorMesAno, modo, inicioISO = null) {
    const [anoSelecionado, mesSelecionado] = valorMesAno.split("-").map(Number);
    const qtdDias = new Date(anoSelecionado, mesSelecionado, 0).getDate();
    const diaMinimo = inicioISO?.slice(0, 7) === valorMesAno ? Number(inicioISO.split("-")[2]) : 1;
    const dias = [];

    for (let dia = diaMinimo; dia <= qtdDias; dia++) {
      const data = new Date(anoSelecionado, mesSelecionado - 1, dia);
      const semana = data.getDay();

      if (modo === "todos") dias.push(dia);
      if (modo === "seg-sex" && semana >= 1 && semana <= 5) dias.push(dia);
      if (modo === "seg-sab" && semana >= 1 && semana <= 6) dias.push(dia);
    }

    return dias;
  }

  function alterarDataInicio(novaData) {
    setDataInicio(novaData);
    const novoMesAno = novaData.slice(0, 7);
    setMesAno(novoMesAno);
    setDiasSelecionados(gerarDiasUteis(novoMesAno, "seg-sex", novaData));
  }

  function alterarMes(novoMesAno) {
    setMesAno(novoMesAno);

    let novaDataInicio = dataInicio;
    if (dataInicio.slice(0, 7) !== novoMesAno) {
      novaDataInicio = `${novoMesAno}-01`;
      setDataInicio(novaDataInicio);
    }

    setDiasSelecionados(gerarDiasUteis(novoMesAno, "seg-sex", novaDataInicio));
  }

  function alternarDia(dia) {
    if (dia < diaInicio) return;

    setDiasSelecionados((lista) =>
      lista.includes(dia)
        ? lista.filter((item) => item !== dia)
        : [...lista, dia].sort((a, b) => a - b)
    );
  }

  function salvar() {
    const valorNumero = moedaParaNumero(valor);

    if (valorNumero <= 0) {
      alert("Informe o valor da meta.");
      return;
    }

    if (!dataInicio) {
      alert("Informe a data de início da meta.");
      return;
    }

    if (diasSelecionados.length === 0) {
      alert("Selecione pelo menos um dia de trabalho.");
      return;
    }

    onSalvar({
      tipo,
      valor_base: valorNumero,
      mes,
      ano,
      dias_trabalho: diasSelecionados,
      data_inicio: dataInicio,
      valor_realizado_antes: moedaParaNumero(valorRealizadoAntes),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Configurar Meta</h2>
            <p className="text-gray-400 mt-2">
              Escolha uma meta principal. O app calcula as outras visões automaticamente.
            </p>
          </div>

          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">
            ×
          </button>
        </div>

        <div className="mt-6">
          <p className="text-sm text-gray-300">Tipo de meta</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {[
              ["diaria", "Diária"],
              ["semanal", "Semanal"],
              ["mensal", "Mensal"],
              ["anual", "Anual"],
            ].map(([valorTipo, titulo]) => (
              <button
                key={valorTipo}
                type="button"
                onClick={() => setTipo(valorTipo)}
                className={`rounded-xl border p-4 font-bold ${tipo === valorTipo ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"}`}
              >
                {titulo}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-300">Valor da {textoTipo(tipo).toLowerCase()}</label>
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>
              <input type="text" inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => setValor(formatarMoedaDigitada(e.target.value))} className="w-full bg-transparent p-3 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Data de início da meta</label>
            <input type="date" value={dataInicio} onChange={(e) => alterarDataInicio(e.target.value)} className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400" />
          </div>

          <div>
            <label className="text-sm text-gray-300">Mês de referência</label>
            <input type="month" value={mesAno} onChange={(e) => alterarMes(e.target.value)} className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400" />
          </div>

          <div>
            <label className="text-sm text-gray-300">Já realizado antes desta data</label>
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>
              <input type="text" inputMode="decimal" value={valorRealizadoAntes} placeholder="0,00" onChange={(e) => setValorRealizadoAntes(formatarMoedaDigitada(e.target.value))} className="w-full bg-transparent p-3 outline-none" />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Dias de trabalho</h3>
              <p className="text-sm text-gray-400 mt-1">
                Selecione os dias que pretende trabalhar neste mês. Dias antes da data de início ficam desativados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AtalhoDias onClick={() => setDiasSelecionados(gerarDiasUteis(mesAno, "seg-sex", dataInicio))}>Seg a Sex</AtalhoDias>
              <AtalhoDias onClick={() => setDiasSelecionados(gerarDiasUteis(mesAno, "seg-sab", dataInicio))}>Seg a Sáb</AtalhoDias>
              <AtalhoDias onClick={() => setDiasSelecionados(gerarDiasUteis(mesAno, "todos", dataInicio))}>Todos</AtalhoDias>
              <AtalhoDias onClick={() => setDiasSelecionados([])}>Limpar</AtalhoDias>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mt-5">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((dia, index) => (
              <div key={`${dia}-${index}`} className="text-center text-xs text-gray-500 font-bold">{dia}</div>
            ))}

            {Array.from({ length: primeiroDiaSemana(mes, ano) }).map((_, index) => <div key={`vazio-${index}`} />)}

            {Array.from({ length: totalDias }).map((_, index) => {
              const dia = index + 1;
              const ativo = diasSelecionados.includes(dia);
              const bloqueado = dia < diaInicio;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => alternarDia(dia)}
                  disabled={bloqueado}
                  className={`aspect-square rounded-xl border text-sm font-bold ${
                    bloqueado
                      ? "border-gray-900 bg-[#111827]/40 text-gray-700 cursor-not-allowed"
                      : ativo
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-800 bg-[#111827] text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Dias selecionados: <span className="font-bold text-white">{diasSelecionados.length}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button type="button" onClick={onClose} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">Cancelar</button>
          <button type="button" onClick={salvar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">Salvar Meta</button>
        </div>
      </div>
    </div>
  );
}

function primeiroDiaSemana(mes, ano) {
  return new Date(ano, mes - 1, 1).getDay();
}

function AtalhoDias({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="bg-[#111827] border border-gray-700 hover:border-green-400 text-gray-300 hover:text-green-400 rounded-xl px-3 py-2 text-sm font-bold">
      {children}
    </button>
  );
}
