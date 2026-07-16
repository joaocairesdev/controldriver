import { FiClock, FiMenu, FiSettings, FiX } from "react-icons/fi";

export default function Topbar({
  menuAberto,
  abrirMenu,
  abrirInicio,
  abrirCronometro,
  abrirConfiguracoes,
  cronometroStatus = "sem_jornada",
  cronometroTempo = "00:00:00",
  cronometroContagem = null,
}) {
  const cronometroAtivo = cronometroStatus === "em_andamento";
  const cronometroPausado = cronometroStatus === "pausada";
  const aguardandoKm = cronometroStatus === "aguardando_km";
  const iniciando = cronometroContagem !== null && cronometroContagem !== undefined;

  const textoCronometro = iniciando
    ? `00:00:0${cronometroContagem}`
    : cronometroAtivo || cronometroPausado || aguardandoKm
    ? cronometroTempo
    : "";

  const tituloCronometro = iniciando
    ? `Iniciando jornada em ${cronometroContagem}`
    : cronometroAtivo
    ? `Jornada em andamento: ${cronometroTempo}`
    : cronometroPausado
    ? `Jornada pausada: ${cronometroTempo}`
    : aguardandoKm
    ? `Jornada aguardando KM: ${cronometroTempo}`
    : "Abrir cronômetro de jornada";

  return (
    <header className="fixed top-0 left-0 right-0 md:landscape:left-72 lg:left-72 z-40 h-16 shrink-0 bg-[#111827] border-b border-gray-800 px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={abrirMenu}
          className="lg:hidden md:landscape:hidden w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white shrink-0"
          title="Abrir menu"
          aria-label="Abrir menu"
        >
          {menuAberto ? <FiX /> : <FiMenu />}
        </button>

        <button
          type="button"
          onClick={abrirInicio}
          className="flex items-center gap-2 min-w-0 rounded-xl hover:bg-white/5 transition px-1 py-1"
          title="Ir para o Dashboard"
          aria-label="Ir para o Dashboard"
        >
          <div className="h-9 px-2.5 rounded-xl bg-green-500/15 border border-green-500/40 flex items-center justify-center text-green-400 font-black text-sm shrink-0">
            CD
          </div>

          <h1 className="text-base sm:text-xl font-black tracking-tight truncate max-w-[150px] sm:max-w-none">
            <span className="text-white">Control</span>
            <span className="text-green-400">Driver</span>
          </h1>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={abrirCronometro}
          className={`h-10 rounded-xl border flex items-center justify-center gap-2 px-3 transition ${
            cronometroAtivo
              ? "border-green-500/50 bg-green-500/15 text-green-400"
              : cronometroPausado
              ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
              : aguardandoKm
              ? "border-red-500/50 bg-red-500/10 text-red-300"
              : "border-green-500/40 bg-green-500/10 hover:bg-green-500/20 text-green-400"
          }`}
          title={tituloCronometro}
          aria-label={tituloCronometro}
        >
          <FiClock className="text-lg shrink-0" />
          {textoCronometro ? (
            <span className="text-[11px] sm:text-xs font-black tabular-nums whitespace-nowrap">
              {textoCronometro}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={abrirConfiguracoes}
          className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white transition"
          title="Configurações"
          aria-label="Configurações"
        >
          <FiSettings />
        </button>
      </div>
    </header>
  );
}

