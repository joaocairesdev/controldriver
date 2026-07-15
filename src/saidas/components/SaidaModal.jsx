import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { FiEdit2, FiPlus, FiSettings, FiTrash2, FiX } from "react-icons/fi";

import ModalBase from "../../components/modals/ModalBase";
import DatePickerModal from "../../components/modals/DatePickerModal";
import FeedbackModal from "../../components/modals/FeedbackModal";
import ConfirmacaoModal from "../../components/modals/ConfirmacaoModal";
import SelecionarFormaPagamentoModal from "../../components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../components/modals/SelecionarCartaoModal";
import SelecionarCategoriaModal from "../../components/modals/SelecionarCategoriaModal";
import GerenciarCategoriasModal from "../../components/modals/GerenciarCategoriasModal";
import SelecionarParcelasModal from "../../components/modals/SelecionarParcelasModal";
import { CATEGORIAS_SISTEMA_FIXAS } from "../../utils/categoriasSistema";
import {
  ajustarVencimentoFimDeSemana,
  calcularCompetenciaFaturaPorCompra,
  calcularSaldoAbertoFatura,
  calcularStatusFaturaComPagamento,
  criarPayloadParcela,
  dataComDiaSeguro,
  gerarParcelasEFaturasPadrao,
  nomeCartaoComFinal,
  obterOuCriarFaturaPadrao,
  recalcularFaturaPorParcelas as recalcularFaturaPorParcelasCompartilhada,
  removerParcelasDaSaidaERecalcularFaturas,
  somarMesesData,
  somarMesesDataISO,
} from "../../cartoes/cartoesUtils";

