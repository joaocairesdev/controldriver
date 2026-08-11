export default function ContaFinanceiraCard({
  nome,
  tipo,
  saldo,
  badges = [],
  formatarMoeda,
  onClick,
  alerta = false,
  className = "",
}) {
  const saldoNegativo = Number(saldo || 0) < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-56 w-full rounded-2xl border p-5 text-left transition hover:border-green-400/60 hover:bg-white/[0.03] ${
        alerta || saldoNegativo
          ? "border-red-500/50 bg-red-500/10"
          : "border-gray-800 bg-[#111827]"
      } ${className}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-500/10 px-3 py-1 text-xs font-bold text-gray-300">
            {tipo}
          </span>
          {badges.map((badge) => (
            <span
              key={badge.texto}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.classe}`}
            >
              {badge.icone}
              {badge.texto}
            </span>
          ))}
        </div>

        <h3 className="mt-4 truncate text-xl font-black text-white">{nome}</h3>

        <div className="mt-auto border-t border-gray-800 pt-5">
          <p className="text-sm text-gray-400">Saldo atual</p>
          <p className={`mt-2 text-3xl font-black ${saldoNegativo ? "text-red-400" : "text-white"}`}>
            {formatarMoeda(saldo)}
          </p>
        </div>
      </div>
    </button>
  );
}
