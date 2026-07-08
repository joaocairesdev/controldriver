import { FiTrash2 } from "react-icons/fi";

export default function AbasCartao({
  itens = [],
  ativoId,
  onSelecionar,
  onAdicionar,
  onExcluirAba,
  onEditarAba,
  podeExcluirAba,
  tituloAdicionar = "+",
  titleAdicionar = "Adicionar",
  painelClassName = "",
  children,
}) {
  return (
    <div className="flex flex-col min-h-0">
      <style>{`
        .cd-abas-cartao-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .cd-abas-cartao-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .cd-aba-cartao { min-width: 64px; }
        .cd-aba-cartao + .cd-aba-cartao { margin-left: -1px; }
        .cd-aba-cartao-ativa { width: 196px; min-width: 196px; max-width: 196px; }
        .cd-aba-cartao-inativa { flex: 1 1 152px; max-width: 152px; min-width: 64px; }
        @keyframes cdTrocaAbaCartao {
          from { opacity: .55; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cd-painel-aba-cartao-ativo { animation: cdTrocaAbaCartao .16s ease-out; }
      `}</style>

      <div className="cd-abas-cartao-scroll shrink-0 flex items-end overflow-hidden pr-1">
        {itens.map((item) => {
          const ativo = item.id === ativoId;
          const podeExcluir = typeof podeExcluirAba === "function" ? podeExcluirAba(item) : !!podeExcluirAba;

          return (
            <div
              key={item.id}
              className={`cd-aba-cartao h-10 sm:h-11 rounded-t-xl border border-b-0 text-sm sm:text-base font-bold whitespace-nowrap transition flex items-center overflow-hidden ${
                ativo
                  ? "cd-aba-cartao-ativa bg-[#0B1120] border-green-500/70 border-b-[#0B1120] text-green-400 -mb-px relative z-20 shadow-[0_-1px_0_rgba(34,197,94,0.35)]"
                  : "cd-aba-cartao-inativa bg-[#111827] border-gray-800 text-gray-500 hover:text-white hover:bg-[#0B1120] relative z-0"
              }`}
              title={item.title || item.titulo}
            >
              <button
                type="button"
                onClick={() => {
                  if (ativo && onEditarAba) onEditarAba(item);
                  else onSelecionar?.(item.id, item);
                }}
                className={`h-full min-w-0 flex-1 px-3 sm:px-4 flex flex-col items-center justify-center overflow-hidden transition ${
                  ativo ? "hover:bg-green-500/10 hover:text-green-300 cursor-pointer" : "hover:cursor-pointer"
                }`}
              >
                <span className="block truncate max-w-full">{item.titulo}</span>
                {item.subtitulo ? <span className="block truncate max-w-full text-[11px] leading-3 opacity-70">{item.subtitulo}</span> : null}
              </button>

              {ativo && podeExcluir && onExcluirAba ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExcluirAba(item.id, item);
                  }}
                  className="h-full px-3 text-red-400 hover:bg-red-500/10 border-l border-gray-800"
                  title="Excluir"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          );
        })}

        {onAdicionar ? (
          <button
            type="button"
            onClick={onAdicionar}
            className="h-10 sm:h-11 px-4 rounded-t-xl border border-b-0 border-gray-800 bg-[#111827] text-green-400 hover:bg-green-500/10 font-bold whitespace-nowrap text-base flex-none -ml-px"
            title={titleAdicionar}
          >
            {tituloAdicionar}
          </button>
        ) : null}
      </div>

      <div className={`cd-painel-aba-cartao-ativo bg-[#0B1120] border border-gray-800 rounded-b-2xl rounded-tr-2xl p-4 min-h-0 ${painelClassName}`}>
        {children}
      </div>
    </div>
  );
}
