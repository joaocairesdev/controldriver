import { FiX } from "react-icons/fi";

export default function ModalBase({
  aberto,
  titulo,
  descricao,
  children,
  onClose,
  z = "z-[100]",
  largura = "max-w-lg",
  mostrarFechar = true,
  acaoCabecalho = null,
  rodape = null,
}) {
  if (!aberto) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center ${z} overscroll-none overflow-hidden`}
    >
      <div
        className={`w-full ${largura} max-h-[100dvh] sm:max-h-[88vh] bg-[#111827] border border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[subirModal_0.18s_ease-out]`}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gray-800">
          <div className="min-w-0">
            {titulo ? <h2 className="text-2xl font-bold">{titulo}</h2> : null}
            {descricao ? <p className="text-gray-400 mt-2">{descricao}</p> : null}
          </div>

          {(mostrarFechar && onClose) || acaoCabecalho ? (
            <div className="shrink-0 flex items-center gap-2">
{acaoCabecalho}

              {mostrarFechar && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <FiX className="w-5 h-5" />
                </button>
              ) : null}

              
            </div>
          ) : null}
        </div>

        <div
          data-scroll-container="true"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide p-5 sm:p-6 pb-28 sm:pb-6"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>

        {rodape ? (
          <div className="shrink-0 border-t border-gray-800 bg-[#111827] p-4 sm:p-5 pb-[max(env(safe-area-inset-bottom),1rem)]">
            {rodape}
          </div>
        ) : null}
      </div>
    </div>
  );
}
