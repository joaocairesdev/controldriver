export default function DashboardHome({ paineis, abrirPainel }) {
  const cores = {
    green: "border-green-500/30 hover:border-green-400 bg-gradient-to-br from-green-500/10 to-[#111827] text-green-400",
    blue: "border-blue-500/30 hover:border-blue-400 bg-gradient-to-br from-blue-500/10 to-[#111827] text-blue-400",
    orange: "border-orange-500/30 hover:border-orange-400 bg-gradient-to-br from-orange-500/10 to-[#111827] text-orange-400",
    purple: "border-purple-500/30 hover:border-purple-400 bg-gradient-to-br from-purple-500/10 to-[#111827] text-purple-400",
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl sm:text-4xl font-black">Dashboard</h2>
        <p className="text-gray-400 mt-2">Escolha uma área para visualizar os indicadores do ControlDriver.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paineis.map(({ id, titulo, descricao, Icone, destaque }) => (
          <button
            key={id}
            type="button"
            onClick={() => abrirPainel(id)}
            className={`group min-h-[190px] rounded-3xl border p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${cores[destaque]}`}
          >
            <div className="w-12 h-12 rounded-2xl border border-current/25 bg-black/10 flex items-center justify-center">
              <Icone className="text-2xl" />
            </div>
            <h3 className="text-2xl font-black text-white mt-5">{titulo}</h3>
            <p className="text-sm sm:text-base leading-relaxed text-gray-400 mt-2 max-w-md">{descricao}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
