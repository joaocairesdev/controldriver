import { useEffect, useState } from "react";

export default function PlataformaEntradaModal({
  aberto,
  plataforma,
  dadosIniciais,
  onClose,
  onSalvar,
}) {
  const [faturamento, setFaturamento] = useState("");
  const [numeroCorridas, setNumeroCorridas] = useState("");
  const [houvePedagio, setHouvePedagio] = useState(false);
  const [valorReembolso, setValorReembolso] = useState("");

  useEffect(() => {
    if (!aberto) return;

    setFaturamento(dadosIniciais?.faturamento || "");
    setNumeroCorridas(dadosIniciais?.numero_corridas || "");
    setHouvePedagio(dadosIniciais?.houve_pedagio || false);
    setValorReembolso(dadosIniciais?.valor_reembolso || "");
  }, [aberto, dadosIniciais]);

  if (!aberto || !plataforma) return null;

  function formatarMoedaDigitada(valor) {
    return String(valor)
      .replace(/[^\d,]/g, "")
      .replace(/,+/g, ",")
      .replace(/^,/, "")
      .replace(/(,\d{2}).+/, "$1");
  }

  function formatarInteiro(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(",", "."));
  }

  function salvar() {
    if (moedaParaNumero(faturamento) <= 0) {
      alert("Informe o faturamento da plataforma.");
      return;
    }

    if (Number(numeroCorridas || 0) <= 0) {
      alert("Informe o número de corridas.");
      return;
    }

    if (houvePedagio && moedaParaNumero(valorReembolso) <= 0) {
      alert("Informe o valor do reembolso de pedágio.");
      return;
    }

    onSalvar({
      id: plataforma.id,
      nome: plataforma.nome,
      faturamento,
      numero_corridas: numeroCorridas,
      houve_pedagio: houvePedagio,
      valor_reembolso: houvePedagio ? valorReembolso : "",
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80]">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{plataforma.nome}</h2>

            <p className="text-gray-400 mt-2">
              Informe os ganhos e corridas desta plataforma.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="text-sm text-gray-300">Faturamento</label>

            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>

              <input
                type="text"
                inputMode="decimal"
                value={faturamento}
                placeholder="0,00"
                onChange={(e) =>
                  setFaturamento(formatarMoedaDigitada(e.target.value))
                }
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Número de Corridas</label>

            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                value={numeroCorridas}
                placeholder="0"
                onChange={(e) =>
                  setNumeroCorridas(formatarInteiro(e.target.value))
                }
                className="w-full bg-transparent p-3 outline-none"
              />

              <span className="px-3 text-gray-400">corridas</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm text-gray-300">
            Houve reembolso de pedágio?
          </label>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => setHouvePedagio(true)}
              className={`rounded-xl p-3 font-bold border ${
                houvePedagio
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-gray-300"
              }`}
            >
              Sim
            </button>

            <button
              type="button"
              onClick={() => {
                setHouvePedagio(false);
                setValorReembolso("");
              }}
              className={`rounded-xl p-3 font-bold border ${
                !houvePedagio
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 bg-[#0B1120] text-gray-300"
              }`}
            >
              Não
            </button>
          </div>
        </div>

        {houvePedagio && (
          <div className="mt-5">
            <label className="text-sm text-gray-300">
              Valor do reembolso de pedágio
            </label>

            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>

              <input
                type="text"
                inputMode="decimal"
                value={valorReembolso}
                placeholder="0,00"
                onChange={(e) =>
                  setValorReembolso(formatarMoedaDigitada(e.target.value))
                }
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Salvar Plataforma
          </button>
        </div>
      </div>
    </div>
  );
}
