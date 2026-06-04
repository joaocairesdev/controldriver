import ModalBase from "./ModalBase";

export default function SelecionarCategoriaModal({
  aberto,
  categorias,
  categoria,
  onSelecionar,
  onClose,
}) {
  return (
    <ModalBase aberto={aberto} titulo="Selecionar categoria" descricao="Escolha o tipo de saída." onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categorias.map((item) => {
          const ativo = categoria === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                onSelecionar(item);
                onClose();
              }}
              className={`text-left rounded-xl border p-4 font-bold ${
                ativo
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
