import { FiFileText, FiHome, FiPlusCircle } from "react-icons/fi";

export default function MobileBottomNav({ paginaAtual, setPagina }) {
  const itens = [
    { nome: "Início", pagina: "dashboard", icone: <FiHome /> },
    { nome: "Novo", pagina: "novo-lancamento", icone: <FiPlusCircle />, destaque: true },
    { nome: "Extrato", pagina: "extrato", icone: <FiFileText /> },
  ];

  return (
    <nav className="lg:hidden fixed left-1/2 -translate-x-1/2 bottom-3 z-40 w-[min(92vw,390px)] rounded-3xl border border-gray-800 bg-[#111827]/95 backdrop-blur px-3 py-2 shadow-2xl">
      <div className="grid grid-cols-3 items-center gap-2">
        {itens.map((item) => {
          const ativo = paginaAtual === item.pagina;

          return (
            <button
              key={item.pagina}
              type="button"
              onClick={() => setPagina(item.pagina)}
              className={`flex flex-col items-center justify-center rounded-2xl transition ${
                item.destaque
                  ? "-mt-7"
                  : "py-2"
              }`}
            >
              <span
                className={`flex items-center justify-center ${
                  item.destaque
                    ? "w-14 h-14 rounded-2xl bg-green-500 text-black text-2xl shadow-lg shadow-green-500/20"
                    : `w-10 h-8 text-xl ${
                        ativo ? "text-green-400" : "text-gray-400"
                      }`
                }`}
              >
                {item.icone}
              </span>

              <span
                className={`text-[11px] font-bold mt-1 ${
                  ativo ? "text-green-400" : "text-gray-500"
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