export default function SaidaModal({
  aberto,
  onClose,
  onSalvo,
  edicao = null,
  titulo = "Nova Despesa",
  descricaoModal = "Registre uma despesa.",
  categoriaInicial = "Outros",
  categoriaBloqueada = false,
  modo = "saida", // saida | futura
}) {
  const hoje = new Date().toISOString().split("T")[0];
  const isEdicao = !!edicao?.id;

  const categoriasPadrao = [
    ...CATEGORIAS_SISTEMA_FIXAS.map((categoria) => categoria.nome),
    "Alimentação",
    "Lavagem",
    "Seguro",
    "Acessórios",
    "Impostos",
    "Multa",
    "Documentação",
    "Outros",
  ];

  const formasPagamento = [
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Sai da carteira" },
    { valor: "pix", titulo: "Pix", descricao: "Sai direto da conta" },
    { valor: "debito", titulo: "Débito", descricao: "Sai direto da conta" },
    {
      valor: "credito_avista",
      titulo: "Crédito à Vista",
      descricao: "Entra na próxima fatura do cartão",
    },
    {
      valor: "credito_parcelado",
      titulo: "Crédito Parcelado",
      descricao: "Divide em 2x ou mais no cartão",
    },
    { valor: "boleto", titulo: "Boleto", descricao: "Registra uma conta a pagar" },
    { valor: "boleto_parcelado", titulo: "Boleto Parcelado", descricao: "Gera várias contas a pagar por vencimento" },
  ];

  const formasPagamentoDisponiveis =
    modo === "futura"
      ? formasPagamento.filter((item) => ["boleto", "boleto_parcelado"].includes(item.valor))
      : formasPagamento;

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [categorias, setCategorias] = useState(
    categoriasPadrao.map((nome) => ({ id: null, nome }))
  );

  const [dataCompra, setDataCompra] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [categoria, setCategoria] = useState(categoriaBloqueada ? categoriaInicial : "");
  const [categoriaId, setCategoriaId] = useState(null);
  const [finalidade, setFinalidade] = useState("");
  const [etapa, setEtapa] = useState("dados");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(modo === "futura" ? "boleto" : "");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("1");
  const [valorParcela, setValorParcela] = useState("");
  const [ultimoCampoEditado, setUltimoCampoEditado] = useState("total");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVencimentoAberto, setModalVencimentoAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalGerenciarCategoriasAberto, setModalGerenciarCategoriasAberto] = useState(false);
  const [modoGerenciamentoCategorias, setModoGerenciamentoCategorias] = useState("normal");
  const [buscaAdicionarCategoria, setBuscaAdicionarCategoria] = useState("");
  const [categoriasSelecionadasExcluir, setCategoriasSelecionadasExcluir] = useState([]);
  const [nomeCategoriaGerenciador, setNomeCategoriaGerenciador] = useState("");
  const [tipoUsoCategoriaGerenciador, setTipoUsoCategoriaGerenciador] = useState("opcional");
  const [categoriaEditandoGerenciador, setCategoriaEditandoGerenciador] = useState(null);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);

  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });

  const isCredito =
    formaPagamento === "credito_avista" || formaPagamento === "credito_parcelado";
  const isCreditoParcelado = formaPagamento === "credito_parcelado";
  const isBoleto = formaPagamento === "boleto";
  const isBoletoParcelado = formaPagamento === "boleto_parcelado";
  const isContaPagar = isBoleto || isBoletoParcelado;
  const isParcelado = isCreditoParcelado || isBoletoParcelado;
  const isDinheiro = formaPagamento === "dinheiro";

  const carteiraSelecionada = useMemo(
    () => contas.find((conta) => conta.tipo_conta === "carteira"),
    [contas]
  );

  const contasBancarias = useMemo(
    () => contas.filter((conta) => (conta.tipo_conta || "banco") === "banco"),
    [contas]
  );

  const contaSelecionada = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaId)),
    [contas, contaId]
  );

  const cartaoSelecionado = useMemo(
    () => cartoes.find((cartao) => String(cartao.id) === String(cartaoId)),
    [cartoes, cartaoId]
  );

  const categoriasOcultasNaSaidaComum = [
    "abastecimento",
    "manutencao",
    "manutenção",
    "mensalidade da tag",
    "mensalidade tag",
  ];

  const categoriasDisponiveis = useMemo(
    () =>
      categorias
        .filter((item) => {
          if (item.ativo === false || !item.nome) return false;

          const nomeNormalizado = normalizarTexto(item.nome);

          return !categoriasOcultasNaSaidaComum.includes(nomeNormalizado);
        })
        .sort((a, b) =>
          String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
            sensitivity: "base",
          })
        ),
    [categorias]
  );

  const categoriasNomes = useMemo(
    () => categoriasDisponiveis.map((item) => item.nome).filter(Boolean),
    [categoriasDisponiveis]
  );

  const categoriaSelecionada = useMemo(
    () => categorias.find((item) => item.nome === categoria),
    [categorias, categoria]
  );

  useEffect(() => {
    setCategoriaId(categoriaSelecionada?.id || null);
  }, [categoriaSelecionada]);

  function preencherFormularioEdicao() {
    if (!edicao) return;

    const dataBase = edicao.data_compra || edicao.data_vencimento || hoje;
    setDataCompra(dataBase);
    setDataVencimento(edicao.data_vencimento || dataBase);
    setCategoria(edicao.categoria || categoriaInicial || "Outros");
    setCategoriaId(edicao.categoria_id || null);
    setFinalidade(edicao.finalidade || "trabalho");
    setDescricao(edicao.descricao || "");
    setValorTotal(numeroParaMoedaInput(edicao.valor_total || 0));
    setValorParcela(numeroParaMoedaInput(edicao.valor_parcela || edicao.valor_total || 0));
    setFormaPagamento(edicao.forma_pagamento || "");
    setContaId(edicao.conta_id ? String(edicao.conta_id) : "");
    setCartaoId(edicao.cartao_id ? String(edicao.cartao_id) : "");
    setNumeroParcelas(String(edicao.numero_parcelas || 1));
    setUltimoCampoEditado("total");
    setEtapa("dados");
  }

  useEffect(() => {
    if (!aberto) return;
    carregarDados();

    if (isEdicao) {
      preencherFormularioEdicao();
      return;
    }

    resetarFormulario(false);
  }, [aberto, categoriaInicial, modo, edicao?.id]);

  useEffect(() => {
    if (isDinheiro && carteiraSelecionada) {
      setContaId(String(carteiraSelecionada.id));
      setCartaoId("");
    }
  }, [isDinheiro, carteiraSelecionada]);

  useEffect(() => {
    if (!isParcelado) return;

    const total = moedaParaNumero(valorTotal);
    const parcelas = Number(numeroParcelas || 1);

    if (ultimoCampoEditado === "total" && total > 0 && parcelas > 0) {
      setValorParcela(numeroParaMoedaInput(total / parcelas));
    }
  }, [valorTotal, numeroParcelas, isParcelado, ultimoCampoEditado]);

  useEffect(() => {
    if (!isParcelado) return;

    const parcela = moedaParaNumero(valorParcela);
    const parcelas = Number(numeroParcelas || 1);

    if (ultimoCampoEditado === "parcela" && parcela > 0 && parcelas > 0) {
      setValorTotal(numeroParaMoedaInput(parcela * parcelas));
    }
  }, [valorParcela, numeroParcelas, isParcelado, ultimoCampoEditado]);

  async function carregarCategorias() {
    const fallback = categoriasPadrao.map((nome) => ({ id: null, nome, ativo: true }));

    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, ativo, ordem, tipo_uso")
      .eq("tipo", "saida")
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar categorias:", error);
      setCategorias(fallback);
      return fallback;
    }

    const lista = (data || [])
      .map((item) => ({ id: item.id, nome: item.nome, ativo: item.ativo !== false, tipo_uso: item.tipo_uso || "rateada" }))
      .filter((item) => item.nome);

    const categoriasFinais = lista.length > 0 ? lista : fallback;
    setCategorias(categoriasFinais);
    return categoriasFinais;
  }

  async function carregarDados() {
    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const { data: cartoesData } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const categoriasData = await carregarCategorias();

    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);

    setContas(contasComSaldo);
    setCartoes(cartoesComUso);

    const categoriaEncontrada = categoriasData.find(
      (item) => item.nome === categoriaInicial
    );
    setCategoriaId(categoriaEncontrada?.id || null);

    const carteira = contasComSaldo.find((conta) => conta.tipo_conta === "carteira");
    const principal = contasComSaldo.find((conta) => conta.principal);
    const bancoPadrao = principal || contasComSaldo.find((conta) => conta.tipo_conta === "banco");

    if (formaPagamento === "dinheiro" && carteira) setContaId(String(carteira.id));
  }

  async function carregarContasComSaldo(contasBase) {
    return Promise.all(
      (contasBase || []).map(async (conta) => {
        const contaIdAtual = conta.id;

        const { data: entradas } = await supabase
          .from("entradas")
          .select(`entrada_plataformas ( faturamento, valor_reembolso )`)
          .eq("conta_id", contaIdAtual);

        const totalEntradas = (entradas || []).reduce((total, entrada) => {
          const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
            (soma, item) =>
              soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0),
            0
          );

          return total + totalPlataformas;
        }, 0);

        const { data: entradasAvulsas } = await supabase
          .from("entradas_avulsas")
          .select("valor")
          .eq("conta_id", contaIdAtual);

        const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
          (total, item) => total + Number(item.valor || 0),
          0
        );

        const { data: transferenciasRecebidas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_destino_id", contaIdAtual);

        const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
          (total, item) => total + Number(item.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaIdAtual);

        const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
          (total, item) => total + Number(item.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", contaIdAtual);

        const totalSaidas = (saidas || [])
          .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
          .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

        const saldoAtual =
          Number(conta.saldo_inicial || 0) +
          totalEntradas +
          totalEntradasAvulsas +
          totalTransferenciasRecebidas -
          totalSaidas -
          totalTransferenciasEnviadas;

        return {
          ...conta,
          tipo_conta: conta.tipo_conta || "banco",
          saldo_atual: saldoAtual,
        };
      })
    );
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];

    const ids = listaCartoes.map((cartao) => cartao.id);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select("cartao_id, valor_total, status")
      .in("cartao_id", ids)
      .in("status", ["aberta", "fechada"]);

    return listaCartoes.map((cartao) => {
      const usado = (faturasData || [])
        .filter((fatura) => Number(fatura.cartao_id) === Number(cartao.id))
        .reduce((total, fatura) => total + Number(fatura.valor_total || 0), 0);

      return { ...cartao, usado };
    });
  }

  function normalizarTexto(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarMoedaDigitada(valor) {
    const somenteDigitos = String(valor || "").replace(/\D/g, "");
    const centavos = Number(somenteDigitos || 0);

    return (centavos / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", "."));
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function abrirFeedback(tipo, tituloFeedback, mensagem, fecharDepois = false) {
    setFeedback({
      aberto: true,
      tipo,
      titulo: tituloFeedback,
      mensagem,
      fecharDepois,
    });
  }

  function fecharFeedback() {
    const fecharDepois = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      fecharDepois: false,
    });

    if (fecharDepois) {
      onClose();
    }
  }

  function resetarFormulario(limparTudo = true) {
    setDataCompra("");
    setDataVencimento("");

    if (categoriaBloqueada) {
      setCategoria(categoriaInicial);
      const categoriaEncontrada = categorias.find(
        (item) => item.nome === categoriaInicial
      );
      setCategoriaId(categoriaEncontrada?.id || null);
      setFinalidade(categoriaEncontrada?.tipo_uso && categoriaEncontrada.tipo_uso !== "opcional" ? categoriaEncontrada.tipo_uso : "trabalho");
    } else {
      setCategoria("");
      setCategoriaId(null);
      setFinalidade("");
    }

    setEtapa("dados");
    setDescricao("");
    setValorTotal("");
    setFormaPagamento(modo === "futura" ? "boleto" : "");
    setContaId("");
    setCartaoId("");
    setNumeroParcelas("1");
    setValorParcela("");
    setUltimoCampoEditado("total");
  }

  function formularioTemAlteracoes() {
    const categoriaAlterada = categoriaBloqueada
      ? categoria !== categoriaInicial
      : Boolean(categoria);

    const formaPagamentoAlterada = modo === "futura"
      ? false
      : Boolean(formaPagamento);

    const parcelamentoAlterado =
      numeroParcelas !== "1" || Boolean(valorParcela);

    return Boolean(
      dataCompra ||
        dataVencimento ||
        categoriaAlterada ||
        descricao ||
        valorTotal ||
        formaPagamentoAlterada ||
        contaId ||
        cartaoId ||
        parcelamentoAlterado
    );
  }

  function cancelar() {
    if (formularioTemAlteracoes()) {
      setModalCancelarAberto(true);
      return;
    }

    resetarFormulario();
    onClose();
  }

  function confirmarCancelamento() {
    setModalCancelarAberto(false);
    resetarFormulario();
    onClose();
  }

  function textoFormaPagamento() {
    return formasPagamento.find((item) => item.valor === formaPagamento)?.titulo || "Selecione a forma de pagamento";
  }

  function textoContaCartao() {
    if (isCredito) {
      if (!cartaoSelecionado) return "Selecionar cartão";
      return nomeCartaoComFinal(cartaoSelecionado);
    }

    if (isDinheiro) return carteiraSelecionada?.nome || "Carteira";

    return contaSelecionada?.nome || "Selecione uma conta";
  }

  function definirContaBancariaPadrao() {
    setContaId("");
  }

  function atualizarValorTotal(valor) {
    setUltimoCampoEditado("total");
    setValorTotal(formatarMoedaDigitada(valor));
  }

  function aplicarTipoUsoDaCategoria(categoriaEncontrada) {
    const tipoUso = categoriaEncontrada?.tipo_uso || "opcional";

    if (tipoUso === "opcional") {
      setFinalidade("");
      setEtapa("tipo_uso");
      return;
    }

    setFinalidade(tipoUso);
    setEtapa("dados");
  }

  function selecionarCategoria(nomeCategoria) {
    const categoriaEncontrada = categorias.find(
      (item) => item.nome === nomeCategoria
    );

    setCategoria(nomeCategoria);
    setCategoriaId(categoriaEncontrada?.id || null);
    aplicarTipoUsoDaCategoria(categoriaEncontrada || { nome: nomeCategoria, tipo_uso: "opcional" });
  }

  function textoFinalidade(valor) {
    const nomes = {
      trabalho: "Uso à trabalho",
      pessoal: "Uso pessoal",
      rateada: "Calculado pelo uso do veículo",
      opcional: "Escolher no lançamento",
    };

    return nomes[valor] || "Uso à trabalho";
  }

  function corTextoTipoUso(valor) {
    if (valor === "trabalho") return "text-green-400";
    if (valor === "pessoal") return "text-blue-400";
    if (valor === "opcional") return "text-purple-400";
    return "text-yellow-400";
  }

  function adicionarCategoriaNaLista(novaCategoria) {
    if (!novaCategoria?.nome) return;

    const categoriaFormatada = {
      id: novaCategoria.id || null,
      nome: novaCategoria.nome,
      tipo_uso: novaCategoria.tipo_uso || finalidade || "rateada",
    };

    setCategorias((lista) => {
      const jaExiste = lista.some(
        (item) => String(item.nome).toLowerCase() === String(categoriaFormatada.nome).toLowerCase()
      );

      if (jaExiste) {
        return lista.map((item) =>
          String(item.nome).toLowerCase() === String(categoriaFormatada.nome).toLowerCase()
            ? { ...item, ...categoriaFormatada }
            : item
        );
      }

      return [...lista, categoriaFormatada].sort((a, b) =>
        String(a.nome).localeCompare(String(b.nome), "pt-BR")
      );
    });

    setCategoria(categoriaFormatada.nome);
    setCategoriaId(categoriaFormatada.id || null);
    aplicarTipoUsoDaCategoria(categoriaFormatada);
  }


  function abrirGerenciadorCategorias() {
    setModoGerenciamentoCategorias("normal");
    setBuscaAdicionarCategoria("");
    setCategoriasSelecionadasExcluir([]);
    setModalGerenciarCategoriasAberto(true);
  }

  function fecharGerenciadorCategorias() {
    setModoGerenciamentoCategorias("normal");
    setBuscaAdicionarCategoria("");
    setCategoriasSelecionadasExcluir([]);
    setModalGerenciarCategoriasAberto(false);
  }

  function alternarCategoriaSelecionadaExcluir(id) {
    setCategoriasSelecionadasExcluir((lista) =>
      lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]
    );
  }

  async function alternarCategoriaAtiva(categoriaItem) {
    const { error } = await supabase
      .from("categorias")
      .update({ ativo: !categoriaItem.ativo })
      .eq("id", categoriaItem.id);

    if (error) {
      abrirFeedback("erro", "Erro ao alterar", error.message || "Erro ao alterar categoria.");
      return;
    }

    await carregarCategorias();
  }

  async function adicionarCategoriaPeloGerenciador() {
    const nomeLimpo = buscaAdicionarCategoria.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Digite o nome da categoria.");
      return;
    }

    const existente = categorias.find(
      (item) => normalizarTexto(item.nome) === normalizarTexto(nomeLimpo)
    );

    if (existente?.ativo) {
      abrirFeedback("aviso", "Categoria já existe", "Essa categoria já está ativa na lista.");
      setBuscaAdicionarCategoria("");
      setModoGerenciamentoCategorias("normal");
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
      setBuscaAdicionarCategoria("");
      setModoGerenciamentoCategorias("normal");
      await carregarCategorias();
      return;
    }

    setCategoria(nomeLimpo);
    setTipoUsoCategoriaGerenciador("opcional");
    setNomeCategoriaGerenciador(nomeLimpo);
    setModoGerenciamentoCategorias("cadastro");
  }

  function abrirCadastroCategoriaGerenciador(nomeInicial = "") {
    setCategoriaEditandoGerenciador(null);
    setNomeCategoriaGerenciador(nomeInicial);
    setTipoUsoCategoriaGerenciador("opcional");
    setModoGerenciamentoCategorias("cadastro");
  }

  function abrirEdicaoCategoriaGerenciador(categoriaItem) {
    setCategoriaEditandoGerenciador(categoriaItem);
    setNomeCategoriaGerenciador(categoriaItem.nome || "");
    setTipoUsoCategoriaGerenciador(categoriaItem.tipo_uso || "opcional");
    setModoGerenciamentoCategorias("cadastro");
  }

  async function salvarCategoriaGerenciador() {
    const nomeLimpo = nomeCategoriaGerenciador.trim();

    if (!nomeLimpo) {
      abrirFeedback("erro", "Nome obrigatório", "Informe o nome da categoria.");
      return;
    }

    setSalvando(true);

    try {
      if (categoriaEditandoGerenciador) {
        const { error } = await supabase
          .from("categorias")
          .update({ nome: nomeLimpo, tipo_uso: tipoUsoCategoriaGerenciador, ativo: true })
          .eq("id", categoriaEditandoGerenciador.id);

        if (error) throw error;
      } else {
        const existente = categorias.find(
          (item) => normalizarTexto(item.nome) === normalizarTexto(nomeLimpo)
        );

        if (existente) {
          const { error } = await supabase
            .from("categorias")
            .update({ ativo: true, tipo_uso: tipoUsoCategoriaGerenciador })
            .eq("id", existente.id);

          if (error) throw error;
        } else {
          const proximaOrdem = Math.max(0, ...categorias.map((item) => Number(item.ordem || 0))) + 1;

          const { error } = await supabase.from("categorias").insert({
            nome: nomeLimpo,
            tipo: "saida",
            tipo_uso: tipoUsoCategoriaGerenciador,
            ativo: true,
            ordem: proximaOrdem,
          });

          if (error) throw error;
        }
      }

      abrirFeedback("sucesso", "Categoria criada", "Categoria cadastrada com sucesso.");
      setModoGerenciamentoCategorias("normal");
      setBuscaAdicionarCategoria("");
      setNomeCategoriaGerenciador("");
      setTipoUsoCategoriaGerenciador("opcional");
      setCategoriaEditandoGerenciador(null);
      await carregarCategorias();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCategoriasSelecionadasGerenciador() {
    if (categoriasSelecionadasExcluir.length === 0) {
      abrirFeedback("aviso", "Nenhuma categoria selecionada", "Selecione pelo menos uma categoria.");
      return;
    }

    const categoriasSelecionadas = categorias.filter((item) =>
      categoriasSelecionadasExcluir.includes(item.id)
    );

    const nomesSelecionados = categoriasSelecionadas.map((item) => item.nome);

    const { data: saidasPorId, error: erroSaidasPorId } = await supabase
      .from("saidas")
      .select("categoria_id")
      .in("categoria_id", categoriasSelecionadasExcluir);

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

    const idsEmUso = new Set((saidasPorId || []).map((item) => Number(item.categoria_id)).filter(Boolean));
    const nomesEmUso = new Set((saidasPorNome || []).map((item) => normalizarTexto(item.categoria)));

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
    setCategoriasSelecionadasExcluir([]);
    setModoGerenciamentoCategorias("normal");
    await carregarCategorias();
  }

  function definirStatus() {
    if (isContaPagar) return "aberto";
    if (isCredito) return "fatura";
    return "pago";
  }

  function definirTipoMovimentacao() {
    if (isContaPagar) return "conta_pagar";
    return "saida";
  }

  function descricaoParcelaBoleto(index, parcelas) {
    const base = descricao.trim();
    return `${base} (${index + 1}/${parcelas})`;
  }

  async function buscarOuCriarFatura({ cartao, dataBase }) {
    const competencia = calcularCompetenciaFaturaPorCompra(dataBase, cartao);

    const dataFechamento = ajustarVencimentoFimDeSemana(
      dataComDiaSeguro(
        competencia.anoFechamento,
        competencia.mesFechamento,
        cartao.dia_fechamento
      )
    );

    const dataVencimento = dataComDiaSeguro(
      competencia.ano,
      competencia.mes,
      cartao.dia_vencimento
    );

    return obterOuCriarFaturaPadrao(supabase, {
      cartao_id: Number(cartao.id),
      mes: competencia.mes,
      ano: competencia.ano,
      data_fechamento: dataFechamento,
      data_vencimento: dataVencimento,
    });
  }

  
  async function recalcularFaturaPorParcelas(faturaId) {
    return recalcularFaturaPorParcelasCompartilhada(supabase, faturaId);
  }

  async function recalcularFaturasDaSaida(saidaId) {
    if (!saidaId) return;

    const { data: parcelas, error } = await supabase
      .from("saidas_parcelas")
      .select("fatura_id")
      .eq("saida_id", Number(saidaId));

    if (error) throw error;

    const ids = [...new Set((parcelas || []).map((parcela) => parcela.fatura_id).filter(Boolean))];

    for (const faturaId of ids) {
      await recalcularFaturaPorParcelas(faturaId);
    }
  }

async function atualizarValorFatura(faturaId, valorSomar) {
    const { data: fatura, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("valor_total, valor_pago, status")
      .eq("id", faturaId)
      .single();

    if (erroBusca) throw erroBusca;

    const novoTotal = Math.max(
      Math.round((Number(fatura.valor_total || 0) + Number(valorSomar || 0)) * 100) / 100,
      0
    );

    const valorPago = Math.min(Number(fatura.valor_pago || 0), novoTotal);
    const novoStatus = calcularStatusFaturaComPagamento({
      valorTotal: novoTotal,
      valorPago,
      statusAnterior: fatura.status,
    });

    const { error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({
        valor_total: novoTotal,
        valor_pago: valorPago,
        status: novoStatus,
      })
      .eq("id", faturaId);

    if (erroUpdate) throw erroUpdate;
  }

  async function obterCartaoAtualObrigatorio() {
    const idSelecionado = cartaoId ? Number(cartaoId) : null;
    if (!idSelecionado) throw new Error("Selecione um cartão.");

    const cartaoLocal = cartoes.find((cartao) => Number(cartao.id) === idSelecionado);
    if (cartaoLocal) return cartaoLocal;

    const { data: cartaoBanco, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("id", idSelecionado)
      .maybeSingle();

    if (error) throw error;
    if (!cartaoBanco) throw new Error("Cartão selecionado não encontrado.");

    return cartaoBanco;
  }

  async function verificarLimiteCartao(total) {
    if (!isCredito) return true;

    const cartaoAtual = await obterCartaoAtualObrigatorio();

    const { data: faturasAbertas, error: erroFaturas } = await supabase
      .from("faturas_cartao")
      .select("valor_total, valor_pago")
      .eq("cartao_id", Number(cartaoAtual.id))
      .in("status", ["aberta", "fechada", "parcial"]);

    if (erroFaturas) throw erroFaturas;

    const usadoAtual = (faturasAbertas || []).reduce(
      (totalAtual, fatura) =>
        totalAtual +
        calcularSaldoAbertoFatura(fatura),
      0
    );

    const limite = Number(cartaoAtual.limite_total || 0);
    const disponivel = limite - usadoAtual;

    if (limite > 0 && total > disponivel) {
      return window.confirm(
        "⚠ Esta compra ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?"
      );
    }

    return true;
  }

  async function gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas) {
    if (!isCredito) return;

    const cartaoAtual = await obterCartaoAtualObrigatorio();

    return gerarParcelasEFaturasPadrao(supabase, {
      saidaId,
      cartao: cartaoAtual,
      cartaoId: cartaoAtual.id,
      dataBase: dataCompra,
      quantidadeParcelas: parcelas,
      valorParcela: parcelaValor,
      recalcularAoFinal: () => recalcularFaturasDaSaida(saidaId),
    });
  }


  function formaEhCredito(valor) {
    return valor === "credito_avista" || valor === "credito_parcelado";
  }

  async function gerarParcelasEFaturasExplicito({
    saidaId,
    cartaoIdAtual,
    dataCompraAtual,
    formaPagamentoAtual,
    totalAtual,
    parcelaValorAtual,
    parcelasAtual,
  }) {
    if (!formaEhCredito(formaPagamentoAtual)) return;

    const idCartao = Number(cartaoIdAtual || 0);
    if (!idCartao) throw new Error("Selecione um cartão.");

    const cartaoLocal = cartoes.find((cartao) => Number(cartao.id) === idCartao);
    const cartaoAtual = cartaoLocal || (await supabase
      .from("cartoes")
      .select("*")
      .eq("id", idCartao)
      .maybeSingle()).data;

    if (!cartaoAtual?.id) throw new Error("Cartão selecionado não encontrado.");

    const quantidadeParcelas = Math.max(Number(parcelasAtual || 1), 1);
    const valorParcelaFinal = Math.round(Number(parcelaValorAtual || totalAtual || 0) * 100) / 100;
    const dataBaseCompra = dataCompraAtual || hoje;
    const parcelasPayload = [];

    for (let index = 0; index < quantidadeParcelas; index++) {
      const dataParcela = somarMesesData(dataBaseCompra, index);
      const dataBase = dataParcela.toISOString().split("T")[0];
      const fatura = await buscarOuCriarFatura({ cartao: cartaoAtual, dataBase });

      await atualizarValorFatura(fatura.id, valorParcelaFinal);

      parcelasPayload.push(criarPayloadParcela({
        saida_id: Number(saidaId),
        cartao_id: Number(cartaoAtual.id),
        fatura_id: Number(fatura.id),
        numero_parcela: index + 1,
        total_parcelas: quantidadeParcelas,
        valor_parcela: valorParcelaFinal,
        data_vencimento: fatura.data_vencimento,
        status: "pendente",
      }));
    }

    if (parcelasPayload.length > 0) {
      const { error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .insert(parcelasPayload);

      if (erroParcelas) throw erroParcelas;
      await recalcularFaturasDaSaida(saidaId);
    }
  }

  async function ajustarFaturasAoRemoverParcelasDaSaida(saidaId) {
    return removerParcelasDaSaidaERecalcularFaturas(supabase, saidaId);
  }

  async function recalcularContaPagarOrigem(contaPagarId) {
    if (!contaPagarId) return;

    const { data: contaOriginal, error: erroConta } = await supabase
      .from("saidas")
      .select("id, valor_total")
      .eq("id", contaPagarId)
      .maybeSingle();

    if (erroConta) throw erroConta;
    if (!contaOriginal) return;

    const { data: pagamentos, error: erroPagamentos } = await supabase
      .from("saidas")
      .select("valor_total, data_efetivacao, data_compra, created_at")
      .eq("conta_pagar_origem_id", contaPagarId);

    if (erroPagamentos) throw erroPagamentos;

    const valorPago = Math.max(
      Math.round(
        (pagamentos || []).reduce(
          (total, pagamento) => total + Number(pagamento.valor_total || 0),
          0
        ) * 100
      ) / 100,
      0
    );

    const totalOriginal = Number(contaOriginal.valor_total || 0);
    const saldo = Math.max(Math.round((totalOriginal - valorPago) * 100) / 100, 0);
    const novoStatus = valorPago <= 0 ? "pendente" : saldo > 0 ? "parcial" : "pago";

    const pagamentosOrdenados = [...(pagamentos || [])].sort((a, b) => {
      const dataA = new Date(a.data_efetivacao || a.data_compra || a.created_at || 0).getTime();
      const dataB = new Date(b.data_efetivacao || b.data_compra || b.created_at || 0).getTime();
      return dataB - dataA;
    });

    const dataEfetivacao = novoStatus === "pago"
      ? pagamentosOrdenados[0]?.data_efetivacao || pagamentosOrdenados[0]?.data_compra || null
      : null;

    const { error: erroUpdate } = await supabase
      .from("saidas")
      .update({
        valor_pago: valorPago,
        status: novoStatus,
        data_efetivacao: dataEfetivacao,
      })
      .eq("id", contaPagarId);

    if (erroUpdate) throw erroUpdate;
  }

  function validarCampos() {
    if (!formaPagamento) {
      abrirFeedback("erro", "Forma de pagamento obrigatória", "Selecione a forma de pagamento.");
      return false;
    }

    if (!categoria) {
      abrirFeedback("erro", "Categoria obrigatória", "Selecione a categoria da despesa.");
      return false;
    }

    if (!finalidade) {
      abrirFeedback("erro", "Tipo de uso obrigatório", "Informe se a despesa foi de uso pessoal ou à trabalho.");
      return false;
    }

    if (modo !== "futura" && !dataCompra) {
      abrirFeedback("erro", "Data obrigatória", "Selecione a data da compra.");
      return false;
    }

    if (!valorTotal) {
      abrirFeedback("erro", "Valor obrigatório", "Informe o valor da despesa.");
      return false;
    }

    if (!descricao.trim()) {
      abrirFeedback("erro", "Descrição obrigatória", "Informe a descrição da despesa.");
      return false;
    }

    if (isCredito && !cartaoId) {
      abrirFeedback("erro", "Cartão obrigatório", "Selecione um cartão.");
      return false;
    }

    if (isDinheiro && !carteiraSelecionada) {
      abrirFeedback(
        "erro",
        "Carteira não encontrada",
        "Cadastre uma conta do tipo Carteira antes de lançar pagamento em dinheiro."
      );
      return false;
    }

    if (!isCredito && !isContaPagar && !contaId) {
      abrirFeedback("erro", "Conta obrigatória", "Selecione uma conta.");
      return false;
    }

    if (isContaPagar && !dataVencimento) {
      abrirFeedback("erro", "Vencimento obrigatório", isBoletoParcelado ? "Informe o primeiro vencimento." : "Informe a data de vencimento.");
      return false;
    }

    if (modo !== "futura" && isContaPagar && dataCompra && dataVencimento && dataVencimento < dataCompra) {
      abrirFeedback("erro", "Vencimento inválido", "O vencimento do boleto não pode ser anterior à data da compra.");
      return false;
    }

    if (isCreditoParcelado && Number(numeroParcelas || 0) < 2) {
      abrirFeedback("erro", "Parcelamento inválido", "Crédito parcelado precisa começar em 2x.");
      return false;
    }

    if (isBoletoParcelado && Number(numeroParcelas || 0) < 2) {
      abrirFeedback("erro", "Parcelamento inválido", "Boleto parcelado precisa começar em 2x.");
      return false;
    }

    if (moedaParaNumero(valorTotal) <= 0) {
      abrirFeedback("erro", "Valor inválido", "Informe um valor maior que zero.");
      return false;
    }

    return true;
  }

  async function salvarSaida() {
    if (!validarCampos()) return;

    const total = moedaParaNumero(valorTotal);
    const parcelas = isParcelado ? Number(numeroParcelas || 2) : 1;
    const parcelaValor = isParcelado ? moedaParaNumero(valorParcela) : total;

    if (isCredito) {
      const limiteOk = await verificarLimiteCartao(total);
      if (!limiteOk) return;
    }

    setSalvando(true);

    try {
      if (isEdicao) {
        const { data: saidaAntesEdicao, error: erroBuscaSaida } = await supabase
          .from("saidas")
          .select("id, conta_pagar_origem_id")
          .eq("id", edicao.id)
          .maybeSingle();

        if (erroBuscaSaida) throw erroBuscaSaida;

        await ajustarFaturasAoRemoverParcelasDaSaida(edicao.id);

        const payloadEdicao = {
          data_compra: isContaPagar && modo === "futura" ? dataVencimento : dataCompra,
          forma_pagamento: formaPagamento,
          tipo_movimentacao: definirTipoMovimentacao(),
          conta_id: isCredito || isContaPagar ? null : Number(contaId),
          cartao_id: isCredito ? Number(cartaoId) : null,
          tipo_credito: isCredito ? (isCreditoParcelado ? "parcelado" : "avista") : null,
          numero_parcelas: parcelas,
          valor_total: total,
          valor_parcela: parcelaValor,
          data_efetivacao: isContaPagar ? null : dataCompra,
          data_vencimento: isContaPagar ? dataVencimento : null,
          categoria,
          categoria_id: categoriaId ? Number(categoriaId) : null,
          finalidade,
          descricao: descricao.trim(),
          status: definirStatus(),
        };

        const { error: erroEdicao } = await supabase
          .from("saidas")
          .update(payloadEdicao)
          .eq("id", edicao.id);

        if (erroEdicao) throw erroEdicao;

        if (formaEhCredito(formaPagamento)) {
          await gerarParcelasEFaturasExplicito({
            saidaId: edicao.id,
            cartaoIdAtual: cartaoId,
            dataCompraAtual: dataCompra,
            formaPagamentoAtual: formaPagamento,
            totalAtual: total,
            parcelaValorAtual: parcelaValor,
            parcelasAtual: parcelas,
          });
        }

        if (saidaAntesEdicao?.conta_pagar_origem_id) {
          await recalcularContaPagarOrigem(saidaAntesEdicao.conta_pagar_origem_id);
        }

        abrirFeedback("sucesso", "Lançamento atualizado", "As alterações foram salvas com sucesso.", true);
        await onSalvo?.();
        return;
      }

      if (isBoletoParcelado) {
        const parcelasPayload = Array.from({ length: parcelas }, (_, index) => {
          const vencimento = somarMesesDataISO(dataVencimento, index);

          return {
            data_compra: modo === "futura" ? vencimento : dataCompra,
            forma_pagamento: "boleto_parcelado",
            tipo_movimentacao: "conta_pagar",
            conta_id: null,
            cartao_id: null,
            tipo_credito: null,
            numero_parcelas: parcelas,
            valor_total: parcelaValor,
            valor_parcela: parcelaValor,
            data_efetivacao: null,
            data_vencimento: vencimento,
            categoria,
            categoria_id: categoriaId ? Number(categoriaId) : null,
            finalidade,
            descricao: descricaoParcelaBoleto(index, parcelas),
            status: "aberto",
          };
        });

        const { error: erroParcelasBoleto } = await supabase
          .from("saidas")
          .insert(parcelasPayload);

        if (erroParcelasBoleto) throw erroParcelasBoleto;

        abrirFeedback(
          "sucesso",
          "Boletos parcelados criados",
          `${parcelas} contas a pagar foram geradas com sucesso.`,
          true
        );

        resetarFormulario();
        return;
      }

      const { data: saidaCriada, error: erroSaida } = await supabase
        .from("saidas")
        .insert({
          data_compra: isContaPagar && modo === "futura" ? dataVencimento : dataCompra,
          forma_pagamento: formaPagamento,
          tipo_movimentacao: definirTipoMovimentacao(),
          conta_id: isCredito || isContaPagar ? null : Number(contaId),
          cartao_id: isCredito ? Number(cartaoId) : null,
          tipo_credito: isCredito ? (isCreditoParcelado ? "parcelado" : "avista") : null,
          numero_parcelas: parcelas,
          valor_total: total,
          valor_parcela: parcelaValor,
          data_efetivacao: isContaPagar ? null : dataCompra,
          data_vencimento: isContaPagar ? dataVencimento : null,
          categoria,
          categoria_id: categoriaId ? Number(categoriaId) : null,
          finalidade,
          descricao: descricao.trim(),
          status: definirStatus(),
        })
        .select()
        .single();

      if (erroSaida) throw erroSaida;

      if (formaEhCredito(formaPagamento)) {
        await gerarParcelasEFaturasExplicito({
          saidaId: saidaCriada.id,
          cartaoIdAtual: cartaoId,
          dataCompraAtual: dataCompra,
          formaPagamentoAtual: formaPagamento,
          totalAtual: total,
          parcelaValorAtual: parcelaValor,
          parcelasAtual: parcelas,
        });
      }

      abrirFeedback(
        "sucesso",
        modo === "futura" ? "Boleto futuro registrado" : isContaPagar ? "Despesa futura registrada" : "Despesa salva",
        isContaPagar
          ? "Conta a pagar registrada com sucesso. Ela ainda não alterou o saldo."
          : "Lançamento salvo com sucesso.",
        true
      );

      resetarFormulario();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={etapa === "tipo_uso" ? "Tipo de uso" : modo === "futura" ? "Boletos Futuros" : titulo}
        descricao={
          etapa === "tipo_uso"
            ? "Essa categoria permite escolher. Informe se foi uso à trabalho ou uso pessoal."
            : modo === "futura"
            ? "Registre um boleto para aparecer em Contas a Pagar."
            : descricaoModal
        }
        onClose={cancelar}
        largura={etapa === "dados" ? "max-w-3xl" : "max-w-2xl"}
      
        confirmarAoFecharSeAlterado>
        {false && etapa === "categoria" && null}


        {etapa === "tipo_uso" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TipoUsoCard
              ativo={finalidade === "trabalho"}
              icone="🚕"
              titulo="Uso à trabalho"
              descricao="Despesa ligada à operação, rotina na rua ou atividade como motorista."
              onClick={() => {
                setFinalidade("trabalho");
                setEtapa("dados");
              }}
            />

            <TipoUsoCard
              ativo={finalidade === "pessoal"}
              icone="🏠"
              titulo="Uso pessoal"
              descricao="Despesa da casa, família, lazer ou vida pessoal."
              onClick={() => {
                setFinalidade("pessoal");
                setEtapa("dados");
              }}
            />
          </div>
        )}

        {etapa === "dados" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modo !== "futura" && (
                <Campo label="Data da compra">
                  <ButtonField onClick={() => setModalDataAberto(true)}>
                    {dataCompra ? formatarDataBR(dataCompra) : "Selecionar data da compra"}
                  </ButtonField>
                </Campo>
              )}

              {!categoriaBloqueada && (
                <Campo label="Categoria">
                  <ButtonField onClick={() => setModalCategoriaAberto(true)}>
                    {categoria || "Selecionar categoria"}
                  </ButtonField>
                </Campo>
              )}

              {categoriaBloqueada && (
                <Campo label="Categoria">
                  <div className="w-full mt-2 bg-[#0B1120]/70 border border-gray-800 rounded-xl p-3 font-semibold text-gray-400 cursor-default">
                    {categoria}
                  </div>
                </Campo>
              )}

              <Campo label="Descrição">
                <input
                  type="text"
                  value={descricao}
                  placeholder={categoriaBloqueada && normalizarTexto(categoria) === "manutencao" ? "Ex: Revisão dos 140.000 km" : modo === "futura" ? "Ex: conta de luz, condomínio, internet..." : isContaPagar ? "Ex: compra no boleto, pedido online..." : "Ex: almoço, lavagem, seguro, IPVA..."}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
                />
              </Campo>

              {modo !== "futura" && (
                <Campo label="Forma de pagamento">
                  <ButtonField onClick={() => setModalPagamentoAberto(true)}>
                    {textoFormaPagamento()}
                  </ButtonField>
                </Campo>
              )}

              {isContaPagar && (
                <Campo label={isBoletoParcelado ? "Primeiro vencimento" : modo === "futura" ? "Data de vencimento" : "Vencimento do boleto"}>
                  <ButtonField onClick={() => setModalVencimentoAberto(true)}>
                    {dataVencimento ? formatarDataBR(dataVencimento) : isBoletoParcelado ? "Selecionar primeiro vencimento" : "Selecionar vencimento"}
                  </ButtonField>
                </Campo>
              )}

              {modo !== "futura" && !isContaPagar && (
                <Campo label={isCredito ? "Cartão" : isDinheiro ? "Carteira" : "Conta"}>
                  <ButtonField
                    onClick={() => {
                      if (isDinheiro) return;
                      isCredito ? setModalCartaoAberto(true) : setModalContaAberto(true);
                    }}
                  >
                    {textoContaCartao()}
                  </ButtonField>
                </Campo>
              )}

              <Campo label="Valor">
                <MoneyInput
                  value={valorTotal}
                  onChange={atualizarValorTotal}
                  prefix="R$"
                  placeholder=""
                />
              </Campo>
            </div>

            {modo !== "futura" && isParcelado && (
              <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                <p className="text-sm text-gray-300 font-semibold">{isBoletoParcelado ? "Parcelamento do boleto" : "Parcelamento"}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Campo label="Quantidade de parcelas">
                    <ButtonField onClick={() => setModalParcelasAberto(true)}>
                      {numeroParcelas}x
                    </ButtonField>
                  </Campo>

                  <Campo label="Valor da parcela">
                    <MoneyInput
                      value={valorParcela}
                      onChange={(valor) => {
                        setUltimoCampoEditado("parcela");
                        setValorParcela(formatarMoedaDigitada(valor));
                      }}
                      prefix="R$"
                      placeholder=""
                    />
                  </Campo>
                </div>
              </div>
            )}

            {modo !== "futura" && isContaPagar && (
              <div className="mt-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                <p className="text-sm text-blue-300 font-bold">{isBoletoParcelado ? "Boleto parcelado" : "Despesa futura"}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {isBoletoParcelado
                    ? "O app criará uma conta a pagar para cada parcela, usando o primeiro vencimento como base mensal."
                    : modo === "futura"
                    ? "Para contas futuras, o app usa apenas a data de vencimento. Ela aparece como conta a pagar e não altera o saldo até ser paga."
                    : "O app mantém a data da compra e registra o vencimento do boleto separadamente."}
                </p>
              </div>
            )}

            <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
              <button
                type="button"
                onClick={cancelar}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvarSaida}
                disabled={salvando}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                {salvando ? "Salvando..." : isEdicao ? "Salvar alterações" : "Salvar"}
              </button>
            </div>
          </>
        )}
      </ModalBase>

      <GerenciarCategoriasModal
        aberto={modalGerenciarCategoriasAberto}
        onClose={fecharGerenciadorCategorias}
        onAtualizar={carregarCategorias}
      />

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataCompra}
        onChange={(novaData) => {
          setDataCompra(novaData);
          if (dataVencimento && novaData && dataVencimento < novaData) {
            setDataVencimento("");
          }
        }}
        onClose={() => setModalDataAberto(false)}
        titulo="Selecionar data"
        descricao="Escolha a data da compra."
      />

      <DatePickerModal
        aberto={modalVencimentoAberto}
        valor={dataVencimento}
        onChange={setDataVencimento}
        onClose={() => setModalVencimentoAberto(false)}
        titulo={isBoletoParcelado ? "Primeiro vencimento" : modo === "futura" ? "Data de vencimento" : "Vencimento do boleto"}
        descricao="Escolha a data em que esta conta precisa ser paga."
        minDate={modo !== "futura" && isContaPagar ? dataCompra || null : null}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalPagamentoAberto}
        formasPagamento={formasPagamentoDisponiveis}
        formaPagamento={formaPagamento}
        onSelecionar={(valor) => {
          setFormaPagamento(valor);

          if (valor === "credito_parcelado") {
            setContaId("");
            setNumeroParcelas((atual) => (Number(atual || 0) < 2 ? "2" : atual));
          }

          if (valor === "credito_avista") {
            setContaId("");
            setNumeroParcelas("1");
            setValorParcela("");
          }

          if (valor === "boleto") {
            setContaId("");
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");
          }

          if (valor === "boleto_parcelado") {
            setContaId("");
            setCartaoId("");
            setNumeroParcelas((atual) => (Number(atual || 0) < 2 ? "2" : atual));
          }

          if (valor === "dinheiro") {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");
            if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id));
          }

          if (!["credito_avista", "credito_parcelado", "boleto", "boleto_parcelado"].includes(valor)) {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");

            if (valor === "dinheiro") {
              if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id));
            } else {
              setContaId("");
            }
          }
        }}
        onClose={() => setModalPagamentoAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasBancarias}
        contaId={contaId}
        onSelecionar={setContaId}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoId}
        onSelecionar={setCartaoId}
        onClose={() => setModalCartaoAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCategoriaModal
        aberto={modalCategoriaAberto}
        categorias={categoriasNomes}
        categoria={categoria}
        onSelecionar={selecionarCategoria}
        onClose={() => setModalCategoriaAberto(false)}
        permitirCriar={true}
        tipoUsoPadrao={finalidade}
        onCategoriaCriada={adicionarCategoriaNaLista}
        onAtualizarCategorias={carregarCategorias}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasAberto}
        numeroParcelas={numeroParcelas}
        onSelecionar={setNumeroParcelas}
        onClose={() => setModalParcelasAberto(false)}
      />

      <ConfirmacaoModal
        aberto={modalCancelarAberto}
        tipo="aviso"
        titulo="Cancelar lançamento?"
        mensagem="Os dados preenchidos serão perdidos. Deseja continuar?"
        textoCancelar="Continuar editando"
        textoConfirmar="Sim, cancelar"
        onCancelar={() => setModalCancelarAberto(false)}
        onConfirmar={confirmarCancelamento}
      />

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


