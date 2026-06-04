import ModalBase from "./ModalBase";

export default function SelecionarFormaPagamentoModal({
  aberto,
  formasPagamento,
  formaPagamento,
  onSelecionar,
  onClose,
}) {
  return (
    <ModalBase
      aberto={aberto}
      titulo="Forma de pagamento"
      descricao="Escolha como essa saída foi paga."
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {formasPagamento.map((item) => {
          const ativo = formaPagamento === item.valor;

          return (
            <button
              key={item.valor}
              type="button"
              onClick={() => {
                onSelecionar(item.valor);
                onClose();
              }}
              className={`text-left rounded-xl border p-4 transition ${
                ativo
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              <p className="font-bold">{item.titulo}</p>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
