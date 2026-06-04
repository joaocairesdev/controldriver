import ModalBase from "./ModalBase";

export default function ConfirmacaoModal({
  aberto,
  tipo = "aviso",
  titulo = "Confirmar ação",
  mensagem = "Tem certeza que deseja continuar?",
  textoCancelar = "Cancelar",
  textoConfirmar = "Confirmar",
  carregando = false,
  onCancelar,
  onConfirmar,
}) {
  if (!aberto) return null;

  const isPerigo = tipo === "perigo" || tipo === "erro";
  const isSucesso = tipo === "sucesso";

  const estilos = isPerigo
    ? {
        icone: "!",
        iconeClasse: "text-red-400 bg-red-500/10",
        tituloClasse: "text-red-400",
        botaoClasse: "bg-red-500 hover:bg-red-600 text-white",
      }
    : isSucesso
    ? {
        icone: "✓",
        iconeClasse: "text-green-400 bg-green-500/10",
        tituloClasse: "text-green-400",
        botaoClasse: "bg-green-500 hover:bg-green-600 text-black",
      }
    : {
        icone: "?",
        iconeClasse: "text-yellow-400 bg-yellow-500/10",
        tituloClasse: "text-yellow-400",
        botaoClasse: "bg-yellow-500 hover:bg-yellow-600 text-black",
      };

  return (
    <ModalBase aberto={aberto} titulo="" onClose={onCancelar} z="z-[80]" largura="max-w-md">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${estilos.iconeClasse}`}
      >
        {estilos.icone}
      </div>

      <h2 className={`text-2xl font-bold mt-5 ${estilos.tituloClasse}`}>
        {titulo}
      </h2>

      <p className="text-gray-300 mt-3 leading-relaxed">{mensagem}</p>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <button
          type="button"
          onClick={onCancelar}
          disabled={carregando}
          className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3 disabled:opacity-50"
        >
          {textoCancelar}
        </button>

        <button
          type="button"
          onClick={onConfirmar}
          disabled={carregando}
          className={`${estilos.botaoClasse} font-bold rounded-xl p-3 disabled:opacity-50`}
        >
          {textoConfirmar}
        </button>
      </div>
    </ModalBase>
  );
}
