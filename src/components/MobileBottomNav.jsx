import { FiFileText, FiHome, FiPlusCircle } from "react-icons/fi";

export default function MobileBottomNav({ paginaAtual, setPagina }) {
  const itens = [
    { nome: "Início", pagina: "dashboard", icone: <FiHome /> },
    {
      nome: "Novo",
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
    { nome: "Extrato", pagina: "extrato", icone: <FiFileText /> },
  ];

  return (
    <nav className="lg:hidden md:landscape:hidden fixed left-0 right-0 bottom-0 z-30 border-t border-gray-800 bg-[#111827] pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-2xl">
      <div className="grid grid-cols-3 items-center">
        {itens.map((item, index) => {
          const ativo = paginaAtual === item.pagina || item.ativoExtra?.includes(paginaAtual);

          return (
            <button
              key={item.pagina}
              type="button"
              onClick={() => setPagina(item.pagina)}
              className={`min-h-[60px] flex flex-col items-center justify-center gap-1 px-2 transition ${
                index > 0 ? "border-l border-gray-800" : ""
              } ${
                ativo ? "text-green-400" : "text-gray-400"
              }`}
            >
              <span
                className={`text-xl shrink-0 ${
                  ativo ? "text-green-400" : ""
                }`}
              >
                {item.icone}
              </span>

              <span
                className={`text-xs font-black ${
                  ativo ? "text-green-400" : ""
                }`}
              >
                {item.nome}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
