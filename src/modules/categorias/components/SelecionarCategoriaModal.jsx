// src/components/modals/SelecionarCategoriaModal.jsx

import { useState } from "react";
import { FiSettings } from "react-icons/fi";

import ModalBase from "../../../shared/components/modals/ModalBase";
import GerenciarCategoriasModal from "./GerenciarCategoriasModal";

export default function SelecionarCategoriaModal({
  aberto,
  categorias,
  categoria,
  onSelecionar,
  onClose,
  permitirCriar = false,
  onAtualizarCategorias,
}) {
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);

  if (!aberto) return null;

  function fechar() {
    setModalGerenciarAberto(false);
    onClose?.();
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Escolher categoria"
        descricao="Escolha a categoria da despesa. Ela define como o app vai classificar o lançamento."
        onClose={fechar}
        z="z-[300]"
        acaoCabecalho={
          permitirCriar ? (
            <button
              type="button"
              onClick={() => setModalGerenciarAberto(true)}
              className="w-10 h-10 flex items-center justify-center bg-[#0B1120] hover:bg-green-500 hover:text-black border border-gray-700 hover:border-green-500 text-green-400 rounded-xl transition"
              title="Gerenciar categorias"
              aria-label="Gerenciar categorias"
            >
              <FiSettings className="w-5 h-5" />
            </button>
          ) : null
        }
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[58vh] overflow-y-auto scrollbar-hide pr-1"
          style={{ scrollbarWidth: "none" }}
        >
          {categorias.map((item) => {
            const nome = typeof item === "string" ? item : item?.nome;
            if (!nome) return null;

            const ativo = categoria === nome;

            return (
              <button
                key={nome}
                type="button"
                onClick={() => {
                  onSelecionar?.(nome);
                  fechar();
                }}
                className={`text-left rounded-xl border p-4 font-bold ${
                  ativo
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {nome}
              </button>
            );
          })}
        </div>
      </ModalBase>

      <GerenciarCategoriasModal
        aberto={modalGerenciarAberto}
        onClose={() => setModalGerenciarAberto(false)}
        onAtualizar={onAtualizarCategorias}
      />
    </>
  );
}

