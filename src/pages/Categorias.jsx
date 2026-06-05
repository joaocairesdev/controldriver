import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCw, FiSettings, FiTrash2 } from "react-icons/fi";
import { supabase } from "../services/supabase";
import ModalBase from "../components/modals/ModalBase";
import FeedbackModal from "../components/modals/FeedbackModal";

const TIPOS_USO = [
  {
    valor: "trabalho",
    titulo: "Sempre trabalho",
    descricao: "O lançamento entra direto como uso à trabalho.",
  },
  {
    valor: "pessoal",
    titulo: "Sempre pessoal",
    descricao: "O lançamento entra direto como uso pessoal.",
  },
  {
    valor: "rateada",
    titulo: "Calculado pelo uso do veículo",
    descricao: "O app divide depois entre trabalho e pessoal pelos km do veículo.",
  },
  {
    valor: "opcional",
    titulo: "Escolher no lançamento",
    descricao: "O app pergunta se foi uso à trabalho ou uso pessoal na hora de lançar.",
  },
];

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoConfiguracao, setModoConfiguracao] = useState(false);
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [tipoUso, setTipoUso] = useState("trabalho");
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => {
    carregarCategorias();
  }, []);

  const categoriasAtivas = useMemo(() => categorias.filter((item) => item.ativo), [categorias]);
  const categoriasInativas = useMemo(() => categorias.filter((item) => !item.ativo), [categorias]);

  async function carregarCategorias() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, tipo, tipo_uso, ativo, ordem, created_at")
      .eq("tipo", "saida")
      .order("ativo", { ascending: false })
      .order("ordem", { ascending: true })
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

  function abrirNovaCategoria() {
    setEditando(null);
    setNome("");
    setTipoUso("trabalho");
    setModalAberto(true);
  }

  function abrirEditar(categoria) {
    setEditando(categoria);
    setNome(categoria.nome || "");
    setTipoUso(categoria.tipo_uso || "rateada");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setNome("");
    setTipoUso("trabalho");
  }

  async function salvarCategoria() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Informe o nome da categoria.");
      return;
    }

    setSalvando(true);

    try {
      if (editando) {
        const { error } = await supabase
          .from("categorias")
          .update({ nome: nomeLimpo, tipo_uso: tipoUso })
          .eq("id", editando.id);

        if (error) throw error;
        abrirFeedback("sucesso", "Categoria atualizada", "A categoria foi atualizada com sucesso.");
      } else {
        const proximaOrdem = Math.max(0, ...categorias.map((item) => Number(item.ordem || 0))) + 1;

        const { error } = await supabase.from("categorias").insert({
          nome: nomeLimpo,
          tipo: "saida",
          tipo_uso: tipoUso,
          ativo: true,
          ordem: proximaOrdem,
        });

        if (error) throw error;
        abrirFeedback("sucesso", "Categoria criada", "A categoria foi criada com sucesso.");
      }

      fecharModal();
      await carregarCategorias();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(categoria) {
    const novoStatus = !categoria.ativo;

    const { error } = await supabase
      .from("categorias")
      .update({ ativo: novoStatus })
      .eq("id", categoria.id);

    if (error) {
      abrirFeedback("erro", "Erro ao alterar", error.message || "Erro ao alterar categoria.");
      return;
    }

    await carregarCategorias();
  }

  function tituloTipoUso(valor) {
    return TIPOS_USO.find((item) => item.valor === valor)?.titulo || "Calculado pelo uso do veículo";
  }

  function descricaoTipoUso(valor) {
    return TIPOS_USO.find((item) => item.valor === valor)?.descricao || "";
  }

  function corTipoUso(valor) {
    if (valor === "trabalho") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (valor === "pessoal") return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    if (valor === "opcional") return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">Configurações</p>
          <h1 className="text-3xl font-bold mt-1">Categorias</h1>
          <p className="text-gray-400 mt-2">
            Defina o tipo de uso padrão de cada categoria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={abrirNovaCategoria}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 text-black font-black px-4 py-3"
          >
            <FiPlus /> Nova categoria
          </button>

          <button
            type="button"
            onClick={() => setModoConfiguracao((ativo) => !ativo)}
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition ${
              modoConfiguracao
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-gray-700 text-gray-400 hover:bg-white/5"
            }`}
            title="Configurar categorias"
            aria-label="Configurar categorias"
          >
            <FiSettings className="text-lg" />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-800 bg-[#111827] p-4">
        <p className="text-sm text-gray-300 font-bold">Como usar</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
          Categorias podem ser sempre trabalho, sempre pessoais, calculadas pelo uso do veículo ou perguntadas no lançamento.
        </p>
      </div>

      {carregando && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-[#111827] p-6">
          <p className="text-gray-400">Carregando categorias...</p>
        </div>
      )}

      {!carregando && (
        <div className="mt-6 space-y-4">
          {categoriasAtivas.map((categoria) => (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              tituloTipoUso={tituloTipoUso}
              descricaoTipoUso={descricaoTipoUso}
              corTipoUso={corTipoUso}
              editar={() => abrirEditar(categoria)}
              alternarAtivo={() => alternarAtivo(categoria)}
              modoConfiguracao={modoConfiguracao}
            />
          ))}

          {categoriasAtivas.length === 0 && (
            <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-center">
              <p className="text-gray-400">Nenhuma categoria ativa encontrada.</p>
            </div>
          )}

          {categoriasInativas.length > 0 && (
            <section className="pt-4">
              <h2 className="text-lg font-bold text-gray-300">Categorias desativadas</h2>
              <div className="mt-3 space-y-3 opacity-75">
                {categoriasInativas.map((categoria) => (
                  <CategoriaCard
                    key={categoria.id}
                    categoria={categoria}
                    tituloTipoUso={tituloTipoUso}
                    descricaoTipoUso={descricaoTipoUso}
                    corTipoUso={corTipoUso}
                    editar={() => abrirEditar(categoria)}
                    alternarAtivo={() => alternarAtivo(categoria)}
                    modoConfiguracao={modoConfiguracao}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ModalBase
        aberto={modalAberto}
        titulo={editando ? "Editar categoria" : "Nova categoria"}
        descricao="Informe o nome e o tipo de uso padrão."
        onClose={fecharModal}
        largura="max-w-2xl"
      >
        <div className="space-y-5">
          <div>
            <label className="text-sm text-gray-300">Nome da categoria</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Seguro, IPVA, Mercado, Pneus..."
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
            />
          </div>

          <div>
            <p className="text-sm text-gray-300">Tipo de uso padrão</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {TIPOS_USO.map((tipo) => {
                const ativo = tipoUso === tipo.valor;
                return (
                  <button
                    key={tipo.valor}
                    type="button"
                    onClick={() => setTipoUso(tipo.valor)}
                    className={`rounded-xl border p-4 text-left transition ${
                      ativo
                        ? "border-green-400 bg-green-500/10"
                        : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                    }`}
                  >
                    <p className="font-black text-white">{tipo.titulo}</p>
                    <p className="text-xs text-gray-500 mt-2">{tipo.descricao}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={fecharModal}
              className="rounded-xl border border-gray-700 hover:bg-white/5 p-3 font-bold"
            >
              Cancelar
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
      </ModalBase>

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </div>
  );
}

function CategoriaCard({
  categoria,
  tituloTipoUso,
  descricaoTipoUso,
  corTipoUso,
  editar,
  alternarAtivo,
  modoConfiguracao,
}) {
  return (
    <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4 sm:p-5">
      {modoConfiguracao && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={editar}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-gray-700 hover:bg-white/5 flex items-center justify-center text-gray-300"
            title="Editar"
          >
            <FiEdit2 className="text-sm" />
          </button>

          <button
            type="button"
            onClick={alternarAtivo}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center ${
              categoria.ativo
                ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                : "border-green-500/50 text-green-400 hover:bg-green-500/10"
            }`}
            title={categoria.ativo ? "Desativar" : "Reativar"}
          >
            {categoria.ativo ? (
              <FiTrash2 className="text-sm" />
            ) : (
              <FiRefreshCw className="text-sm" />
            )}
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.2fr)] gap-3 lg:gap-5 ${modoConfiguracao ? "pr-20 sm:pr-24" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-base sm:text-lg truncate">{categoria.nome}</h3>

            {!categoria.ativo && (
              <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-bold text-gray-400">
                Desativada
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 lg:flex lg:items-center lg:justify-end lg:gap-3">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${corTipoUso(categoria.tipo_uso)}`}>
            {tituloTipoUso(categoria.tipo_uso)}
          </span>

          <p className="text-xs sm:text-sm text-gray-500 mt-2 lg:mt-0 lg:text-right lg:truncate">
            {descricaoTipoUso(categoria.tipo_uso)}
          </p>
        </div>
      </div>
    </div>
  );
}
