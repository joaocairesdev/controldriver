import { useState } from "react";
import ModalBase from "./ModalBase";
import FeedbackModal from "./FeedbackModal";

export default function SelecionarParcelasModal({
  aberto,
  numeroParcelas,
  onSelecionar,
  onClose,
}) {
  const [mostrarOutra, setMostrarOutra] = useState(false);
  const [valorManual, setValorManual] = useState("");
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "erro",
    titulo: "",
    mensagem: "",
  });

  const parcelas = Array.from({ length: 11 }, (_, index) => index + 2);

  function confirmarManual() {
    const numero = Number(valorManual);

    if (!numero || numero < 2) {
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Parcelas inválidas",
        mensagem: "Informe uma quantidade válida de parcelas.",
      });
      return;
    }

    onSelecionar(String(numero));
    setValorManual("");
    setMostrarOutra(false);
    onClose();
  }

  return (
    <>
      <ModalBase
      aberto={aberto}
      titulo="Quantidade de parcelas"
      descricao="Escolha em quantas vezes foi feita a compra."
      onClose={onClose}
    >
      {!mostrarOutra ? (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {parcelas.map((parcela) => {
              const ativo = Number(numeroParcelas) === parcela;

              return (
                <button
                  key={parcela}
                  type="button"
                  onClick={() => {
                    onSelecionar(String(parcela));
                    onClose();
                  }}
                  className={`rounded-xl border p-4 font-bold transition ${
                    ativo
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {parcela}x
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMostrarOutra(true)}
              className="rounded-xl border border-blue-500 bg-blue-500/10 text-blue-400 font-bold p-4 hover:bg-blue-500/20 transition"
            >
              Outra
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">
              Quantidade de parcelas
            </label>

            <input
              type="number"
              min="2"
              value={valorManual}
              onChange={(e) => setValorManual(e.target.value)}
              placeholder="Ex: 48"
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMostrarOutra(false);
                setValorManual("");
              }}
              className="border border-gray-700 rounded-xl p-3 font-bold hover:bg-white/5"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={confirmarManual}
              className="bg-green-500 hover:bg-green-600 text-black rounded-xl p-3 font-bold"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
      </ModalBase>

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={() =>
          setFeedback({ aberto: false, tipo: "erro", titulo: "", mensagem: "" })
        }
      />
    </>
  );
}
