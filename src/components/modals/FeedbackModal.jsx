import ModalBase from "./ModalBase";

export default function FeedbackModal({
  aberto,
  tipo = "sucesso",
  titulo,
  mensagem,
  onClose,
}) {
  if (!aberto) return null;

  const isErro = tipo === "erro";
  const isAviso = tipo === "aviso";

  const cor = isErro
    ? "text-red-400 bg-red-500/10"
    : isAviso
    ? "text-yellow-400 bg-yellow-500/10"
    : "text-green-400 bg-green-500/10";

  return (
    <ModalBase aberto={aberto} titulo="" onClose={onClose} z="z-[70]" largura="max-w-md">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${cor}`}>
        {isErro ? "!" : isAviso ? "?" : "✓"}
      </div>

      <h2 className={`text-2xl font-bold mt-5 ${isErro ? "text-red-400" : isAviso ? "text-yellow-400" : "text-green-400"}`}>
        {titulo}
      </h2>

      <p className="text-gray-300 mt-3">{mensagem}</p>

      <button
        type="button"
        onClick={onClose}
        className="w-full mt-6 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
      >
        Entendi
      </button>
    </ModalBase>
  );
}
