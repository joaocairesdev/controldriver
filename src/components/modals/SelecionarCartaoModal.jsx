import ModalBase from "./ModalBase";
import { isCartaoTerceiro, detalheCartao } from "../../cartoes/cartoesUtils";

export default function SelecionarCartaoModal({
  aberto,
  cartoes,
  cartaoId,
  onSelecionar,
  onClose,
  formatarMoeda,
}) {
  return (
    <ModalBase aberto={aberto} titulo="Selecionar cartão" descricao="Escolha o cartão para este lançamento." onClose={onClose}>
      <div className="space-y-3">
        {cartoes.map((cartao) => {
          const ativo = String(cartaoId) === String(cartao.id);
          const terceiro = isCartaoTerceiro(cartao);
          const limite = Number(cartao.limite_total || 0);
          const usado = Number(cartao.usado || 0);
          const disponivel = limite - usado;

          return (
            <button
              key={cartao.id}
              type="button"
              onClick={() => {
                onSelecionar(String(cartao.id));
                onClose();
              }}
              className={`w-full text-left rounded-2xl border p-5 transition ${
                ativo
                  ? "border-green-400 bg-green-500/10"
                  : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`text-lg font-bold ${ativo ? "text-green-400" : "text-white"}`}>
                    {cartao.nome}
                  </h3>
                  {!terceiro && <p className="text-sm text-gray-400 mt-1">{detalheCartao(cartao)}</p>}
                </div>

                {!terceiro && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Disponível</p>
                    <p className={`text-lg font-bold ${disponivel < 0 ? "text-red-400" : "text-green-400"}`}>
                      {formatarMoeda(disponivel)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                {!terceiro && <span>Limite {formatarMoeda(limite)}</span>}
                <span>Vence dia {cartao.dia_vencimento}</span>
              </div>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
