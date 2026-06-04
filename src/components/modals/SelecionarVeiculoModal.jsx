import ModalBase from "./ModalBase";

export default function SelecionarVeiculoModal({
  aberto,
  veiculos,
  veiculoId,
  onSelecionar,
  onClose,
}) {
  return (
    <ModalBase aberto={aberto} titulo="Selecionar veículo" descricao="Escolha o veículo deste lançamento." onClose={onClose}>
      <div className="space-y-3">
        {veiculos.map((veiculo) => {
          const ativo = String(veiculoId) === String(veiculo.id);

          return (
            <button
              key={veiculo.id}
              type="button"
              onClick={() => {
                onSelecionar(String(veiculo.id));
                onClose();
              }}
              className={`w-full text-left rounded-xl border p-4 ${
                ativo
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
              }`}
            >
              <p className="font-bold">{veiculo.nome}</p>
              <p className="text-xs text-gray-400 mt-1">
                Odômetro atual: {Number(veiculo.odometro_atual || 0).toLocaleString("pt-BR")} km
              </p>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}