function ModalGerenciarCategoriasSaida({
  aberto,
  categorias,
  modo,
  setModo,
  buscaAdicionar,
  setBuscaAdicionar,
  selecionadas,
  alternarSelecionada,
  onClose,
  onAdicionarBusca,
  onAbrirCadastro,
  onEditar,
  onAlternarAtivo,
  onExcluirSelecionadas,
  normalizarTexto,
  tituloTipoUso,
  corTextoTipoUso,
  nomeCadastro,
  setNomeCadastro,
  tipoUsoCadastro,
  setTipoUsoCadastro,
  categoriaEditando,
  onSalvarCadastro,
  salvando,
}) {
  if (!aberto) return null;

  const adicionando = modo === "adicionar";
  const editando = modo === "editar";
  const excluindo = modo === "excluir";
  const cadastrando = modo === "cadastro";

  const categoriasOrdenadas = [...categorias].sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    })
  );

  const buscaNormalizada = normalizarTexto(buscaAdicionar);
  const categoriasFiltradas = buscaNormalizada
    ? categoriasOrdenadas.filter((categoria) =>
        normalizarTexto(categoria.nome).includes(buscaNormalizada)
      )
    : categoriasOrdenadas;

  const categoriaExata = buscaNormalizada
    ? categoriasOrdenadas.find((categoria) => normalizarTexto(categoria.nome) === buscaNormalizada)
    : null;

  return (
    <ModalBase
      aberto={aberto}
      titulo="Gerenciar categorias"
      descricao="Adicione, edite ou exclua uma categoria desejada."
      onClose={onClose}
      largura="max-w-3xl"
      z="z-[100]"
    >
      {!cadastrando && (
        <>
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

                {buscaAdicionar.trim() && (!categoriaExata || !categoriaExata?.ativo) && (
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

          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hide pr-1">
            {categoriasFiltradas.map((categoriaItem) => {
              const selecionada = selecionadas.includes(categoriaItem.id);

              return (
                <div
                  key={categoriaItem.id || categoriaItem.nome}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (editando) onEditar(categoriaItem);
                    else if (excluindo) alternarSelecionada(categoriaItem.id);
                    else onAlternarAtivo(categoriaItem);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    if (editando) onEditar(categoriaItem);
                    else if (excluindo) alternarSelecionada(categoriaItem.id);
                    else onAlternarAtivo(categoriaItem);
                  }}
                  className={`rounded-xl border bg-[#0B1120] p-3 flex items-center gap-3 transition cursor-pointer hover:bg-white/5 ${
                    selecionada
                      ? "border-red-400 bg-red-500/10"
                      : categoriaItem.ativo
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
                    {categoriaItem.nome}
                  </p>

                  <span className={`text-xs sm:text-sm font-semibold shrink-0 text-right ${corTextoTipoUso(categoriaItem.tipo_uso)}`}>
                    {tituloTipoUso(categoriaItem.tipo_uso)}
                  </span>

                  {!editando && !excluindo && (
                    <span
                      className={`relative w-12 h-7 rounded-full transition shrink-0 ${
                        categoriaItem.ativo ? "bg-green-500" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${
                          categoriaItem.ativo ? "right-1" : "left-1"
                        }`}
                      />
                    </span>
                  )}
                </div>
              );
            })}
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
        </>
      )}

      {cadastrando && (
        <div className="space-y-5">
          <div>
            <label className="text-sm text-gray-300">Nome da categoria</label>
            <input
              type="text"
              value={nomeCadastro}
              onChange={(e) => setNomeCadastro(e.target.value)}
              placeholder="Ex: Seguro, IPVA, Mercado, Pneus..."
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
              autoFocus
            />
          </div>

          <div>
            <p className="text-sm text-gray-300">Tipo de uso padrão</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {[
                { valor: "trabalho", titulo: "Sempre trabalho" },
                { valor: "pessoal", titulo: "Sempre pessoal" },
                { valor: "rateada", titulo: "Calculado pelo uso do veículo" },
                { valor: "opcional", titulo: "Escolher no lançamento" },
              ].map((tipo) => {
                const ativo = tipoUsoCadastro === tipo.valor;

                return (
                  <button
                    key={tipo.valor}
                    type="button"
                    onClick={() => setTipoUsoCadastro(tipo.valor)}
                    className={`rounded-xl border p-4 text-left transition ${
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
              onClick={() => setModo("adicionar")}
              className="rounded-xl border border-gray-700 hover:bg-white/5 p-3 font-bold"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={onSalvarCadastro}
              disabled={salvando}
              className="rounded-xl bg-green-500 hover:bg-green-600 text-black p-3 font-black disabled:opacity-50"
            >
              {salvando ? "Salvando..." : categoriaEditando ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}

function TipoUsoCard({ ativo, icone, titulo, descricao, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-5 transition ${
        ativo
          ? "border-green-400 bg-green-500/10"
          : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
      }`}
    >
      <div className="text-3xl">{icone}</div>
      <h3 className="text-lg font-black mt-4 text-white">{titulo}</h3>
      <p className="text-sm text-gray-400 mt-2">{descricao}</p>
    </button>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      {children}
    </div>
  );
}

function ButtonField({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
    >
      {children}
    </button>
  );
}

function MoneyInput({ value, onChange, prefix, suffix, placeholder }) {
  return (
    <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
      {prefix && <span className="px-3 text-gray-400">{prefix}</span>}

      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />

      {suffix && <span className="px-3 text-gray-400">{suffix}</span>}
    </div>
  );
}
