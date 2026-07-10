import ModalBase from "./ModalBase";

const TIPOS_ACORDO = [
  { valor: "avista", titulo: "À vista" },
  { valor: "entrada_avista", titulo: "Entrada + à vista" },
  { valor: "parcelado", titulo: "Parcelado" },
  { valor: "entrada_parcelado", titulo: "Entrada + parcelas" },
];

export default function SelecionarTipoAcordoModal({ aberto, tipoAcordo, onSelecionar, onClose }) {
  return (
    <ModalBase
      aberto={aberto}
      titulo="Tipo do acordo"
      descricao="Escolha como esse acordo será pago."
      onClose={onClose}
      z="z-[300]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIPOS_ACORDO.map((tipo) => {
          const ativo = tipoAcordo === tipo.valor;

          return (
            <button
              key={tipo.valor}
              type="button"
              onClick={() => {
                onSelecionar?.(tipo.valor);
                onClose?.();
              }}
              className={`text-left rounded-xl border p-4 transition ${
                ativo
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              <p className="font-bold">{tipo.titulo}</p>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
