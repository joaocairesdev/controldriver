import { useEffect, useState } from "react";

import ModalBase from "./ModalBase";
import FeedbackModal from "./FeedbackModal";

import {
  formatarMoedaDigitada,
  moedaParaNumero,
  somenteNumeros,
} from "../../utils/moeda";

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

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  useEffect(() => {
    if (!aberto) return;

    setFaturamento(dadosIniciais?.faturamento || "");
    setNumeroCorridas(dadosIniciais?.numero_corridas || "");
    setHouvePedagio(dadosIniciais?.houve_pedagio || false);
    setValorReembolso(dadosIniciais?.valor_reembolso || "");
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }, [aberto, dadosIniciais]);

  if (!aberto || !plataforma) return null;

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function salvar() {
    if (moedaParaNumero(faturamento) <= 0) {
      abrirFeedback("erro", "Faturamento obrigatório", "Informe o faturamento da plataforma.");
      return;
    }

    if (numeroCorridas === "") {
      abrirFeedback(
        "erro",
        "Corridas obrigatórias",
        "Informe o número de corridas. Use 0 se foi apenas ajuste de valor."
      );
      return;
    }

    if (Number(numeroCorridas || 0) < 0) {
      abrirFeedback("erro", "Corridas inválidas", "O número de corridas não pode ser negativo.");
      return;
    }

    if (houvePedagio && moedaParaNumero(valorReembolso) <= 0) {
      abrirFeedback("erro", "Reembolso obrigatório", "Informe o valor do reembolso de pedágio.");
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

    onClose?.();
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={plataforma.nome}
        descricao="Informe os ganhos e corridas desta plataforma."
        onClose={onClose}
        largura="max-w-lg"
        z="z-[120]"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Faturamento">
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>

              <input
                type="text"
                inputMode="numeric"
                value={faturamento}
                placeholder=""
                onChange={(e) => setFaturamento(formatarMoedaDigitada(e.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </Campo>

          <Campo label="Número de Corridas">
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                value={numeroCorridas}
                placeholder=""
                onChange={(e) => setNumeroCorridas(somenteNumeros(e.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />

              <span className="px-3 text-gray-400">corridas</span>
            </div>
          </Campo>
        </div>

        <div className="mt-5">
          <label className="text-sm text-gray-300">Houve reembolso de pedágio?</label>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <Toggle ativo={houvePedagio} onClick={() => setHouvePedagio(true)}>
              Sim
            </Toggle>

            <Toggle
              ativo={!houvePedagio}
              onClick={() => {
                setHouvePedagio(false);
                setValorReembolso("");
              }}
            >
              Não
            </Toggle>
          </div>
        </div>

        {houvePedagio && (
          <Campo label="Valor do reembolso de pedágio">
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>

              <input
                type="text"
                inputMode="numeric"
                value={valorReembolso}
                placeholder=""
                onChange={(e) => setValorReembolso(formatarMoedaDigitada(e.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </Campo>
        )}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
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
            Salvar
          </button>
        </div>
      </ModalBase>

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </>
  );
}

function Campo({ label, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <label className="text-sm text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-3 font-bold border ${
        ativo
          ? "border-green-400 bg-green-500/10 text-green-400"
          : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
