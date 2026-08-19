import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";

function normalizarRodapeLegado(elemento) {
  return cloneElement(elemento, {
    className: String(elemento.props.className)
      .replace(/\bsticky\b|\bbottom-0\b|\bz-\d+\b|\bbg-\[#[0-9A-Fa-f]+\]\b|\bmt-6\b|\b-?mx-\d+\b|\bpt-4\b|\bpb-1\b/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  });
}

function extrairRodapeLegado(children) {
  const filhos = Children.toArray(children);
  const ultimo = filhos.at(-1);
  if (!isValidElement(ultimo)) return { conteudo: filhos, rodape: null };

  if (String(ultimo.props?.className || "").includes("sticky bottom-0")) {
    return { conteudo: filhos.slice(0, -1), rodape: normalizarRodapeLegado(ultimo) };
  }

  if (ultimo.props?.children) {
    const resultadoInterno = extrairRodapeLegado(ultimo.props.children);
    if (resultadoInterno.rodape) {
      return {
        conteudo: [
          ...filhos.slice(0, -1),
          cloneElement(ultimo, {}, resultadoInterno.conteudo),
        ],
        rodape: resultadoInterno.rodape,
      };
    }
  }

  return { conteudo: filhos, rodape: null };
}

export default function ModalBase({
  aberto,
  titulo,
  descricao,
  children,
  onClose,
  onRequestClose,
  z = "z-[100]",
  largura = "max-w-lg",
  backdrop = "bg-black/70",
  mostrarFechar = true,
  acaoCabecalho = null,
  rodape = null,
  fecharAoClicarFora = true,
  fecharComEsc = true,
  scrollKey = null,
  confirmarAoFecharSeAlterado = false,
  isDirty = false,
  tituloConfirmacao = "Cancelar operação?",
  mensagemConfirmacao = "As informações preenchidas serão perdidas.",
  textoCancelarConfirmacao = "Continuar editando",
  textoConfirmarConfirmacao = "Sim, cancelar",
}) {
  const conteudoRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const [alteradoInternamente, setAlteradoInternamente] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);

  const estruturaLegada = extrairRodapeLegado(children);
  const conteudoCentral = estruturaLegada.conteudo;
  const rodapeEfetivo = rodape || estruturaLegada.rodape;

  const temAlteracao = Boolean(isDirty || alteradoInternamente);

  const fecharDireto = () => {
    setConfirmacaoAberta(false);
    setAlteradoInternamente(false);

    if (onRequestClose) {
      onRequestClose();
      return;
    }

    if (onClose) {
      onClose();
    }
  };

  const solicitarFechamento = () => {
    if (confirmarAoFecharSeAlterado && temAlteracao) {
      setConfirmacaoAberta(true);
      return;
    }

    fecharDireto();
  };

  useEffect(() => {
    if (!aberto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlteradoInternamente(false);
      setConfirmacaoAberta(false);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const overflowAnterior = document.body.style.overflow;
    const overscrollAnterior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.body.style.overscrollBehavior = overscrollAnterior;
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto || scrollKey === null || scrollKey === undefined) return;

    requestAnimationFrame(() => {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [aberto, scrollKey]);

  useEffect(() => {
    if (!aberto || !fecharComEsc) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        solicitarFechamento();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // solicitarFechamento reflete as opções já listadas abaixo sem rearmar o listener a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, fecharComEsc, confirmarAoFecharSeAlterado, temAlteracao, onClose, onRequestClose]);

  if (!aberto) return null;

  return (
    <div
      className={`fixed inset-0 ${backdrop} flex items-end sm:items-center justify-center ${z} overscroll-none overflow-hidden px-0 sm:px-4 pb-0 sm:py-4`}
      onMouseDown={(event) => {
        if (!fecharAoClicarFora) return;
        if (event.target === event.currentTarget) {
          solicitarFechamento();
        }
      }}
    >
      <div
        ref={conteudoRef}
        className={`w-full ${largura} max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] bg-[#111827] border border-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[subirModal_0.18s_ease-out]`}
        style={{ scrollbarWidth: "none" }}
        onMouseDown={(event) => event.stopPropagation()}
        onInputCapture={() => {
          if (confirmarAoFecharSeAlterado) setAlteradoInternamente(true);
        }}
        onChangeCapture={() => {
          if (confirmarAoFecharSeAlterado) setAlteradoInternamente(true);
        }}
        onFocusCapture={(event) => {
          requestAnimationFrame(() => event.target.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        }}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-gray-800">
          <div className="min-w-0">
            {titulo ? <h2 className="text-2xl font-bold">{titulo}</h2> : null}
            {descricao ? <p className="text-gray-400 mt-2">{descricao}</p> : null}
          </div>

          {(mostrarFechar && (onClose || onRequestClose)) || acaoCabecalho ? (
            <div className="shrink-0 flex items-center gap-2">
              {acaoCabecalho}

              {mostrarFechar && (onClose || onRequestClose) ? (
                <button
                  type="button"
                  onClick={solicitarFechamento}
                  className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <FiX className="w-5 h-5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          ref={scrollAreaRef}
          data-scroll-container="true"
          className="modal-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide p-5 sm:p-6 scroll-pb-6"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {conteudoCentral}
        </div>

        {rodapeEfetivo ? (
          <div className="shrink-0 border-t border-gray-800 bg-[#111827] p-4 sm:p-5 pb-[max(env(safe-area-inset-bottom),1rem)]">
            {rodapeEfetivo}
          </div>
        ) : null}
      </div>

      {confirmacaoAberta ? (
        <div
          className="fixed inset-0 z-[999] bg-black/70 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl p-5 sm:p-6">
            <h2 className="text-2xl font-bold text-yellow-400">{tituloConfirmacao}</h2>
            <p className="text-gray-300 mt-3 leading-relaxed">{mensagemConfirmacao}</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => setConfirmacaoAberta(false)}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                {textoCancelarConfirmacao}
              </button>

              <button
                type="button"
                onClick={fecharDireto}
                className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl p-3"
              >
                {textoConfirmarConfirmacao}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
