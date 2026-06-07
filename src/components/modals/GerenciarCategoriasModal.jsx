// src/components/modals/GerenciarCategoriasModal.jsx

import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import { supabase } from "../../services/supabase";

import ModalBase from "./ModalBase";
import FeedbackModal from "./FeedbackModal";
import {
  CATEGORIAS_SISTEMA_FIXAS,
  TIPOS_USO_CATEGORIA,
  corTextoTipoUsoCategoria,
  isCategoriaSistemaFixa,
  normalizarCategoria,
  tipoUsoCategoriaFixa,
  tituloTipoUsoCategoria,
} from "../../utils/categoriasSistema";

export default function GerenciarCategoriasModal({ aberto, onClose, onAtualizar }) {
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("lista");
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [tipoUso, setTipoUso] = useState("opcional");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => {
    if (!aberto) return;
    carregarCategorias();
    setBusca("");
    setModo("lista");
    limparCadastro();
  }, [aberto]);

  const categoriasComSistema = useMemo(() => {
    const mapa = new Map();

    CATEGORIAS_SISTEMA_FIXAS.forEach((categoria) => {
      mapa.set(normalizarCategoria(categoria.nome), {
        id: null,
        nome: categoria.nome,
        tipo: "saida",
        tipo_uso: categoria.tipo_uso,
        ativo: true,
        sistema: true,
      });
    });

    (categorias || []).forEach((categoria) => {
      if (!categoria?.nome) return;
      const chave = normalizarCategoria(categoria.nome);
      const fixa = isCategoriaSistemaFixa(categoria.nome);

      mapa.set(chave, {
        ...categoria,
        ativo: categoria.ativo !== false,
        tipo_uso: categoria.tipo_uso || (fixa ? tipoUsoCategoriaFixa(categoria.nome) : "opcional"),
        sistema: fixa,
      });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" })
    );
  }, [categorias]);

  const categoriasFiltradas = useMemo(() => {
    const termo = normalizarCategoria(busca);
    if (!termo) return categoriasComSistema;
    return categoriasComSistema.filter((categoria) => normalizarCategoria(categoria.nome).includes(termo));
  }, [categoriasComSistema, busca]);

  const nomeExiste = categoriasComSistema.some(
    (categoria) => normalizarCategoria(categoria.nome) === normalizarCategoria(busca)
  );

  const podeCriar = busca.trim().length > 0 && categoriasFiltradas.length === 0 && !nomeExiste;

  if (!aberto) return null;

  async function carregarCategorias() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, tipo, tipo_uso, ativo, ordem, created_at")
      .eq("tipo", "saida")
      .order("nome", { ascending: true });

    if (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao carregar", error.message || "Erro ao carregar categorias.");
      setCategorias([]);
      setCarregando(false);
      return;
    }

    setCategorias(data || []);
    setCarregando(false);
  }

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function limparCadastro() {
    setEditando(null);
    setNome("");
    setTipoUso("opcional");
    setSalvando(false);
  }

  function abrirCadastro(nomeInicial = "") {
    setEditando(null);
    setNome(nomeInicial);
    setTipoUso("opcional");
    setModo("cadastro");
  }

  function abrirEdicao(categoria) {
    const fixa = isCategoriaSistemaFixa(categoria.nome);
    setEditando({ ...categoria, sistema: fixa });
    setNome(categoria.nome || "");
    setTipoUso(categoria.tipo_uso || (fixa ? tipoUsoCategoriaFixa(categoria.nome) : "opcional"));
    setModo("cadastro");
  }

  function alterarNome(valor) {
    if (editando?.sistema) {
      abrirFeedback(
        "aviso",
        "Categoria do sistema",
        "Esta categoria é usada automaticamente pelo ControlDriver e o nome não pode ser alterado."
      );
      return;
    }

    setNome(valor);
  }

  async function salvarCategoria() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Informe o nome da categoria.");
      return;
    }

    setSalvando(true);

    try {
      if (editando?.sistema && normalizarCategoria(nomeLimpo) !== normalizarCategoria(editando.nome)) {
        abrirFeedback(
          "aviso",
          "Categoria do sistema",
          "Esta categoria é usada automaticamente pelo ControlDriver e o nome não pode ser alterado."
        );
        setSalvando(false);
        return;
      }

      if (editando?.id) {
        const payload = editando.sistema
          ? { tipo_uso: tipoUso, ativo: true }
          : { nome: nomeLimpo, tipo_uso: tipoUso, ativo: true };

        const { error } = await supabase.from("categorias").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const existente = categorias.find(
          (categoria) => normalizarCategoria(categoria.nome) === normalizarCategoria(nomeLimpo)
        );

        if (existente) {
          const { error } = await supabase
            .from("categorias")
            .update({ ativo: true, tipo_uso: tipoUso })
            .eq("id", existente.id);

          if (error) throw error;
        } else {
          const proximaOrdem = Math.max(0, ...categorias.map((categoria) => Number(categoria.ordem || 0))) + 1;

          const { error } = await supabase.from("categorias").insert({
            nome: nomeLimpo,
            tipo: "saida",
            tipo_uso: tipoUso,
            ativo: true,
            ordem: proximaOrdem,
          });

          if (error) throw error;
        }
      }

      abrirFeedback("sucesso", editando ? "Categoria atualizada" : "Categoria criada", editando ? "Categoria atualizada com sucesso." : "Categoria cadastrada com sucesso.");
      setBusca("");
      setModo("lista");
      limparCadastro();
      await carregarCategorias();
      await onAtualizar?.();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCategoria(categoria) {
    if (isCategoriaSistemaFixa(categoria.nome)) {
      abrirFeedback(
        "aviso",
        "Categoria do sistema",
        "Esta categoria é usada automaticamente pelo ControlDriver e não pode ser excluída."
      );
      return;
    }

    if (!categoria?.id) {
      abrirFeedback("aviso", "Categoria padrão", "Esta categoria ainda não está cadastrada no banco.");
      return;
    }

    const confirmar = window.confirm(`Deseja excluir a categoria "${categoria.nome}"?`);
    if (!confirmar) return;

    setExcluindoId(categoria.id);

    try {
      const { data: saidasPorId, error: erroSaidasPorId } = await supabase
        .from("saidas")
        .select("id")
        .eq("categoria_id", categoria.id);

      if (erroSaidasPorId) throw erroSaidasPorId;

      const { data: saidasPorNome, error: erroSaidasPorNome } = await supabase
        .from("saidas")
        .select("id")
        .eq("categoria", categoria.nome);

      if (erroSaidasPorNome) throw erroSaidasPorNome;

      const emUso = (saidasPorId || []).length > 0 || (saidasPorNome || []).length > 0;

      if (emUso) {
        const { error } = await supabase.from("categorias").update({ ativo: false }).eq("id", categoria.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categorias").delete().eq("id", categoria.id);
        if (error) throw error;
      }

      abrirFeedback("sucesso", "Categoria removida", emUso ? "A categoria foi ocultada porque já existe em lançamentos antigos." : "Categoria excluída com sucesso.");
      await carregarCategorias();
      await onAtualizar?.();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao excluir", error.message || "Erro ao excluir categoria.");
    } finally {
      setExcluindoId(null);
    }
  }

  function fechar() {
    setBusca("");
    setModo("lista");
    limparCadastro();
    onClose?.();
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={modo === "cadastro" ? (editando ? "Editar categoria" : "Nova categoria") : "Gerenciar categorias"}
        descricao={modo === "cadastro" ? "Defina o nome e o tipo de uso padrão." : "Busque, adicione, edite ou remova categorias de despesas."}
        onClose={fechar}
        largura="max-w-lg"
        z="z-[300]"
      >
        {modo === "lista" && (
          <>
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={busca}
                placeholder="Buscar ou adicionar categoria..."
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-[#0B1120] border border-gray-700 focus:border-green-400 outline-none rounded-xl py-3 pl-11 pr-4"
              />
            </div>

            {podeCriar && (
              <button
                type="button"
                onClick={() => abrirCadastro(busca.trim())}
                className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                + Adicionar &quot;{busca.trim()}&quot;
              </button>
            )}

            <div className="mt-5 space-y-3 max-h-[52vh] overflow-y-auto scrollbar-hide pr-1" style={{ scrollbarWidth: "none" }}>
              {carregando && (
                <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Carregando categorias...</p>
                </div>
              )}

              {!carregando && categoriasFiltradas.length === 0 && !podeCriar && (
                <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Nenhuma categoria encontrada.</p>
                </div>
              )}

              {categoriasFiltradas.map((categoria) => {
                const fixa = isCategoriaSistemaFixa(categoria.nome);

                return (
                  <div
                    key={categoria.id || categoria.nome}
                    className={`bg-[#0B1120] border rounded-xl p-4 flex items-center justify-between gap-3 ${
                      categoria.ativo === false ? "border-gray-800 opacity-50" : "border-gray-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => abrirEdicao(categoria)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-bold text-white truncate">{categoria.nome}</p>
                      <p className={`text-xs mt-1 ${corTextoTipoUsoCategoria(categoria.tipo_uso)}`}>
                        {tituloTipoUsoCategoria(categoria.tipo_uso)}
                      </p>
                      {fixa && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Categoria do sistema: o nome não pode ser alterado.
                        </p>
                      )}
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(categoria)}
                        className="w-10 h-10 rounded-xl border border-gray-700 hover:border-green-400 hover:text-green-400 flex items-center justify-center"
                        title="Editar categoria"
                      >
                        <FiEdit2 className="w-5 h-5" />
                      </button>

                      {!fixa && (
                        <button
                          type="button"
                          onClick={() => excluirCategoria(categoria)}
                          disabled={excluindoId === categoria.id}
                          className="w-10 h-10 rounded-xl border border-gray-700 hover:border-red-400 hover:text-red-400 flex items-center justify-center disabled:opacity-50"
                          title="Excluir categoria"
                        >
                          <FiTrash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 z-10 mt-6 pt-4 bg-[#111827]">
              <button
                type="button"
                onClick={fechar}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                Concluir
              </button>
            </div>
          </>
        )}

        {modo === "cadastro" && (
          <div className="space-y-5">
            <div>
              <label className="text-sm text-gray-300">Nome da categoria</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => alterarNome(e.target.value)}
                placeholder="Ex: Seguro, Mercado, Pneus..."
                className={`w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none ${
                  editando?.sistema ? "text-gray-400 cursor-not-allowed" : ""
                }`}
                readOnly={Boolean(editando?.sistema)}
              />
              {editando?.sistema && (
                <p className="text-xs text-gray-500 mt-2">
                  Esta categoria é usada automaticamente pelo ControlDriver. O nome não pode ser alterado.
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-300">Tipo de uso padrão</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {TIPOS_USO_CATEGORIA.map((item) => {
                  const ativo = tipoUso === item.valor;
                  return (
                    <button
                      key={item.valor}
                      type="button"
                      onClick={() => setTipoUso(item.valor)}
                      className={`rounded-xl border p-3 text-left font-black ${
                        ativo
                          ? "border-green-400 bg-green-500/10 text-green-400"
                          : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                      }`}
                    >
                      {item.titulo}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 mt-6 pt-4 bg-[#111827]">
              <button
                type="button"
                onClick={() => {
                  setModo("lista");
                  limparCadastro();
                }}
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
