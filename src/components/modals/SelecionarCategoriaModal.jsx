import { useState } from "react";
import { supabase } from "../../services/supabase";
import ModalBase from "./ModalBase";

export default function SelecionarCategoriaModal({
  aberto,
  categorias,
  categoria,
  onSelecionar,
  onClose,
  permitirCriar = false,
  tipoUsoPadrao = "trabalho",
  onCategoriaCriada,
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [tipoUso, setTipoUso] = useState(tipoUsoPadrao || "trabalho");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!aberto) return null;

  function fechar() {
    setCriando(false);
    setNome("");
    setErro("");
    onClose?.();
  }

  function tituloTipoUso(valor) {
    const nomes = {
      trabalho: "Uso à trabalho",
      pessoal: "Uso pessoal",
      rateada: "Rateada pelo veículo",
    };
    return nomes[valor] || valor;
  }

  async function salvarCategoria() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      setErro("Informe o nome da categoria.");
      return;
    }

    setSalvando(true);
    setErro("");

    const { data, error } = await supabase
      .from("categorias")
      .insert({
        nome: nomeLimpo,
        tipo: "saida",
        tipo_uso: tipoUso,
        ativo: true,
        ordem: 99,
      })
      .select("id, nome, tipo_uso")
      .single();

    setSalvando(false);

    if (error) {
      console.error(error);
      setErro(error.message || "Erro ao criar categoria.");
      return;
    }

    onCategoriaCriada?.(data);
    onSelecionar?.(data.nome);
    fechar();
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo={criando ? "Nova categoria" : "Selecionar categoria"}
      descricao={criando ? "Cadastre uma categoria e defina o tipo de uso padrão." : "Escolha o tipo de saída."}
      onClose={fechar}
    >
      {!criando && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categorias.map((item) => {
              const ativo = categoria === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onSelecionar(item);
                    fechar();
                  }}
                  className={`text-left rounded-xl border p-4 font-bold ${
                    ativo
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {permitirCriar && (
            <button
              type="button"
              onClick={() => {
                setTipoUso(tipoUsoPadrao || "trabalho");
                setCriando(true);
              }}
              className="w-full mt-4 rounded-xl border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/15 p-4 font-black"
            >
              + Nova categoria
            </button>
          )}
        </>
      )}

      {criando && (
        <div className="space-y-5">
          <div>
            <label className="text-sm text-gray-300">Nome da categoria</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Seguro, Mercado, Pneus..."
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
            />
          </div>

          <div>
            <p className="text-sm text-gray-300">Tipo de uso padrão</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {["trabalho", "pessoal", "rateada"].map((valor) => {
                const ativo = tipoUso === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setTipoUso(valor)}
                    className={`rounded-xl border p-3 text-left font-black ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                    }`}
                  >
                    {tituloTipoUso(valor)}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Rateada pelo veículo será dividida futuramente entre trabalho e pessoal usando os km rodados.
            </p>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="rounded-xl border border-gray-700 hover:bg-white/5 p-3 font-bold"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={salvarCategoria}
              disabled={salvando}
              className="rounded-xl bg-green-500 hover:bg-green-600 text-black p-3 font-black disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
