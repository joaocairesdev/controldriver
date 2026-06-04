import ModalBase from "./ModalBase";

export default function SelecionarContaModal({
  aberto,
  contas,
  contaId,
  onSelecionar,
  onClose,
  formatarMoeda,
}) {
  function moeda(valor) {
    if (formatarMoeda) return formatarMoeda(valor);

    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo="Selecionar conta"
      descricao="Escolha a conta usada neste pagamento."
      onClose={onClose}
    >
      <div className="space-y-3">
        {contas.map((conta) => {
          const ativo = String(contaId) === String(conta.id);
          const temSaldo = conta.saldo_atual !== undefined && conta.saldo_atual !== null;

          return (
            <button
              key={conta.id}
              type="button"
              onClick={() => {
                onSelecionar(String(conta.id));
                onClose();
              }}
              className={`w-full text-left rounded-xl border p-4 ${
                ativo
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{conta.nome}</p>
                  {conta.tipo_conta && (
                    <p className="text-xs text-gray-500 mt-1">
                      {conta.tipo_conta === "carteira"
                        ? "Carteira"
                        : conta.tipo_conta === "tag"
                        ? "TAG"
                        : "Banco"}
                    </p>
                  )}
                </div>

                {temSaldo && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Disponível</p>
                    <p
                      className={`font-bold ${
                        Number(conta.saldo_atual || 0) < 0
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {moeda(conta.saldo_atual)}
                    </p>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
