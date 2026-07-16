import { useMemo, useState } from "react";
import { FiCheck, FiSearch } from "react-icons/fi";
import ModalBase from "./ModalBase";

export default function SelecionarOpcaoModal({
  aberto,
  titulo,
  descricao,
  opcoes = [],
  valor,
  onSelecionar,
  onClose,
  pesquisavel = false,
  placeholderBusca = "Buscar...",
  aviso = "",
}) {
  const [busca, setBusca] = useState("");
  const fechar = () => {
    setBusca("");
    onClose();
  };
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return opcoes;
    return opcoes.filter((opcao) => `${opcao.titulo} ${opcao.descricao || ""} ${opcao.valor}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, opcoes]);
  const grupos = useMemo(() => filtradas.reduce((acc, opcao) => {
    const grupo = opcao.grupo || "Opções";
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(opcao);
    return acc;
  }, {}), [filtradas]);

  return (
    <ModalBase aberto={aberto} titulo={titulo} descricao={descricao} onClose={fechar} largura="max-w-xl">
      {pesquisavel && (
        <div className="flex items-center rounded-xl border border-gray-700 bg-[#0B1120] focus-within:border-green-400">
          <FiSearch className="ml-3 text-gray-400" />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder={placeholderBusca} className="w-full bg-transparent p-3 outline-none" autoFocus />
        </div>
      )}
      {aviso && <p className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-400">{aviso}</p>}
      <div className="mt-4 space-y-5">
        {Object.entries(grupos).map(([grupo, itens]) => (
          <section key={grupo}>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">{grupo}</h3>
            <div className="space-y-2">
              {itens.map((opcao) => {
                const selecionada = opcao.valor === valor;
                return (
                  <button key={opcao.valor} type="button" onClick={() => { onSelecionar(opcao.valor); fechar(); }} className={`w-full rounded-xl border p-4 text-left transition ${selecionada ? "border-green-400 bg-green-500/10" : "border-gray-700 bg-[#0B1120] hover:border-green-400"}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span><strong className={selecionada ? "text-green-500" : "text-white"}>{opcao.titulo}</strong>{opcao.descricao && <span className="mt-1 block text-xs text-gray-400">{opcao.descricao}</span>}</span>
                      {selecionada && <FiCheck className="mt-1 shrink-0 text-green-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!filtradas.length && <p className="py-8 text-center text-gray-400">Nenhuma opção encontrada.</p>}
      </div>
    </ModalBase>
  );
}
