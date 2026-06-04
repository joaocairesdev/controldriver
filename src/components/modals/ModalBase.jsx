export default function ModalBase({
  aberto,
  titulo,
  descricao,
  children,
  onClose,
  z = "z-90",
  largura = "max-w-lg",
}) {
  if (!aberto) return null;

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center ${z}`}>
      <div
        className={`w-full ${largura} max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide`}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">{titulo}</h2>
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

        {children}
      </div>
    </div>
  );
}
