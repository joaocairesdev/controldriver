import { useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiLock,
  FiPlus,
  FiSettings,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import { isCategoriaSistemaFixa, tipoUsoCategoriaFixa, normalizarCategoria } from "../constants/categoriasSistema";
import ModalBase from "../../../shared/components/modals/ModalBase";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";

const TIPOS_USO = [
  {
    valor: "trabalho",
    titulo: "Sempre trabalho",
  },
  {
    valor: "pessoal",
    titulo: "Sempre pessoal",
  },
  {
    valor: "rateada",
    titulo: "Calculado pelo uso do veículo",
  },
  {
    valor: "opcional",
    titulo: "Escolher no lançamento",
  },
];

const ABAS_CONFIGURACOES = [
  { id: "perfil", titulo: "Perfil", icone: <FiUser /> },
  { id: "seguranca", titulo: "Privacidade e segurança", icone: <FiShield /> },
  { id: "aplicativo", titulo: "Aplicativo", icone: <FiSmartphone /> },
];

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState("aplicativo");
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const [nome, setNome] = useState("");
  const [tipoUso, setTipoUso] = useState("trabalho");
  const [salvando, setSalvando] = useState(false);
  const [fusoHorario, setFusoHorario] = useState(() => localStorage.getItem("controldriver_fuso_horario") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo");
  const [temaApp, setTemaApp] = useState(() => localStorage.getItem("controldriver_tema") || "escuro");

  const [modoGerenciamento, setModoGerenciamento] = useState("normal");
  const [selecionadas, setSelecionadas] = useState([]);
  const [buscaAdicionar, setBuscaAdicionar] = useState("");

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  useEffect(() => {
    carregarCategorias();
  }, []);

  useEffect(() => {
    localStorage.setItem("controldriver_fuso_horario", fusoHorario);
  }, [fusoHorario]);

  useEffect(() => {
    localStorage.setItem("controldriver_tema", temaApp);
    document.documentElement.dataset.theme = temaApp;
  }, [temaApp]);

  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
          sensitivity: "base",
        })
      ),
    [categorias]
  );

  const nomesAntigosCategoriasSistema = useMemo(
    () =>
      new Set([
        "pedagio de uso a trabalho",
        "pedagio de uso pessoal",
        "estacionamento de uso a trabalho",
        "estacionamento de uso pessoal",
      ].map(normalizarCategoria)),
    []
  );

  const categoriasSemDuplicadasAntigas = useMemo(
    () => categoriasOrdenadas.filter((item) => !nomesAntigosCategoriasSistema.has(normalizarCategoria(item.nome))),
    [categoriasOrdenadas, nomesAntigosCategoriasSistema]
  );

  const categoriasAtivas = useMemo(
    () => categoriasSemDuplicadasAntigas.filter((item) => item.ativo),
    [categoriasSemDuplicadasAntigas]
  );

  const categoriasGerenciamento = useMemo(
    () => categoriasSemDuplicadasAntigas,
    [categoriasSemDuplicadasAntigas]
  );

  function normalizarTexto(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

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

  function dadosTipoUso(valor) {
    if (valor === "proporcional") return { valor: "proporcional", titulo: "Uso proporcional" };
    return TIPOS_USO.find((item) => item.valor === valor) || TIPOS_USO[2];
  }

  function tituloTipoUso(valor) {
    return dadosTipoUso(valor).titulo;
  }

  function corTextoTipoUso(valor) {
    if (valor === "trabalho") return "text-green-400";
    if (valor === "pessoal") return "text-blue-400";
    if (valor === "opcional") return "text-purple-400";
    if (valor === "proporcional") return "text-cyan-400";
    return "text-yellow-400";
  }

  function abrirNovaCategoria(nomeInicial = "") {
    setEditando(null);
    setNome(nomeInicial);
    setTipoUso("trabalho");
    setModalCadastroAberto(true);
  }

  function abrirEditar(categoria) {
    setEditando(categoria);
    setNome(categoria.nome || "");
    setTipoUso(isCategoriaSistemaFixa(categoria.nome) ? tipoUsoCategoriaFixa(categoria.nome) : categoria.tipo_uso || "rateada");
    setModalCadastroAberto(true);
  }

  function fecharCadastro() {
    if (salvando) return;
    setModalCadastroAberto(false);
    setEditando(null);
    setNome("");
    setTipoUso("trabalho");
  }

  function abrirGerenciamento() {
    setModoGerenciamento("normal");
    setSelecionadas([]);
    setBuscaAdicionar("");
    setModalGerenciarAberto(true);
  }

  function fecharGerenciamento() {
    setModoGerenciamento("normal");
    setSelecionadas([]);
    setBuscaAdicionar("");
    setModalGerenciarAberto(false);
  }

  async function salvarCategoria() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Informe o nome da categoria.");
      return;
    }

    setSalvando(true);

    try {
      const categoriaExistente = categorias.find(
        (item) => normalizarTexto(item.nome) === normalizarTexto(nomeLimpo)
      );

      if (!editando && categoriaExistente) {
        const { error } = await supabase
          .from("categorias")
          .update({
            ativo: true,
            tipo_uso: tipoUso,
            nome: categoriaExistente.nome,
          })
          .eq("id", categoriaExistente.id);

        if (error) throw error;

        abrirFeedback("sucesso", "Categoria criada", "Categoria cadastrada com sucesso.");
        setBuscaAdicionar("");
        setModoGerenciamento("normal");
        fecharCadastro();
        await carregarCategorias();
        return;
      }

      if (editando) {
        const { error } = await supabase
          .from("categorias")
          .update({ nome: nomeLimpo, tipo_uso: isCategoriaSistemaFixa(editando.nome) ? tipoUsoCategoriaFixa(editando.nome) : tipoUso })
          .eq("id", editando.id);

        if (error) throw error;
        abrirFeedback("sucesso", "Categoria atualizada", "Categoria atualizada com sucesso.");
        setBuscaAdicionar("");
        setModoGerenciamento("normal");
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
        abrirFeedback("sucesso", "Categoria criada", "Categoria cadastrada com sucesso.");
        setBuscaAdicionar("");
        setModoGerenciamento("normal");
      }

      fecharCadastro();
      await carregarCategorias();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(categoria) {
    const { error } = await supabase
      .from("categorias")
      .update({ ativo: !categoria.ativo })
      .eq("id", categoria.id);

    if (error) {
      abrirFeedback("erro", "Erro ao alterar", error.message || "Erro ao alterar categoria.");
      return;
    }

    await carregarCategorias();
  }

  function alternarSelecionada(id) {
    setSelecionadas((lista) =>
      lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]
    );
  }

  async function desativarSelecionadas() {
    if (selecionadas.length === 0) {
      abrirFeedback("aviso", "Nenhuma categoria selecionada", "Selecione pelo menos uma categoria.");
      return;
    }

    const categoriasSelecionadas = categorias.filter((item) =>
      selecionadas.includes(item.id)
    );

    const nomesSelecionados = categoriasSelecionadas.map((item) => item.nome);

    const { data: saidasPorId, error: erroSaidasPorId } = await supabase
      .from("saidas")
      .select("categoria_id")
      .in("categoria_id", selecionadas);

    if (erroSaidasPorId) {
      abrirFeedback("erro", "Erro ao excluir", erroSaidasPorId.message || "Erro ao verificar uso das categorias.");
      return;
    }

    const { data: saidasPorNome, error: erroSaidasPorNome } = await supabase
      .from("saidas")
      .select("categoria")
      .in("categoria", nomesSelecionados);

    if (erroSaidasPorNome) {
      abrirFeedback("erro", "Erro ao excluir", erroSaidasPorNome.message || "Erro ao verificar uso das categorias.");
      return;
    }

    const idsEmUso = new Set(
      (saidasPorId || [])
        .map((item) => Number(item.categoria_id))
        .filter(Boolean)
    );

    const nomesEmUso = new Set(
      (saidasPorNome || []).map((item) => normalizarTexto(item.categoria))
    );

    const categoriasComUso = categoriasSelecionadas.filter(
      (item) => idsEmUso.has(Number(item.id)) || nomesEmUso.has(normalizarTexto(item.nome))
    );

    const categoriasSemUso = categoriasSelecionadas.filter(
      (item) => !idsEmUso.has(Number(item.id)) && !nomesEmUso.has(normalizarTexto(item.nome))
    );

    if (categoriasSemUso.length > 0) {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .in("id", categoriasSemUso.map((item) => item.id));

      if (error) {
        abrirFeedback("erro", "Erro ao excluir", error.message || "Erro ao excluir categorias.");
        return;
      }
    }

    if (categoriasComUso.length > 0) {
      const { error } = await supabase
        .from("categorias")
        .update({ ativo: false })
        .in("id", categoriasComUso.map((item) => item.id));

      if (error) {
        abrirFeedback("erro", "Erro ao excluir", error.message || "Erro ao remover categorias da lista visível.");
        return;
      }
    }

    abrirFeedback("sucesso", "Categorias excluídas", "As categorias foram removidas da lista visível.");
    setSelecionadas([]);
    setModoGerenciamento("normal");
    setBuscaAdicionar("");
    await carregarCategorias();
  }

  async function adicionarPorBusca() {
    const nomeLimpo = buscaAdicionar.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Digite o nome da categoria.");
      return;
    }

    const existente = categorias.find(
      (item) => normalizarTexto(item.nome) === normalizarTexto(nomeLimpo)
    );

    if (existente?.ativo) {
      abrirFeedback("aviso", "Categoria já existe", "Essa categoria já está ativa na lista.");
      setBuscaAdicionar("");
      setModoGerenciamento("normal");
      return;
    }

    if (existente && !existente.ativo) {
      const { error } = await supabase
        .from("categorias")
        .update({ ativo: true })
        .eq("id", existente.id);

      if (error) {
        abrirFeedback("erro", "Erro ao adicionar", error.message || "Erro ao adicionar categoria.");
        return;
      }

      abrirFeedback("sucesso", "Categoria criada", "Categoria cadastrada com sucesso.");
      setBuscaAdicionar("");
      setModoGerenciamento("normal");
      await carregarCategorias();
      return;
    }

    abrirNovaCategoria(nomeLimpo);
  }

  return (
    <div>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">
            Configurações
          </p>
          <h1 className="text-3xl font-bold mt-1">Configurações do app</h1>
        </div>

        <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide touch-pan-x overscroll-x-contain px-4 sm:px-0 pb-1">
          <div className="inline-flex w-max max-w-none rounded-2xl border border-gray-800 bg-[#111827] p-1 gap-1">
            {ABAS_CONFIGURACOES.map((aba) => {
              const ativo = abaAtiva === aba.id;

              return (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition ${
                    ativo
                      ? "bg-green-500 text-black"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="text-base">{aba.icone}</span>
                  {aba.titulo}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {abaAtiva === "aplicativo" && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-[#111827] p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Aplicativo</h2>
            <p className="text-gray-400 mt-1">Ajustes gerais de data, horário e visual do ControlDriver.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
              <p className="text-sm font-bold text-white">Fuso horário</p>
              <p className="text-xs text-gray-500 mt-1">Usado como base para datas e horários do aplicativo.</p>
              <select
                value={fusoHorario}
                onChange={(e) => setFusoHorario(e.target.value)}
                className="w-full mt-3 bg-[#111827] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
              >
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="America/Manaus">America/Manaus</option>
                <option value="America/Cuiaba">America/Cuiaba</option>
                <option value="America/Rio_Branco">America/Rio_Branco</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
              <p className="text-sm font-bold text-white">Tema</p>
              <p className="text-xs text-gray-500 mt-1">Escolha entre modo escuro ou claro.</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[{ valor: "escuro", titulo: "Escuro" }, { valor: "claro", titulo: "Claro" }].map((tema) => (
                  <button
                    key={tema.valor}
                    type="button"
                    onClick={() => setTemaApp(tema.valor)}
                    className={`rounded-xl border p-3 font-bold transition ${temaApp === tema.valor ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 text-gray-300 hover:bg-white/5"}`}
                  >
                    {tema.titulo}
                  </button>
                ))}
              </div>
              <p className="text-xs text-yellow-400 mt-3">O seletor já fica salvo. A aplicação visual completa do tema claro entra na próxima etapa de layout.</p>
            </div>
          </div>
        </div>
      )}

      {abaAtiva !== "aplicativo" && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-[#111827] p-6">
          <div className="w-12 h-12 rounded-xl bg-gray-500/10 border border-gray-700 flex items-center justify-center text-gray-400">
            <FiLock />
          </div>

          <h2 className="text-xl font-bold mt-4">Em breve</h2>
          <p className="text-gray-400 mt-2">Esta configuração ainda será construída.</p>
        </div>
      )}

      {abaAtiva === "categorias" && (
        <>
          <div className="mt-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">Categorias</h2>
              <p className="text-gray-400 mt-1">
                Visualize e organize os tipos de uso padrão das categorias.
              </p>
            </div>

            <button
              type="button"
              onClick={abrirGerenciamento}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-gray-700 text-gray-300 hover:bg-white/5 flex items-center justify-center transition shrink-0"
              title="Gerenciar categorias"
              aria-label="Gerenciar categorias"
            >
              <FiSettings className="text-base sm:text-lg" />
            </button>
          </div>

          {carregando && (
            <div className="mt-6 rounded-2xl border border-gray-800 bg-[#111827] p-6">
              <p className="text-gray-400">Carregando categorias...</p>
            </div>
          )}

          {!carregando && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {categoriasAtivas.map((categoria) => (
                <CategoriaCardSimples
                  key={categoria.id}
                  categoria={categoria}
                />
              ))}

              {categoriasAtivas.length === 0 && (
                <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-center lg:col-span-2">
                  <p className="text-gray-400">Nenhuma categoria ativa encontrada.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ModalGerenciarCategorias
        aberto={modalGerenciarAberto}
        categorias={categoriasGerenciamento}
        categoriasBusca={categoriasOrdenadas}
        modo={modoGerenciamento}
        setModo={setModoGerenciamento}
        selecionadas={selecionadas}
        alternarSelecionada={alternarSelecionada}
        buscaAdicionar={buscaAdicionar}
        setBuscaAdicionar={setBuscaAdicionar}
        onClose={fecharGerenciamento}
        onAdicionarBusca={adicionarPorBusca}
        onEditar={abrirEditar}
        onAlternarAtivo={alternarAtivo}
        onExcluirSelecionadas={desativarSelecionadas}
        normalizarTexto={normalizarTexto}
        tituloTipoUso={tituloTipoUso}
        corTextoTipoUso={corTextoTipoUso}
      />

      <ModalBase
        aberto={modalCadastroAberto}
        titulo={editando ? "Editar categoria" : "Nova categoria"}
        descricao="Informe o nome e o tipo de uso padrão."
        onClose={fecharCadastro}
        largura="max-w-2xl"
        z="z-[80]"
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
            {editando && isCategoriaSistemaFixa(editando.nome) && (
              <p className="text-xs text-yellow-400 mt-1">Categoria fixa do sistema: o tipo de uso não pode ser alterado.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {TIPOS_USO.map((tipo) => {
                const ativo = tipoUso === tipo.valor;

                return (
                  <button
                    key={tipo.valor}
                    type="button"
                    onClick={() => !(editando && isCategoriaSistemaFixa(editando.nome)) && setTipoUso(tipo.valor)}
                    disabled={editando && isCategoriaSistemaFixa(editando.nome)}
                    className={`rounded-xl border p-4 text-left transition disabled:opacity-60 disabled:cursor-not-allowed ${
                      ativo
                        ? "border-green-400 bg-green-500/10"
                        : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
                    }`}
                  >
                    <p className="font-bold text-white">{tipo.titulo}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={fecharCadastro}
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

function CategoriaCardSimples({ categoria }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#111827] px-4 py-4 flex items-center justify-center sm:justify-start min-h-[58px]">
      <h3 className="text-sm sm:text-base font-semibold text-white text-center sm:text-left truncate">
        {categoria.nome}
      </h3>
    </div>
  );
}

function ModalGerenciarCategorias({
  aberto,
  categorias,
  categoriasBusca,
  modo,
  setModo,
  selecionadas,
  alternarSelecionada,
  buscaAdicionar,
  setBuscaAdicionar,
  onClose,
  onAdicionarBusca,
  onEditar,
  onAlternarAtivo,
  onExcluirSelecionadas,
  normalizarTexto,
  tituloTipoUso,
  corTextoTipoUso,
}) {
  if (!aberto) return null;

  const adicionando = modo === "adicionar";
  const editando = modo === "editar";
  const excluindo = modo === "excluir";

  const buscaNormalizada = normalizarTexto(buscaAdicionar);
  const categoriasFiltradas = buscaNormalizada
    ? categorias.filter((categoria) =>
        normalizarTexto(categoria.nome).includes(buscaNormalizada)
      )
    : categorias;

  const categoriaExata = buscaNormalizada
    ? categoriasBusca.find((categoria) => normalizarTexto(categoria.nome) === buscaNormalizada)
    : null;

  const existeExato = Boolean(categoriaExata);

  return (
    <ModalBase
      aberto={aberto}
      titulo="Gerenciar categorias"
      descricao="Adicione, edite ou exclua uma categoria desejada."
      onClose={onClose}
      largura="max-w-3xl"
      z="z-[70]"
    >
      <div className="flex items-center justify-between gap-3 -mt-2 mb-5">
        <p className="text-xs text-gray-500">
          {adicionando && "Digite para buscar ou adicionar."}
          {editando && "Toque para editar."}
          {excluindo && "Selecione as categorias que deseja excluir."}
          {!adicionando && !editando && !excluindo && "Toque em uma categoria para ligar ou desligar."}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModo(adicionando ? "normal" : "adicionar")}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              adicionando
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-green-500/50 text-green-400 hover:bg-green-500/10"
            }`}
            title="Adicionar"
          >
            {adicionando ? <FiX /> : <FiPlus />}
          </button>

          <button
            type="button"
            onClick={() => setModo(editando ? "normal" : "editar")}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              editando
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-gray-700 text-gray-300 hover:bg-white/5"
            }`}
            title="Editar"
          >
            <FiEdit2 />
          </button>

          <button
            type="button"
            onClick={() => setModo(excluindo ? "normal" : "excluir")}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              excluindo
                ? "border-red-400 bg-red-500/10 text-red-400"
                : "border-gray-700 text-gray-300 hover:bg-white/5"
            }`}
            title="Excluir"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      {adicionando && (
        <div className="mb-4 rounded-2xl border border-gray-800 bg-[#0B1120] p-3">
          <label className="text-xs text-gray-400 font-semibold">
            Buscar ou adicionar categoria
          </label>

          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input
              type="text"
              value={buscaAdicionar}
              onChange={(e) => setBuscaAdicionar(e.target.value)}
              placeholder="Digite o nome da categoria..."
              className="w-full bg-[#111827] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
              autoFocus
            />

            {buscaAdicionar.trim() && (!existeExato || !categoriaExata?.ativo) && (
              <button
                type="button"
                onClick={onAdicionarBusca}
                className="rounded-xl bg-green-500 hover:bg-green-600 text-black font-black px-4 py-3 whitespace-nowrap"
              >
                Adicionar
              </button>
            )}

            {buscaAdicionar.trim() && categoriaExata?.ativo && (
              <button
                type="button"
                disabled
                className="rounded-xl border border-gray-700 text-gray-500 font-bold px-4 py-3 whitespace-nowrap cursor-not-allowed"
              >
                Já existe
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categoriasFiltradas.map((categoria) => {
          const selecionada = selecionadas.includes(categoria.id);

          return (
            <div
              key={categoria.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (editando) onEditar(categoria);
                else if (excluindo) alternarSelecionada(categoria.id);
                else onAlternarAtivo(categoria);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (editando) onEditar(categoria);
                else if (excluindo) alternarSelecionada(categoria.id);
                else onAlternarAtivo(categoria);
              }}
              className={`rounded-xl border bg-[#0B1120] p-3 flex items-center gap-3 transition cursor-pointer hover:bg-white/5 ${
                selecionada
                  ? "border-red-400 bg-red-500/10"
                  : categoria.ativo
                  ? "border-gray-700"
                  : "border-gray-800 opacity-60"
              }`}
            >
              {excluindo && (
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
                    selecionada
                      ? "bg-red-500 border-red-500 text-white"
                      : "border-gray-600 text-transparent"
                  }`}
                >
                  ✓
                </span>
              )}

              <p className="flex-1 font-semibold text-white truncate">
                {categoria.nome}
              </p>

              <span className={`text-xs sm:text-sm font-semibold shrink-0 text-right ${corTextoTipoUso(categoria.tipo_uso)}`}>
                {tituloTipoUso(categoria.tipo_uso)}
              </span>

              {!editando && !excluindo && (
                <span
                  className={`relative w-12 h-7 rounded-full transition shrink-0 ${
                    categoria.ativo ? "bg-green-500" : "bg-gray-700"
                  }`}
                  title={categoria.ativo ? "Desativar" : "Ativar"}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${
                      categoria.ativo ? "right-1" : "left-1"
                    }`}
                  />
                </span>
              )}
            </div>
          );
        })}

        {categoriasFiltradas.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-4">
            <p className="text-sm text-gray-500">Nenhuma categoria encontrada.</p>
          </div>
        )}
      </div>

      {excluindo && (
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={() => setModo("normal")}
            className="rounded-xl border border-gray-700 hover:bg-white/5 p-3 font-bold"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onExcluirSelecionadas}
            className="rounded-xl bg-red-500 hover:bg-red-600 text-white p-3 font-black"
          >
            Excluir selecionadas
          </button>
        </div>
      )}
    </ModalBase>
  );
}
