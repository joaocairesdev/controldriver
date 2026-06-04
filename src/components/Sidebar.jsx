import {
  FiPlusCircle,
  FiHome,
  FiFileText,
  FiTarget,
  FiCreditCard,
  FiBriefcase,
  FiTruck,
  FiAlertTriangle,
} from "react-icons/fi";

export default function Sidebar({ setPagina, paginaAtual }) {
  const menu = [
    {
      nome: "Novo Lançamento",
      pagina: "novo-lancamento",
      icone: <FiPlusCircle />,
      ativoExtra: [
        "nova-entrada",
        "venda-produtos",
        "transferencia",
        "nova-saida",
        "novo-abastecimento",
        "nova-manutencao",
        "nova-alimentacao",
        "novo-uso-tag",
        "novo-impostos",
        "nova-outra-saida",
      ],
    },
    {
      nome: "Dashboard",
      pagina: "dashboard",
      icone: <FiHome />,
    },
    {
      nome: "Extrato",
      pagina: "extrato",
      icone: <FiFileText />,
    },
    {
      nome: "Contas a Pagar",
      pagina: "contas-pagar",
      icone: <FiAlertTriangle />,
    },
    {
      nome: "Metas",
      pagina: "metas",
      icone: <FiTarget />,
    },
    {
      nome: "Contas",
      pagina: "contas",
      icone: <FiBriefcase />,
    },
    {
      nome: "Cartões",
      pagina: "cartoes",
      icone: <FiCreditCard />,
    },
    {
      nome: "Veículos",
      pagina: "veiculos",
      icone: <FiTruck />,
    },
  ];

  function itemAtivo(item) {
    return paginaAtual === item.pagina || item.ativoExtra?.includes(paginaAtual);
  }

  return (
    <aside className="w-72 h-full min-h-screen bg-[#111827] border-r border-gray-800 p-6 flex flex-col">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center text-green-400 font-black">
          J
        </div>

        <div className="min-w-0">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Bem-vindo</p>
          <p className="text-white text-sm font-black truncate">Olá, João! 👋</p>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-700 my-6" />

      <nav className="space-y-2">
        {menu.map((item) => {
          const ativo = itemAtivo(item);

          return (
            <button
              key={item.nome}
              onClick={() => setPagina(item.pagina)}
              title={item.nome}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition font-semibold ${
                ativo
                  ? "bg-green-500 text-black"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icone}</span>
              <span>{item.nome}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
