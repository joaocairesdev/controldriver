import { FiBell, FiClock, FiMenu, FiSettings, FiUser, FiX } from "react-icons/fi";

export default function Topbar({
  menuAberto,
  abrirMenu,
  abrirCronometro,
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
    <header className="h-16 shrink-0 bg-[#111827] border-b border-gray-800 px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={abrirMenu}
          className="lg:hidden w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white shrink-0"
          title="Abrir menu"
          aria-label="Abrir menu"
        >
          {menuAberto ? <FiX /> : <FiMenu />}
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 px-2.5 rounded-xl bg-green-500/15 border border-green-500/40 flex items-center justify-center text-green-400 font-black text-sm shrink-0">
            CD
          </div>

          <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
            <span className="text-white">Control</span>
            <span className="text-green-400">Driver</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
            <span className="text-xs font-black tabular-nums whitespace-nowrap">
              {textoCronometro}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="relative w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white transition"
          title="Notificações"
          aria-label="Notificações"
        >
          <FiBell />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button
          type="button"
          className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white transition"
          title="Configurações"
          aria-label="Configurações"
        >
          <FiSettings />
        </button>

        <button
          type="button"
          className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-gray-300 hover:text-white transition"
          title="Perfil"
          aria-label="Perfil"
        >
          <FiUser />
        </button>
      </div>
    </header>
  );
}
