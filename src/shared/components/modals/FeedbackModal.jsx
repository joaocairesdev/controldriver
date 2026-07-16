import { FiAlertTriangle, FiCheckCircle, FiXCircle } from "react-icons/fi";

export default function FeedbackModal({
  aberto,
  tipo = "sucesso",
  titulo,
  mensagem,
  onClose,
  textoBotao = "Entendi",
}) {
  if (!aberto) return null;

  const isErro = tipo === "erro";
  const isAviso = tipo === "aviso";

  const Icone = isErro ? FiXCircle : isAviso ? FiAlertTriangle : FiCheckCircle;

  const estilos = isErro
    ? {
        corIcone: "text-red-400 bg-red-500/10",
        corTitulo: "text-red-400",
        corBotao: "bg-red-500 hover:bg-red-600 text-white",
      }
    : isAviso
    ? {
        corIcone: "text-yellow-400 bg-yellow-500/10",
        corTitulo: "text-yellow-400",
        corBotao: "bg-yellow-500 hover:bg-yellow-600 text-black",
      }
    : {
        corIcone: "text-green-400 bg-green-500/10",
        corTitulo: "text-green-400",
        corBotao: "bg-green-500 hover:bg-green-600 text-black",
      };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4 overscroll-none">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-2xl animate-[subirModal_0.18s_ease-out]">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${estilos.corIcone}`}
        >
          <Icone className="w-7 h-7" />
        </div>

        {titulo ? (
          <h2 className={`text-2xl font-bold mt-5 ${estilos.corTitulo}`}>
            {titulo}
          </h2>
        ) : null}

        {mensagem ? <p className="text-gray-300 mt-3">{mensagem}</p> : null}

        <button
          type="button"
          onClick={onClose}
          className={`w-full mt-6 font-bold rounded-xl p-3 ${estilos.corBotao}`}
        >
          {textoBotao}
        </button>
      </div>
    </div>
  );
}

