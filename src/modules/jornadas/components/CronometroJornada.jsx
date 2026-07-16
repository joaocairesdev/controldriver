import { useEffect, useMemo, useRef, useState } from "react";
import { FiClock } from "react-icons/fi";
import { supabase } from "../../../services/supabase";

export default function CronometroJornada({ onLancarGanhos, onEstadoChange }) {
  const [aberto, setAberto] = useState(false);
  const [jornada, setJornada] = useState(null);
  const [pausaAtual, setPausaAtual] = useState(null);
  const [agora, setAgora] = useState(new Date());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [kmRodadosFinal, setKmRodadosFinal] = useState("");
  const [mostrarFinalizar, setMostrarFinalizar] = useState(false);
  const [jornadaFinalizada, setJornadaFinalizada] = useState(null);
  const [aviso, setAviso] = useState({ aberto: false, titulo: "", mensagem: "", tipo: "erro" });
  const [confirmarZerarAberto, setConfirmarZerarAberto] = useState(false);
  const [contagemRegressiva, setContagemRegressiva] = useState(null);
  const contagemRef = useRef(null);

  useEffect(() => {
    carregarDados();

    function abrirPeloSidebar() {
      setAberto(true);
    }

    window.addEventListener("abrir-cronometro-jornada", abrirPeloSidebar);
    return () => window.removeEventListener("abrir-cronometro-jornada", abrirPeloSidebar);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => cancelarContagem();
  }, []);

  const tempoLiquidoSegundos = useMemo(() => {
    if (!jornada?.inicio) return 0;

    const inicio = new Date(jornada.inicio).getTime();
    const fim = jornada.fim ? new Date(jornada.fim).getTime() : agora.getTime();
    const bruto = Math.max(Math.floor((fim - inicio) / 1000), 0);
    let pausas = Number(jornada.total_pausas_segundos || 0);

    if (pausaAtual?.inicio && !pausaAtual?.fim) {
      pausas += Math.max(
        Math.floor((agora.getTime() - new Date(pausaAtual.inicio).getTime()) / 1000),
        0
      );
    }

    return Math.max(bruto - pausas, 0);
  }, [jornada, pausaAtual, agora]);

  useEffect(() => {
    onEstadoChange?.({
      status: jornada?.status || "sem_jornada",
      tempoFormatado: formatarTempo(tempoLiquidoSegundos),
      contagemRegressiva,
    });
  }, [onEstadoChange, jornada?.status, tempoLiquidoSegundos, contagemRegressiva]);

  function dataHojeLocal() {
    return new Date().toLocaleDateString("sv-SE");
  }

  async function carregarDados() {
    setCarregando(true);

    const { data: jornadaData } = await supabase
      .from("jornadas_trabalho")
      .select("*")
      .in("status", ["em_andamento", "pausada", "aguardando_km"])
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    let pausaData = null;

    if (jornadaData?.id) {
      const { data } = await supabase
        .from("jornadas_pausas")
        .select("*")
        .eq("jornada_id", jornadaData.id)
        .is("fim", null)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      pausaData = data || null;
    }

    setJornada(jornadaData || null);
    setPausaAtual(pausaData);
    setMostrarFinalizar(jornadaData?.status === "aguardando_km");
    setCarregando(false);
  }

  function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function numero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", "."));
  }

  function formatarTempo(segundos) {
    const total = Math.max(Number(segundos || 0), 0);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segs = total % 60;

    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segs).padStart(2, "0")}`;
  }

  function segundosParaHoraMinuto(segundos) {
    const total = Math.max(Number(segundos || 0), 0);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  }

  function statusTexto() {
    if (!jornada) return "Pronto para iniciar";
    if (jornada.status === "pausada") return "Pausada";
    if (jornada.status === "aguardando_km") return "Aguardando KM";
    return "Trabalhando";
  }

  function abrirAviso(titulo, mensagem, tipo = "erro") {
    setAviso({ aberto: true, titulo, mensagem, tipo });
  }

  function iniciarContagem() {
    if (salvando || contagemRegressiva !== null || jornada) return;

    setContagemRegressiva(5);

    contagemRef.current = setInterval(() => {
      setContagemRegressiva((valorAtual) => {
        const proximo = Number(valorAtual || 0) - 1;

        if (proximo <= 0) {
          clearInterval(contagemRef.current);
          contagemRef.current = null;
          iniciarJornada();
          return null;
        }

        return proximo;
      });
    }, 1000);
  }

  function cancelarContagem() {
    if (contagemRef.current) {
      clearInterval(contagemRef.current);
      contagemRef.current = null;
    }

    setContagemRegressiva(null);
  }

  async function iniciarJornada() {
    setSalvando(true);

    const agoraISO = new Date().toISOString();

    const { data, error } = await supabase
      .from("jornadas_trabalho")
      .insert({
        data: dataHojeLocal(),
        inicio: agoraISO,
        status: "em_andamento",
        total_pausas_segundos: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao iniciar jornada.");
      setSalvando(false);
      setAberto(true);
      return;
    }

    setJornada(data);
    setPausaAtual(null);
    setMostrarFinalizar(false);
    setJornadaFinalizada(null);
    setSalvando(false);
    setAberto(false);
  }

  async function pausarJornada() {
    if (!jornada?.id || jornada.status === "pausada") return;

    setSalvando(true);
    const inicio = new Date().toISOString();

    const { data: pausaCriada, error: erroPausa } = await supabase
      .from("jornadas_pausas")
      .insert({ jornada_id: jornada.id, inicio })
      .select()
      .single();

    if (erroPausa) {
      console.error(erroPausa);
      abrirAviso("Erro", "Erro ao pausar jornada.");
      setSalvando(false);
      return;
    }

    const { data: jornadaAtualizada, error: erroJornada } = await supabase
      .from("jornadas_trabalho")
      .update({ status: "pausada" })
      .eq("id", jornada.id)
      .select()
      .single();

    if (erroJornada) {
      console.error(erroJornada);
      abrirAviso("Erro", "Erro ao pausar jornada.");
      setSalvando(false);
      return;
    }

    setJornada(jornadaAtualizada);
    setPausaAtual(pausaCriada);
    setSalvando(false);
  }

  async function continuarJornada() {
    if (!jornada?.id || !pausaAtual?.id) return;

    setSalvando(true);

    const fim = new Date().toISOString();
    const segundosPausa = Math.max(
      Math.floor((new Date(fim).getTime() - new Date(pausaAtual.inicio).getTime()) / 1000),
      0
    );

    const { error: erroPausa } = await supabase
      .from("jornadas_pausas")
      .update({ fim })
      .eq("id", pausaAtual.id);

    if (erroPausa) {
      console.error(erroPausa);
      abrirAviso("Erro", "Erro ao continuar jornada.");
      setSalvando(false);
      return;
    }

    const { data: jornadaAtualizada, error: erroJornada } = await supabase
      .from("jornadas_trabalho")
      .update({
        status: "em_andamento",
        total_pausas_segundos: Number(jornada.total_pausas_segundos || 0) + segundosPausa,
      })
      .eq("id", jornada.id)
      .select()
      .single();

    if (erroJornada) {
      console.error(erroJornada);
      abrirAviso("Erro", "Erro ao continuar jornada.");
      setSalvando(false);
      return;
    }

    setJornada(jornadaAtualizada);
    setPausaAtual(null);
    setSalvando(false);
  }

  async function abrirFinalizacao() {
    if (!jornada?.id) return;

    setKmRodadosFinal("");

    if (jornada.status === "aguardando_km") {
      setMostrarFinalizar(true);
      return;
    }

    setSalvando(true);

    let totalPausas = Number(jornada.total_pausas_segundos || 0);

    if (pausaAtual?.id && !pausaAtual.fim) {
      const fimPausa = new Date().toISOString();
      const segundosPausa = Math.max(
        Math.floor((new Date(fimPausa).getTime() - new Date(pausaAtual.inicio).getTime()) / 1000),
        0
      );

      await supabase.from("jornadas_pausas").update({ fim: fimPausa }).eq("id", pausaAtual.id);
      totalPausas += segundosPausa;
    }

    const fim = new Date().toISOString();

    const { data: jornadaParada, error } = await supabase
      .from("jornadas_trabalho")
      .update({
        fim,
        status: "aguardando_km",
        total_pausas_segundos: totalPausas,
      })
      .eq("id", jornada.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao parar o cronômetro da jornada.");
      setSalvando(false);
      return;
    }

    setJornada(jornadaParada);
    setPausaAtual(null);
    setMostrarFinalizar(true);
    setSalvando(false);
  }

  async function salvarFinalizacao() {
    if (!jornada?.id) return;

    const kmRodados = numero(kmRodadosFinal);

    if (kmRodados <= 0) {
      abrirAviso("KM obrigatório", "Informe quantos KM você rodou hoje para finalizar a jornada.");
      return;
    }

    setSalvando(true);

    let totalPausas = Number(jornada.total_pausas_segundos || 0);

    if (pausaAtual?.id && !pausaAtual.fim) {
      const fimPausa = new Date().toISOString();
      const segundosPausa = Math.max(
        Math.floor((new Date(fimPausa).getTime() - new Date(pausaAtual.inicio).getTime()) / 1000),
        0
      );

      await supabase.from("jornadas_pausas").update({ fim: fimPausa }).eq("id", pausaAtual.id);
      totalPausas += segundosPausa;
    }

    const fim = jornada.fim || new Date().toISOString();

    const { data: jornadaEncerrada, error } = await supabase
      .from("jornadas_trabalho")
      .update({
        fim,
        status: "finalizada",
        km_rodados: kmRodados,
        total_pausas_segundos: totalPausas,
      })
      .eq("id", jornada.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao finalizar jornada.");
      setSalvando(false);
      return;
    }

    const segundosLiquidos = calcularSegundosLiquidos(jornadaEncerrada);

    cancelarContagem();
    setJornada(null);
    setPausaAtual(null);
    setMostrarFinalizar(false);
    setJornadaFinalizada({
      ...jornadaEncerrada,
      tempo_liquido_segundos: segundosLiquidos,
      horas_trabalhadas: segundosParaHoraMinuto(segundosLiquidos),
    });
    setSalvando(false);
  }

  function zerarJornada() {
    if (!jornada?.id || salvando) return;
    setConfirmarZerarAberto(true);
  }

  async function confirmarZerarJornada() {
    if (!jornada?.id || salvando) return;

    setSalvando(true);

    const jornadaId = jornada.id;

    const { error: erroPausas } = await supabase
      .from("jornadas_pausas")
      .delete()
      .eq("jornada_id", jornadaId);

    if (erroPausas) {
      console.error(erroPausas);
      abrirAviso("Erro", "Erro ao zerar as pausas da jornada.");
      setSalvando(false);
      setConfirmarZerarAberto(false);
      return;
    }

    const { error: erroJornada } = await supabase
      .from("jornadas_trabalho")
      .delete()
      .eq("id", jornadaId);

    if (erroJornada) {
      console.error(erroJornada);
      abrirAviso("Erro", "Erro ao zerar a jornada.");
      setSalvando(false);
      setConfirmarZerarAberto(false);
      return;
    }

    cancelarContagem();
    setJornada(null);
    setPausaAtual(null);
    setMostrarFinalizar(false);
    setJornadaFinalizada(null);
    setKmRodadosFinal("");
    setConfirmarZerarAberto(false);
    setAberto(false);
    setSalvando(false);
  }

  function calcularSegundosLiquidos(item) {
    if (!item?.inicio || !item?.fim) return tempoLiquidoSegundos;
    const inicio = new Date(item.inicio).getTime();
    const fim = new Date(item.fim).getTime();
    const bruto = Math.max(Math.floor((fim - inicio) / 1000), 0);
    return Math.max(bruto - Number(item.total_pausas_segundos || 0), 0);
  }

  function deixarParaMaisTarde() {
    cancelarContagem();
    setJornada(null);
    setPausaAtual(null);
    setJornadaFinalizada(null);
    setAberto(false);
    setKmRodadosFinal("");
    carregarDados();
  }

  function lancarGanhosAgora() {
    if (!jornadaFinalizada) return;

    const jornadaParaLancar = jornadaFinalizada;

    cancelarContagem();
    setJornada(null);
    setPausaAtual(null);
    setMostrarFinalizar(false);
    setJornadaFinalizada(null);
    setAberto(false);
    setKmRodadosFinal("");

    onLancarGanhos?.(jornadaParaLancar);
    carregarDados();
  }

  return (
    <>

      {aberto && (
  <div
    className="fixed inset-0 z-[90] bg-black/75 flex items-end sm:items-center justify-center p-4"
    onClick={() => {
      const podeFechar =
        !mostrarFinalizar &&
        !jornadaFinalizada;

      if (podeFechar) {
        setAberto(false);
      }
    }}
  >
          <div
            className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${!jornada ? "bg-green-500/10 text-green-400 border-green-500/40" : jornada.status === "pausada" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/40" : "bg-white/10 text-white border-white/30"}`}>
                  {statusTexto()}
                </div>
                <h2 className="text-2xl font-black mt-3">Cronômetro</h2>
                <p className="text-gray-400 text-sm mt-1">Controle seu tempo real de trabalho.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const precisaInformarKm = mostrarFinalizar || jornada?.status === "aguardando_km";

                  if (precisaInformarKm) {
                    abrirAviso(
                      "KM obrigatório",
                      "Informe os KM rodados e salve a jornada antes de fechar."
                    );
                    return;
                  }

                  setAberto(false);
                }}
                className={`w-10 h-10 rounded-xl text-white font-bold shrink-0 ${
                  mostrarFinalizar || jornada?.status === "aguardando_km"
                    ? "bg-gray-700 cursor-not-allowed opacity-60"
                    : "bg-red-500 hover:bg-red-600"
                }`}
                title={
                  mostrarFinalizar || jornada?.status === "aguardando_km"
                    ? "Informe os KM para finalizar antes de fechar"
                    : "Fechar"
                }
              >
                ×
              </button>
            </div>

            {carregando ? (
              <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-400">Carregando jornada...</p>
              </div>
            ) : jornadaFinalizada ? (
              <ResumoFinal
                jornada={jornadaFinalizada}
                onLancar={lancarGanhosAgora}
                onDepois={deixarParaMaisTarde}
              />
            ) : !jornada ? (
              <div className="mt-6 space-y-5">
                <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-7 text-center">
                  <div className="mx-auto w-28 h-28 rounded-full border-2 border-green-400 text-white flex items-center justify-center text-5xl font-black shadow-2xl shadow-green-500/20">
                    {contagemRegressiva !== null ? (
                      <span className="tabular-nums">{contagemRegressiva}</span>
                    ) : (
                      <FiClock />
                    )}
                  </div>

                  <p className="text-white font-bold text-base mt-5">
                    {contagemRegressiva !== null
                      ? "Preparando para iniciar sua jornada..."
                      : "Cronômetro de jornada"}
                  </p>

                  <p className="text-gray-500 text-xs mt-2">
                    {contagemRegressiva !== null
                      ? "O cronômetro inicia automaticamente ao final da contagem."
                      : "Clique em iniciar para começar a contar seu tempo real de trabalho."}
                  </p>
                </div>

                {contagemRegressiva === null ? (
                  <button
                    type="button"
                    onClick={iniciarContagem}
                    disabled={salvando}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-black rounded-xl p-4 disabled:opacity-60"
                  >
                    Iniciar Jornada
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelarContagem}
                    disabled={salvando}
                    className="w-full border border-red-500/50 hover:bg-red-500/10 text-red-400 font-black rounded-xl p-4 disabled:opacity-60"
                  >
                    Cancelar início
                  </button>
                )}
              </div>
            ) : (mostrarFinalizar || jornada.status === "aguardando_km") ? (
              <div className="mt-6 space-y-5">
                <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-6 text-center">
                  <p className="text-gray-400 text-sm">Tempo trabalhado</p>
                  <p className="text-5xl font-black mt-2 tabular-nums">{formatarTempo(tempoLiquidoSegundos)}</p>
                </div>

                <Campo label="Quantos KM você rodou hoje?">
                  <div className="flex items-center bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden focus-within:border-green-400">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={kmRodadosFinal}
                      onChange={(e) => setKmRodadosFinal(somenteNumeros(e.target.value))}
                      placeholder="Ex: 156"
                      className="w-full bg-transparent p-4 outline-none text-2xl font-black"
                    />
                    <span className="px-4 text-gray-400 font-bold">km</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Campo obrigatório para finalizar e salvar a jornada.</p>
                </Campo>

                <button
                  type="button"
                  onClick={salvarFinalizacao}
                  disabled={salvando}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-black rounded-xl p-4 disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : "Salvar e finalizar"}
                </button>

                <button
                  type="button"
                  onClick={zerarJornada}
                  disabled={salvando}
                  className="w-full border border-red-500/50 hover:bg-red-500/10 text-red-400 font-black rounded-xl p-4 disabled:opacity-60"
                >
                  Zerar Jornada
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className={`border rounded-3xl p-8 text-center ${jornada.status === "pausada" ? "bg-yellow-500/10 border-yellow-500/40" : "bg-[#0B1120] border-gray-800"}`}>
                  <p className={`text-sm font-bold ${jornada.status === "pausada" ? "text-yellow-400" : "text-gray-400"}`}>
                    {jornada.status === "pausada" ? "Jornada pausada" : "Tempo trabalhado"}
                  </p>
                  <p className={`text-6xl font-black mt-3 tabular-nums ${jornada.status === "pausada" ? "text-yellow-300" : "text-white"}`}>
                    {formatarTempo(tempoLiquidoSegundos)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {jornada.status === "pausada" ? (
                    <button
                      type="button"
                      onClick={continuarJornada}
                      disabled={salvando}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-black rounded-xl p-4 disabled:opacity-60"
                    >
                      Continuar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pausarJornada}
                      disabled={salvando}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-black rounded-xl p-4 disabled:opacity-60"
                    >
                      Pausar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={abrirFinalizacao}
                    disabled={salvando}
                    className="bg-red-500 hover:bg-red-600 text-white font-black rounded-xl p-4 disabled:opacity-60"
                  >
                    Finalizar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={zerarJornada}
                  disabled={salvando}
                  className="w-full border border-red-500/50 hover:bg-red-500/10 text-red-400 font-black rounded-xl p-4 disabled:opacity-60"
                >
                  Zerar Jornada
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmarZerarAberto && (
        <ModalConfirmacao
          titulo="Zerar Jornada"
          mensagem="Essa ação apagará a jornada atual e todas as pausas registradas. Depois disso, o cronômetro volta para iniciar do zero."
          textoCancelar="Cancelar"
          textoConfirmar={salvando ? "Zerando..." : "Zerar Jornada"}
          carregando={salvando}
          onCancelar={() => {
            if (!salvando) setConfirmarZerarAberto(false);
          }}
          onConfirmar={confirmarZerarJornada}
        />
      )}

      {aviso.aberto && (
        <ModalAviso
          aviso={aviso}
          onClose={() => setAviso({ aberto: false, titulo: "", mensagem: "", tipo: "erro" })}
        />
      )}
    </>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ResumoFinal({ jornada, onLancar, onDepois }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="bg-green-500/10 border border-green-500/40 rounded-2xl p-5 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-4xl">✓</div>
        <p className="text-green-400 font-black text-lg mt-4">Jornada encerrada</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Resumo titulo="Tempo trabalhado" valor={jornada.horas_trabalhadas} />
          <Resumo titulo="KM rodados" valor={`${Number(jornada.km_rodados || 0).toLocaleString("pt-BR")} km`} />
        </div>

        <p className="text-gray-300 text-sm mt-5">Deseja registrar os ganhos agora?</p>
      </div>

      <button
        type="button"
        onClick={onLancar}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-black rounded-xl p-4"
      >
        Sim, lançar agora!
      </button>

      <button
        type="button"
        onClick={onDepois}
        className="w-full border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-4"
      >
        Deixar para mais tarde
      </button>
    </div>
  );
}

function Resumo({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3 min-w-0">
      <p className="text-[11px] text-gray-500">{titulo}</p>
      <p className="text-lg font-black mt-1 truncate">{valor}</p>
    </div>
  );
}

function ModalConfirmacao({
  titulo,
  mensagem,
  textoCancelar,
  textoConfirmar,
  carregando,
  onCancelar,
  onConfirmar,
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[130] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
            <span className="text-2xl font-black">!</span>
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-black text-white">{titulo}</h2>
            <p className="text-gray-300 mt-3 text-sm leading-relaxed">{mensagem}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={carregando}
            className="w-full border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3 disabled:opacity-60"
          >
            {textoCancelar}
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-black rounded-xl p-3 disabled:opacity-60"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalAviso({ aviso, onClose }) {
  const erro = aviso.tipo === "erro";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <h2 className={`text-2xl font-black ${erro ? "text-red-400" : "text-green-400"}`}>{aviso.titulo}</h2>
        <p className="text-gray-300 mt-4">{aviso.mensagem}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-black rounded-xl p-3"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

