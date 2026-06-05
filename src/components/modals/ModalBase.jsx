export default function ModalBase({
  aberto,
  titulo,
  descricao,
  children,
  onClose,
  z = "z-[100]",
  largura = "max-w-lg",
}) {
  if (!aberto) return null;

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center ${z} overscroll-none`}>
      <div
        className={`w-full ${largura} max-h-[calc(100dvh-4rem)] md:landscape:max-h-[88vh] sm:max-h-[88vh] bg-[#111827] border border-gray-800 rounded-t-3xl md:landscape:rounded-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[subirModal_0.18s_ease-out]`}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gray-800">
          <div className="min-w-0">
            {titulo ? <h2 className="text-2xl font-bold">{titulo}</h2> : null}
            {descricao && <p className="text-gray-400 mt-2">{descricao}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shrink-0"
          >
            ×
          </button>
        </div>

        <div data-scroll-container="true" className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide p-5 sm:p-6" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
