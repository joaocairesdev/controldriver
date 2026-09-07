import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabase";
import TagFinanceiraCard from "../../tag/components/TagFinanceiraCard";
import TagModal from "../../tag/components/TagModal";
import VeiculoModal from "../components/VeiculoModal";
import ProtecaoModal from "../components/ProtecaoModal";
import CadastroVeiculoModal from "../components/CadastroVeiculoModal";
import {
  AquisicaoVeiculoModal,
  ConsumoCombustivelModal,
  DocumentacaoVeiculoModal,
  ManutencaoDetalhesModal,
} from "../components/CentralVeiculoModais";
import ModalBase from "../../../shared/components/modals/ModalBase";

import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiDollarSign,
  FiDroplet,
  FiEdit2,
  FiFileText,
  FiShield,
  FiStar,
  FiTag,
  FiTool,
  FiTrash2,
} from "react-icons/fi";
import {
  adicionarMesCompetencia,
  ajustarVencimentoFimDeSemana,
  buscarFaturaAtivaPorCompetencia,
  calcularSaldoAbertoFatura,
  criarPayloadParcela,
  dataComDiaSeguro,
  incrementarValorTotalFatura,
  nomeCartaoComFinal,
  somarMesesDataISO,
} from "../../cartoes/utils/cartoesUtils";
import {
  desativarContratoIncompativel,
  completarHorizontesAlugueis,
  salvarAluguelVeiculo,
  salvarFinanciamentoVeiculo,
} from "../services/veiculosFinanceiroService";
import { somarPagamentosDoAbastecimento } from "../../abastecimentos/utils/abastecimentosPagamentos";
import { calcularConsumosPorFonte } from "../utils/veiculosConsumo";
import { salvarAquisicaoVeiculo, salvarDocumentoVeiculo } from "../services/veiculoCentralService";
import { salvarProtecaoComContrato } from "../services/protecaoFinanceiroService";

const criarFinanciamentoPadrao = () => ({
  instituicaoFinanceira: "", valorVeiculo: "", valorFinanciado: "", entrada: "",
  saldoDevedor: "",
  totalParcelas: "", parcelasPagas: "0", numeroProximaParcela: "1", valorParcela: "",
  proximoVencimento: "", diaVencimento: "", observacoes: "", formaPagamento: "boleto",
  contaId: "", cartaoId: "",
});

const criarAluguelPadrao = () => ({
  locador: "", frequencia: "mensal", valor: "", dataInicio: "", proximoVencimento: "",
  diaCobranca: "", dataFim: "", observacoes: "", formaPagamento: "boleto",
  contaId: "", cartaoId: "", descontoPlataforma: false, plataformaId: "",
});

const criarCaucaoPadrao = () => ({
  houve: false, valor: "", data: "", formaPagamento: "pix", contaId: "", cartaoId: "",
  devolvivel: true, previsaoDevolucao: "", observacoes: "",
});

export default function Veiculos({ onConfiguracaoTagAlterada }) {
  const [veiculos, setVeiculos] = useState([]);
  const [contasBanco, setContasBanco] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [plataformas, setPlataformas] = useState([]);
  const [veiculoDetalhes, setVeiculoDetalhes] = useState(null);
  const [veiculoRetornoDashboardId, setVeiculoRetornoDashboardId] = useState(null);
  const [substituindoProtecao, setSubstituindoProtecao] = useState(false);
  const [somenteProtecao, setSomenteProtecao] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [veiculoEditando, setVeiculoEditando] = useState(null);
  const [modalCadastroRapidoAberto, setModalCadastroRapidoAberto] = useState(false);
  const [salvandoCadastroRapido, setSalvandoCadastroRapido] = useState(false);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [veiculoParaExcluir, setVeiculoParaExcluir] = useState(null);

  const [modalPrincipalAberto, setModalPrincipalAberto] = useState(false);
  const [veiculoParaPrincipal, setVeiculoParaPrincipal] = useState(null);

  const [modalKmInicialAberto, setModalKmInicialAberto] = useState(false);
  const [kmInicialPendente, setKmInicialPendente] = useState("");

  const [modalAviso, setModalAviso] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    tipo: "info",
  });

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [placa, setPlaca] = useState("");
  const [odometroInicial, setOdometroInicial] = useState("");
  const [categoriaVeiculo, setCategoriaVeiculo] = useState("flex");
  const [tipoPosse, setTipoPosse] = useState("");
  const [situacaoAquisicao, setSituacaoAquisicao] = useState("");
  const [financiamento, setFinanciamento] = useState(criarFinanciamentoPadrao);
  const [aluguel, setAluguel] = useState(criarAluguelPadrao);
  const [caucao, setCaucao] = useState(criarCaucaoPadrao);

  const [possuiTag, setPossuiTag] = useState(false);
  const [tagId, setTagId] = useState(null);
  const [nomeTag, setNomeTag] = useState("");
  const [tipoTag, setTipoTag] = useState("pre_paga");
  const [saldoInicialTag, setSaldoInicialTag] = useState("");
  const [recargaAutomaticaTag, setRecargaAutomaticaTag] = useState(false);
  const [valorRecargaTag, setValorRecargaTag] = useState("");
  const [percentualGatilhoTag, setPercentualGatilhoTag] = useState("30");
  const [formaRecargaTag, setFormaRecargaTag] = useState("credito_avista");
  const [contaRecargaTagId, setContaRecargaTagId] = useState("");
  const [cartaoRecargaTagId, setCartaoRecargaTagId] = useState("");

  const [protecaoId, setProtecaoId] = useState(null);
  const [tipoProtecaoVeiculo, setTipoProtecaoVeiculo] = useState("nenhuma");
  const [nomeProtecaoVeiculo, setNomeProtecaoVeiculo] = useState("");
  const [inicioVigenciaProtecao, setInicioVigenciaProtecao] = useState("");
  const [fimVigenciaProtecao, setFimVigenciaProtecao] = useState("");
  const [formaPagamentoProtecao, setFormaPagamentoProtecao] = useState("boleto_parcelado");
  const [valorProtecao, setValorProtecao] = useState("");
  const [numeroParcelasProtecao, setNumeroParcelasProtecao] = useState("12");
  const [parcelasPagasProtecao, setParcelasPagasProtecao] = useState("0");
  const [primeiroVencimentoProtecao, setPrimeiroVencimentoProtecao] = useState("");
  const [contaProtecaoId, setContaProtecaoId] = useState("");
  const [cartaoProtecaoId, setCartaoProtecaoId] = useState("");

  useEffect(() => {
    carregarTudo();
    // A carga inicial coordena funções locais estáveis e deve ocorrer apenas na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoriasVeiculo = [
    { valor: "gasolina", nome: "Gasolina", descricao: "Veículo movido somente a gasolina" },
    { valor: "etanol", nome: "Etanol", descricao: "Veículo movido somente a etanol" },
    { valor: "flex", nome: "Flex", descricao: "Aceita etanol e gasolina" },
    { valor: "gnv", nome: "GNV", descricao: "Usa gás natural veicular + combustível líquido" },
    { valor: "diesel", nome: "Diesel", descricao: "Veículo movido a diesel" },
    { valor: "hibrido", nome: "Híbrido", descricao: "Combustão + elétrico sem tomada" },
    { valor: "hibrido_plugin", nome: "Híbrido Plug-in", descricao: "Combustão + recarga elétrica" },
    { valor: "eletrico", nome: "Elétrico", descricao: "100% elétrico, sem combustível líquido" },
  ];

  function regrasDaCategoria(categoria) {
    const regras = {
      gasolina: { combustiveis: ["gasolina_comum", "gasolina_aditivada", "gasolina_podium"], eletrico: false },
      etanol: { combustiveis: ["etanol", "etanol_aditivado"], eletrico: false },
      flex: {
        combustiveis: ["etanol", "etanol_aditivado", "gasolina_comum", "gasolina_aditivada", "gasolina_podium"],
        eletrico: false,
      },
      gnv: { combustiveis: ["gnv", "gasolina_comum", "gasolina_aditivada", "etanol"], eletrico: false },
      diesel: { combustiveis: ["diesel"], eletrico: false },
      hibrido: { combustiveis: ["gasolina_comum", "gasolina_aditivada", "gasolina_podium"], eletrico: false },
      hibrido_plugin: {
        combustiveis: ["etanol", "etanol_aditivado", "gasolina_comum", "gasolina_aditivada", "gasolina_podium"],
        eletrico: true,
      },
      eletrico: { combustiveis: [], eletrico: true },
    };

    return regras[categoria] || regras.flex;
  }

  const formasRecargaTag = [
    { valor: "credito_avista", titulo: "Crédito à vista", descricao: "Recarga lançada no cartão de crédito" },
    { valor: "debito", titulo: "Débito", descricao: "Recarga debitada de uma conta bancária" },
    { valor: "pix", titulo: "Pix", descricao: "Recarga paga via Pix por uma conta bancária" },
  ];

  const formasPagamentoProtecao = [
    { valor: "pix", titulo: "Pix", descricao: "Lança como saída paga em conta" },
    { valor: "debito", titulo: "Débito", descricao: "Lança como saída paga em conta" },
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Lança como saída paga na carteira/conta escolhida" },
    { valor: "credito_avista", titulo: "Crédito à vista", descricao: "Entra na próxima fatura do cartão" },
    { valor: "credito_parcelado", titulo: "Crédito parcelado", descricao: "Gera as próximas parcelas nas faturas" },
    { valor: "boleto", titulo: "Boleto", descricao: "Gera uma conta a pagar" },
    { valor: "boleto_parcelado", titulo: "Boleto parcelado", descricao: "Gera parcelas em Contas a Pagar" },
  ];

  function textoFormaRecargaTag(valor) {
    return formasRecargaTag.find((item) => item.valor === valor)?.titulo || "Selecionar forma";
  }

  function textoContaRecargaTag(id) {
    return contasBanco.find((conta) => String(conta.id) === String(id))?.nome || "Selecionar conta";
  }

  function textoCartaoRecargaTag(id) {
    const cartao = cartoes.find((item) => String(item.id) === String(id));
    if (!cartao) return "Selecionar cartão";
    return nomeCartaoComFinal(cartao);
  }

  function textoFormaPagamentoProtecao(valor) {
    return formasPagamentoProtecao.find((item) => item.valor === valor)?.titulo || "Selecionar forma";
  }

  function textoContaProtecao(id) {
    return contasBanco.find((conta) => String(conta.id) === String(id))?.nome || "Selecionar conta";
  }

  function textoCartaoProtecao(id) {
    const cartao = cartoes.find((item) => String(item.id) === String(id));
    if (!cartao) return "Selecionar cartão";
    return nomeCartaoComFinal(cartao);
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarMoedaDigitada(valor, permitirNegativo = false) {
    let texto = String(valor || "");
    const negativo = permitirNegativo && texto.trim().startsWith("-");
    texto = texto.replace(/\D/g, "");
    const numero = Number(texto || 0) / 100;
    const formatado = numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return negativo ? `-${formatado}` : formatado;
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", "."));
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function carregarTudo() {
    const [, , cartoesAtuais] = await Promise.all([carregarVeiculos(), carregarContasBanco(), carregarCartoes(), carregarPlataformas()]);
    await completarHorizontesAlugueis(supabase, cartoesAtuais || []);
    await carregarVeiculos();
  }

  async function carregarPlataformas() {
    const { data, error } = await supabase.from("plataformas").select("id, nome").eq("ativo", true).order("nome");
    if (error) {
      console.error(error);
      setPlataformas([]);
      return;
    }
    setPlataformas(data || []);
  }

  async function carregarContasBanco() {
    const { data } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .eq("tipo_conta", "banco")
      .order("id");

    const contasComSaldo = await Promise.all(
      (data || []).map(async (conta) => ({
        ...conta,
        saldo_atual: await calcularSaldoConta(conta),
      }))
    );

    setContasBanco(contasComSaldo);
  }

  async function carregarCartoes() {
    const { data } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const idsCartoes = (data || []).map((cartao) => cartao.id);

    const { data: faturasData } = idsCartoes.length
      ? await supabase
          .from("faturas_cartao")
          .select("cartao_id, valor_total, valor_pago, status")
          .in("cartao_id", idsCartoes)
          .in("status", ["aberta", "fechada", "parcial"])
      : { data: [] };

    const cartoesComUso = (data || []).map((cartao) => {
      const usado = (faturasData || [])
        .filter((fatura) => String(fatura.cartao_id) === String(cartao.id))
        .reduce(
          (total, fatura) => total + calcularSaldoAbertoFatura(fatura),
          0
        );

      return {
        ...cartao,
        usado,
      };
    });

    setCartoes(cartoesComUso);
    return cartoesComUso;
  }

  async function calcularSaldoConta(conta) {
    const contaId = conta.id;

    const { data: transferenciasRecebidas } = await supabase
      .from("transferencias")
      .select("valor")
      .eq("conta_destino_id", contaId);

    const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
      (total, transferencia) => total + Number(transferencia.valor || 0),
      0
    );

    const { data: transferenciasEnviadas } = await supabase
      .from("transferencias")
      .select("valor")
      .eq("conta_origem_id", contaId);

    const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
      (total, transferencia) => total + Number(transferencia.valor || 0),
      0
    );

    const { data: entradasAvulsas } = await supabase
      .from("entradas_avulsas")
      .select("valor")
      .eq("conta_id", contaId);

    const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
      (total, entrada) => total + Number(entrada.valor || 0),
      0
    );

    const { data: saidas } = await supabase
      .from("saidas")
      .select("valor_total, tipo_movimentacao")
      .eq("conta_id", contaId);

    const totalSaidas = (saidas || [])
      .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
      .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

    return (
      Number(conta.saldo_inicial || 0) +
      totalEntradasAvulsas +
      totalTransferenciasRecebidas -
      totalTransferenciasEnviadas -
      totalSaidas
    );
  }

  async function carregarVeiculos() {
    const { data: veiculosData, error } = await supabase
      .from("veiculos")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar veículos.", "erro");
      return;
    }

    const idsVeiculos = (veiculosData || []).map((veiculo) => veiculo.id);

    const { data: tagsData } = idsVeiculos.length
      ? await supabase
          .from("contas")
          .select("*")
          .eq("ativo", true)
          .eq("tipo_conta", "tag")
          .in("veiculo_id", idsVeiculos)
      : { data: [] };

    const tagsComSaldo = await Promise.all(
      (tagsData || []).map(async (tag) => ({
        ...tag,
        saldo_atual: await calcularSaldoConta(tag),
      }))
    );

    const { data: protecoesData } = idsVeiculos.length
      ? await supabase
          .from("veiculos_protecoes")
          .select("*")
          .eq("ativo", true)
          .in("veiculo_id", idsVeiculos)
      : { data: [] };

    const anoAtual = new Date().getFullYear();
    const { data: documentosData } = idsVeiculos.length
      ? await supabase
          .from("veiculos_documentos")
          .select("veiculo_id, tipo, ano, status")
          .in("veiculo_id", idsVeiculos)
          .eq("ano", anoAtual)
      : { data: [] };

    const [{ data: financiamentosData }, { data: alugueisData }, { data: caucoesData }] = idsVeiculos.length
      ? await Promise.all([
          supabase.from("veiculos_financiamentos").select("*").eq("ativo", true).in("veiculo_id", idsVeiculos),
          supabase.from("veiculos_alugueis").select("*").eq("ativo", true).in("veiculo_id", idsVeiculos),
          supabase.from("veiculos_caucoes").select("*").eq("ativo", true).in("veiculo_id", idsVeiculos),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];


    const veiculosComKm = await Promise.all(
      (veiculosData || []).map(async (veiculo) => {
        const { data: entradasData } = await supabase
          .from("entradas")
          .select("km_rodados")
          .eq("veiculo_id", veiculo.id);

        const kmTrabalho = (entradasData || []).reduce(
          (total, entrada) => total + Number(entrada.km_rodados || 0),
          0
        );

        const kmInicial = Number(veiculo.odometro_inicial || 0);
        const kmAtual = Number(veiculo.odometro_atual || 0);
        const totalRodado = Math.max(kmAtual - kmInicial, 0);
        const kmPessoal = Math.max(totalRodado - kmTrabalho, 0);
        const tag = tagsComSaldo.find((item) => Number(item.veiculo_id) === Number(veiculo.id));
        const protecao = (protecoesData || []).find((item) => Number(item.veiculo_id) === Number(veiculo.id));
        const documentos = (documentosData || []).filter((item) => Number(item.veiculo_id) === Number(veiculo.id));
        const financiamentoVeiculo = (financiamentosData || []).find((item) => Number(item.veiculo_id) === Number(veiculo.id));
        const aluguelVeiculo = (alugueisData || []).find((item) => Number(item.veiculo_id) === Number(veiculo.id));
        const caucaoVeiculo = (caucoesData || []).find((item) => Number(item.veiculo_id) === Number(veiculo.id));

        return {
          ...veiculo,
          tag,
          protecao,
          documentos,
          financiamento: financiamentoVeiculo,
          aluguel: aluguelVeiculo,
          caucao: caucaoVeiculo,
          km_trabalho_calculado: kmTrabalho,
          km_pessoal_calculado: kmPessoal,
          total_rodado_calculado: totalRodado,
        };
      })
    );

    setVeiculos(veiculosComKm);

    if (veiculoDetalhes) {
      const atualizado = veiculosComKm.find(
        (veiculo) => String(veiculo.id) === String(veiculoDetalhes.id)
      );
      if (atualizado) setVeiculoDetalhes(atualizado);
    }

    return veiculosComKm;
  }

  function abrirAviso(titulo, mensagem, tipo = "info") {
    setModalAviso({ aberto: true, titulo, mensagem, tipo });
  }

  function fecharAviso() {
    setModalAviso({ aberto: false, titulo: "", mensagem: "", tipo: "info" });
  }

  function somenteNumeros(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function resetTag() {
    setPossuiTag(false);
    setTagId(null);
    setNomeTag("");
    setTipoTag("pre_paga");
    setSaldoInicialTag("");
    setRecargaAutomaticaTag(false);
    setValorRecargaTag("");
    setPercentualGatilhoTag("30");
    setFormaRecargaTag("credito_avista");
    setContaRecargaTagId("");
    setCartaoRecargaTagId("");
  }

  function resetProtecao() {
    setProtecaoId(null);
    setTipoProtecaoVeiculo("nenhuma");
    setNomeProtecaoVeiculo("");
    setInicioVigenciaProtecao("");
    setFimVigenciaProtecao("");
    setFormaPagamentoProtecao("boleto_parcelado");
    setValorProtecao("");
    setNumeroParcelasProtecao("12");
    setParcelasPagasProtecao("0");
    setPrimeiroVencimentoProtecao("");
    setContaProtecaoId("");
    setCartaoProtecaoId("");
  }

  function abrirNovoVeiculo() {
    setModalCadastroRapidoAberto(true);
  }

  function abrirEditarVeiculo(veiculo, acaoProtecao = "") {
    setSubstituindoProtecao(acaoProtecao);
    setVeiculoEditando(veiculo);
    setMarca(veiculo.marca || "");
    setModelo(veiculo.modelo || "");
    setAno(String(veiculo.ano || ""));
    setPlaca(veiculo.placa || "");
    setOdometroInicial(String(veiculo.odometro_inicial || veiculo.odometro_atual || ""));
    setCategoriaVeiculo(veiculo.categoria_veiculo || "flex");
    setTipoPosse(veiculo.tipo_posse || "");
    setSituacaoAquisicao(veiculo.tipo_posse === "proprio" ? veiculo.situacao_aquisicao || "" : "");
    setFinanciamento(veiculo.financiamento ? {
      instituicaoFinanceira: veiculo.financiamento.instituicao_financeira || "",
      valorVeiculo: numeroParaMoedaInput(veiculo.financiamento.valor_veiculo),
      valorFinanciado: numeroParaMoedaInput(veiculo.financiamento.valor_financiado),
      saldoDevedor: veiculo.financiamento.saldo_devedor == null ? "" : numeroParaMoedaInput(veiculo.financiamento.saldo_devedor),
      entrada: numeroParaMoedaInput(veiculo.financiamento.valor_entrada),
      totalParcelas: String(veiculo.financiamento.total_parcelas || ""),
      parcelasPagas: String(veiculo.financiamento.parcelas_pagas || 0),
      numeroProximaParcela: String(veiculo.financiamento.numero_proxima_parcela || ""),
      valorParcela: numeroParaMoedaInput(veiculo.financiamento.valor_parcela),
      proximoVencimento: veiculo.financiamento.proximo_vencimento || "",
      diaVencimento: String(veiculo.financiamento.dia_vencimento || ""),
      observacoes: veiculo.financiamento.observacoes || "",
      formaPagamento: veiculo.financiamento.forma_pagamento || "boleto",
      contaId: veiculo.financiamento.conta_id ? String(veiculo.financiamento.conta_id) : "",
      cartaoId: veiculo.financiamento.cartao_id ? String(veiculo.financiamento.cartao_id) : "",
    } : criarFinanciamentoPadrao());
    setAluguel(veiculo.aluguel ? {
      locador: veiculo.aluguel.locador || "", frequencia: veiculo.aluguel.frequencia || "mensal",
      valor: numeroParaMoedaInput(veiculo.aluguel.valor), dataInicio: veiculo.aluguel.data_inicio || "",
      proximoVencimento: veiculo.aluguel.proximo_vencimento || "", diaCobranca: String(veiculo.aluguel.dia_cobranca || ""),
      dataFim: veiculo.aluguel.data_fim || "", observacoes: veiculo.aluguel.observacoes || "",
      formaPagamento: veiculo.aluguel.forma_pagamento || "boleto",
      contaId: veiculo.aluguel.conta_id ? String(veiculo.aluguel.conta_id) : "",
      cartaoId: veiculo.aluguel.cartao_id ? String(veiculo.aluguel.cartao_id) : "",
      descontoPlataforma: Boolean(veiculo.aluguel.desconto_plataforma),
      plataformaId: veiculo.aluguel.plataforma_id ? String(veiculo.aluguel.plataforma_id) : "",
    } : criarAluguelPadrao());
    setCaucao(veiculo.caucao ? {
      houve: true, valor: numeroParaMoedaInput(veiculo.caucao.valor), data: veiculo.caucao.data_pagamento || "",
      formaPagamento: veiculo.caucao.forma_pagamento || "pix",
      contaId: veiculo.caucao.conta_id ? String(veiculo.caucao.conta_id) : "",
      cartaoId: veiculo.caucao.cartao_id ? String(veiculo.caucao.cartao_id) : "",
      devolvivel: Boolean(veiculo.caucao.devolvivel), previsaoDevolucao: veiculo.caucao.previsao_devolucao || "",
      observacoes: veiculo.caucao.observacoes || "",
    } : criarCaucaoPadrao());

    if (veiculo.tag) {
      setPossuiTag(true);
      setTagId(veiculo.tag.id);
      setNomeTag(veiculo.tag.nome || "");
      setTipoTag(veiculo.tag.tipo_tag || "pre_paga");
      setSaldoInicialTag(numeroParaMoedaInput(veiculo.tag.saldo_inicial));
      setRecargaAutomaticaTag(veiculo.tag.recarga_automatica || false);
      setValorRecargaTag(
        veiculo.tag.valor_recarga_automatica
          ? numeroParaMoedaInput(veiculo.tag.valor_recarga_automatica)
          : ""
      );
      setPercentualGatilhoTag(String(veiculo.tag.percentual_alerta_recarga || 30));
      setFormaRecargaTag(veiculo.tag.tag_forma_recarga || "credito_avista");
      setContaRecargaTagId(veiculo.tag.tag_conta_recarga_id ? String(veiculo.tag.tag_conta_recarga_id) : "");
      setCartaoRecargaTagId(veiculo.tag.tag_cartao_recarga_id ? String(veiculo.tag.tag_cartao_recarga_id) : "");
    } else {
      resetTag();
    }

    if (veiculo.protecao) {
      setProtecaoId(veiculo.protecao.id);
      setTipoProtecaoVeiculo(veiculo.protecao.tipo_protecao || "seguro");
      setNomeProtecaoVeiculo(veiculo.protecao.nome_protecao || "");
      setInicioVigenciaProtecao(veiculo.protecao.inicio_vigencia || "");
      setFimVigenciaProtecao(veiculo.protecao.fim_vigencia || "");
      setFormaPagamentoProtecao(veiculo.protecao.forma_pagamento || "boleto_parcelado");
      setValorProtecao(numeroParaMoedaInput(veiculo.protecao.valor_total || veiculo.protecao.valor_parcela || 0));
      setNumeroParcelasProtecao(String(veiculo.protecao.numero_parcelas || 12));
      setParcelasPagasProtecao(String(veiculo.protecao.parcelas_pagas || 0));
      setPrimeiroVencimentoProtecao(veiculo.protecao.primeiro_vencimento_pendente || "");
      setContaProtecaoId(veiculo.protecao.conta_id ? String(veiculo.protecao.conta_id) : "");
      setCartaoProtecaoId(veiculo.protecao.cartao_id ? String(veiculo.protecao.cartao_id) : "");
    } else {
      resetProtecao();
    }

    setModalAberto(true);
  }

  function abrirProtecaoVeiculo(veiculo, acao = "") {
    setSomenteProtecao(true);
    abrirEditarVeiculo(veiculo, acao);
    if (acao === "cancelar") setTipoProtecaoVeiculo("nenhuma");
  }

  function fecharModal() {
    setModalAberto(false);
    setVeiculoEditando(null);
    setMarca("");
    setModelo("");
    setAno("");
    setPlaca("");
    setOdometroInicial("");
    setCategoriaVeiculo("flex");
    setTipoPosse("");
    setSituacaoAquisicao("");
    setFinanciamento(criarFinanciamentoPadrao());
    setAluguel(criarAluguelPadrao());
    setCaucao(criarCaucaoPadrao());
    resetTag();
    resetProtecao();
    setSubstituindoProtecao(false);
    setSomenteProtecao(false);
  }

  function fecharModalProtecao() {
    const veiculoRetorno = veiculoEditando;
    const deveRetornar = Boolean(veiculoRetornoDashboardId);
    fecharModal();
    if (deveRetornar) {
      setVeiculoDetalhes(veiculoRetorno);
      setVeiculoRetornoDashboardId(null);
    }
  }

  async function salvarSomenteProtecao(dados) {
    if (!veiculoEditando) return;
    try {
      if (substituindoProtecao === "cancelar") {
        const hoje = new Date().toISOString().split("T")[0];
        const { error } = await supabase
          .from("veiculos_protecoes")
          .update({ ativo: false, status: "cancelada", encerrada_em: hoje })
          .eq("id", veiculoEditando.protecao.id);
        if (error) throw error;
        if (veiculoEditando.protecao.contrato_financeiro_id) {
          const { error: erroContrato } = await supabase
            .from("contratos_financeiros")
            .update({ status: "cancelado", cancelado_em: hoje, updated_at: new Date().toISOString() })
            .eq("id", veiculoEditando.protecao.contrato_financeiro_id);
          if (erroContrato) throw erroContrato;
        }
      } else {
        await salvarProtecaoComContrato(supabase, {
          veiculoId: veiculoEditando.id,
          nomeVeiculo: veiculoEditando.nome,
          protecaoAnterior: veiculoEditando.protecao,
          acao: substituindoProtecao,
          dados,
        });
      }
      const retornoId = veiculoRetornoDashboardId || veiculoEditando.id;
      fecharModal();
      const atualizados = await carregarVeiculos();
      setVeiculoDetalhes(atualizados.find((item) => String(item.id) === String(retornoId)) || null);
      setVeiculoRetornoDashboardId(null);
      return false;
    } catch (error) {
      console.error(error);
      abrirAviso("Erro", "Não foi possível salvar a proteção do veículo.", "erro");
      return false;
    }
  }

  function nomeCategoria(valor) {
    return categoriasVeiculo.find((item) => item.valor === valor)?.nome || valor;
  }

  function selecionarCategoria(valor) {
    setCategoriaVeiculo(valor);
  }

  async function salvarCadastroRapido(dados) {
    setSalvandoCadastroRapido(true);
    try {
      const nome = `${dados.marca.trim()} ${dados.modelo.trim()}`.trim();
      const placaNormalizada = dados.placa.trim().toUpperCase();
      const { data: veiculosMesmaPlaca, error: erroBusca } = await supabase
        .from("veiculos")
        .select("*")
        .ilike("placa", placaNormalizada);

      if (erroBusca) throw erroBusca;
      if ((veiculosMesmaPlaca || []).some((veiculo) => veiculo.ativo === true)) {
        return { erro: "Já existe um veículo ativo com essa placa." };
      }

      const kmInicial = Number(dados.odometroInicial || 0);
      const regras = regrasDaCategoria(dados.categoriaVeiculo);
      const dadosBasicos = {
        nome,
        marca: dados.marca.trim(),
        modelo: dados.modelo.trim(),
        ano: Number(dados.ano),
        placa: placaNormalizada,
        tipo_posse: dados.tipoPosse,
        situacao_aquisicao: null,
        categoria_veiculo: dados.categoriaVeiculo,
        combustiveis_aceitos: regras.combustiveis,
        aceita_recarga_eletrica: regras.eletrico,
        odometro_inicial: kmInicial,
        odometro_atual: kmInicial,
        ativo: true,
      };
      const inativo = (veiculosMesmaPlaca || []).find((veiculo) => veiculo.ativo === false);
      let veiculoSalvo;

      if (inativo) {
        const { data, error } = await supabase
          .from("veiculos")
          .update(dadosBasicos)
          .eq("id", inativo.id)
          .select()
          .single();
        if (error) throw error;
        veiculoSalvo = data;
      } else {
        const jaExistePrincipal = veiculos.some((veiculo) => veiculo.principal);
        const { data, error } = await supabase
          .from("veiculos")
          .insert({
            ...dadosBasicos,
            principal: !jaExistePrincipal,
          })
          .select()
          .single();
        if (error) throw error;
        veiculoSalvo = data;
      }

      const veiculosAtualizados = await carregarVeiculos();
      const detalhes = veiculosAtualizados.find((veiculo) => String(veiculo.id) === String(veiculoSalvo.id));
      setModalCadastroRapidoAberto(false);
      setVeiculoDetalhes(detalhes || veiculoSalvo);
      return { sucesso: true };
    } catch (error) {
      console.error(error);
      return { erro: "Não foi possível cadastrar o veículo. Tente novamente." };
    } finally {
      setSalvandoCadastroRapido(false);
    }
  }

  async function salvarVeiculo() {
    if (veiculoEditando) {
      const kmOriginal = Number(
        veiculoEditando.odometro_inicial || veiculoEditando.odometro_atual || 0
      );
      const kmNovo = Number(odometroInicial || 0);

      if (kmNovo !== kmOriginal) {
        setKmInicialPendente(String(kmNovo));
        setModalKmInicialAberto(true);
        return;
      }
    }

    salvarVeiculoConfirmado();
  }


  function calcularCompetenciaFaturaProtecao(dataBase, cartao) {
    const data = new Date(`${dataBase}T00:00:00`);
    const diaCompra = data.getDate();
    const diaFechamento = Number(cartao?.dia_fechamento || 1);
    const diaVencimento = Number(cartao?.dia_vencimento || 1);

    let mesFechamento = data.getMonth() + 1;
    let anoFechamento = data.getFullYear();

    if (diaCompra > diaFechamento) {
      ({ mes: mesFechamento, ano: anoFechamento } = adicionarMesCompetencia(
        anoFechamento,
        mesFechamento,
        1
      ));
    }

    let mes = mesFechamento;
    let ano = anoFechamento;

    if (diaVencimento < diaFechamento) {
      ({ mes, ano } = adicionarMesCompetencia(ano, mes, 1));
    }

    return { mes, ano, mesFechamento, anoFechamento };
  }

  async function buscarOuCriarFaturaProtecao({ cartao, dataBase }) {
    const competencia = calcularCompetenciaFaturaProtecao(dataBase, cartao);
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

    const { data: existente, error: erroBusca } = await buscarFaturaAtivaPorCompetencia(
      supabase,
      Number(cartao.id),
      competencia.mes,
      competencia.ano
    );

    if (erroBusca) throw erroBusca;
    if (existente) return existente;

    const { data, error } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartao.id),
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: dataFechamento,
        data_vencimento: dataVencimento,
        valor_total: 0,
        valor_pago: 0,
        status: "aberta",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function atualizarValorFaturaProtecao(faturaId, valorSomar) {
    const { error } = await incrementarValorTotalFatura(supabase, faturaId, valorSomar);
    if (error) throw error;
  }

  async function buscarCategoriaSeguroId() {
    const { data } = await supabase
      .from("categorias")
      .select("id")
      .eq("nome", "Seguro")
      .maybeSingle();

    return data?.id || null;
  }

  async function gerarLancamentosProtecao(veiculoId, protecao, nomeVeiculo) {
    if (protecao.lancamentos_gerados) return;

    const categoriaId = await buscarCategoriaSeguroId();
    const forma = protecao.forma_pagamento;
    const totalParcelas = Number(protecao.numero_parcelas || 1);
    const pagas = Math.min(Number(protecao.parcelas_pagas || 0), totalParcelas);
    const restantes = Math.max(totalParcelas - pagas, 0);

    if (restantes <= 0) {
      await supabase
        .from("veiculos_protecoes")
        .update({ lancamentos_gerados: true })
        .eq("id", protecao.id);
      return;
    }

    const valorTotal = Number(protecao.valor_total || 0);
    const valorParcela = Number(protecao.valor_parcela || valorTotal / Math.max(totalParcelas, 1));
    const descricaoBase = `${protecao.tipo_protecao === "protecao_veicular" ? "Proteção veicular" : "Seguro"} - ${protecao.nome_protecao} - ${nomeVeiculo}`;

    if (forma === "boleto_parcelado") {
      for (let i = 0; i < restantes; i++) {
        const numeroParcela = pagas + i + 1;
        const vencimento = somarMesesDataISO(protecao.primeiro_vencimento_pendente, i);

        await supabase.from("saidas").insert({
          data_compra: protecao.inicio_vigencia,
          forma_pagamento: "boleto_parcelado",
          tipo_movimentacao: "conta_pagar",
          conta_id: null,
          cartao_id: null,
          tipo_credito: null,
          numero_parcelas: totalParcelas,
          valor_total: valorParcela,
          valor_parcela: valorParcela,
          data_efetivacao: null,
          data_vencimento: vencimento,
          categoria: "Seguro",
          categoria_id: categoriaId,
          finalidade: "trabalho",
          descricao: `${descricaoBase} (${numeroParcela}/${totalParcelas})`,
          status: "aberto",
        });
      }
    }

    if (forma === "boleto") {
      await supabase.from("saidas").insert({
        data_compra: protecao.inicio_vigencia,
        forma_pagamento: "boleto",
        tipo_movimentacao: "conta_pagar",
        conta_id: null,
        cartao_id: null,
        tipo_credito: null,
        numero_parcelas: 1,
        valor_total: valorParcela * restantes,
        valor_parcela: valorParcela * restantes,
        data_efetivacao: null,
        data_vencimento: protecao.primeiro_vencimento_pendente,
        categoria: "Seguro",
        categoria_id: categoriaId,
        finalidade: "trabalho",
        descricao: `${descricaoBase} - saldo em aberto`,
        status: "aberto",
      });
    }

    if (forma === "credito_parcelado" || forma === "credito_avista") {
      const cartao = cartoes.find((item) => String(item.id) === String(protecao.cartao_id));
      if (!cartao) throw new Error("Cartão da proteção não encontrado.");

      const parcelasCredito = forma === "credito_avista" ? 1 : restantes;
      const valorCredito = forma === "credito_avista" ? valorParcela * restantes : valorParcela;

      const { data: saidaCriada, error: erroSaida } = await supabase
        .from("saidas")
        .insert({
          data_compra: protecao.primeiro_vencimento_pendente || protecao.inicio_vigencia,
          forma_pagamento: forma,
          tipo_movimentacao: "saida",
          conta_id: null,
          cartao_id: Number(protecao.cartao_id),
          tipo_credito: forma === "credito_parcelado" ? "parcelado" : "avista",
          numero_parcelas: parcelasCredito,
          valor_total: forma === "credito_avista" ? valorCredito : valorCredito * parcelasCredito,
          valor_parcela: valorCredito,
          data_efetivacao: null,
          data_vencimento: null,
          categoria: "Seguro",
          categoria_id: categoriaId,
          finalidade: "trabalho",
          descricao: forma === "credito_avista" ? `${descricaoBase} - crédito à vista` : descricaoBase,
          status: "fatura",
        })
        .select()
        .single();

      if (erroSaida) throw erroSaida;

      const parcelasPayload = [];

      for (let i = 0; i < parcelasCredito; i++) {
        const dataBase = somarMesesDataISO(protecao.primeiro_vencimento_pendente || protecao.inicio_vigencia, i);
        const fatura = await buscarOuCriarFaturaProtecao({ cartao, dataBase });
        await atualizarValorFaturaProtecao(fatura.id, valorCredito);

        parcelasPayload.push(criarPayloadParcela({
          saida_id: saidaCriada.id,
          cartao_id: Number(protecao.cartao_id),
          fatura_id: fatura.id,
          numero_parcela: forma === "credito_avista" ? 1 : pagas + i + 1,
          total_parcelas: totalParcelas,
          valor_parcela: valorCredito,
          data_vencimento: fatura.data_vencimento,
          status: "pendente",
        }));
      }

      if (parcelasPayload.length) {
        const { error: erroParcelas } = await supabase
          .from("saidas_parcelas")
          .insert(parcelasPayload);

        if (erroParcelas) throw erroParcelas;
      }
    }

    if (["pix", "debito", "dinheiro"].includes(forma)) {
      await supabase.from("saidas").insert({
        data_compra: protecao.primeiro_vencimento_pendente || new Date().toISOString().split("T")[0],
        forma_pagamento: forma,
        tipo_movimentacao: "saida",
        conta_id: Number(protecao.conta_id),
        cartao_id: null,
        tipo_credito: null,
        numero_parcelas: 1,
        valor_total: valorParcela * restantes,
        valor_parcela: valorParcela * restantes,
        data_efetivacao: protecao.primeiro_vencimento_pendente || new Date().toISOString().split("T")[0],
        data_vencimento: null,
        categoria: "Seguro",
        categoria_id: categoriaId,
        finalidade: "trabalho",
        descricao: `${descricaoBase} - pagamento lançado`,
        status: "pago",
      });
    }

    await supabase
      .from("veiculos_protecoes")
      .update({ lancamentos_gerados: true })
      .eq("id", protecao.id);
  }

  async function salvarProtecaoDoVeiculo(veiculoId, nomeVeiculo) {
    if (tipoProtecaoVeiculo === "nenhuma") {
      if (protecaoId) {
        await supabase
          .from("veiculos_protecoes")
          .update({ ativo: false, status: "cancelada", encerrada_em: new Date().toISOString().split("T")[0] })
          .eq("id", protecaoId);
      }
      return;
    }

    const totalParcelas = ["credito_parcelado", "boleto_parcelado"].includes(formaPagamentoProtecao)
      ? Number(numeroParcelasProtecao || 1)
      : 1;
    const parcelasPagas = Math.min(Number(parcelasPagasProtecao || 0), totalParcelas);
    const valorInformado = moedaParaNumero(valorProtecao);
    const valorParcela = ["credito_parcelado", "boleto_parcelado"].includes(formaPagamentoProtecao)
      ? valorInformado
      : valorInformado;
    const valorTotal = ["credito_parcelado", "boleto_parcelado"].includes(formaPagamentoProtecao)
      ? valorParcela * totalParcelas
      : valorInformado;

    const payload = {
      veiculo_id: Number(veiculoId),
      tipo_protecao: tipoProtecaoVeiculo,
      nome_protecao: nomeProtecaoVeiculo.trim(),
      inicio_vigencia: inicioVigenciaProtecao,
      fim_vigencia: fimVigenciaProtecao,
      forma_pagamento: formaPagamentoProtecao,
      valor_total: valorTotal,
      valor_parcela: valorParcela,
      numero_parcelas: totalParcelas,
      parcelas_pagas: parcelasPagas,
      primeiro_vencimento_pendente: parcelasPagas < totalParcelas ? primeiroVencimentoProtecao : null,
      conta_id: ["pix", "debito", "dinheiro"].includes(formaPagamentoProtecao) ? Number(contaProtecaoId) : null,
      cartao_id: ["credito_avista", "credito_parcelado"].includes(formaPagamentoProtecao) ? Number(cartaoProtecaoId) : null,
      ativo: true,
      status: "ativa",
      encerrada_em: null,
    };

    if (protecaoId && ["substituir", "renovar"].includes(substituindoProtecao)) {
      const hoje = new Date().toISOString().split("T")[0];
      const { error: erroEncerramento } = await supabase
        .from("veiculos_protecoes")
        .update({ ativo: false, status: substituindoProtecao === "renovar" ? "renovada" : "substituida", encerrada_em: hoje })
        .eq("id", protecaoId);
      if (erroEncerramento) throw erroEncerramento;

      const { data, error } = await supabase
        .from("veiculos_protecoes")
        .insert({ ...payload, substitui_protecao_id: protecaoId })
        .select()
        .single();
      if (error) throw error;
      await gerarLancamentosProtecao(veiculoId, data, nomeVeiculo);
      return;
    }

    if (protecaoId) {
      const { error } = await supabase
        .from("veiculos_protecoes")
        .update(payload)
        .eq("id", protecaoId);

      if (error) throw error;
      return;
    }

    const { data: existente } = await supabase
      .from("veiculos_protecoes")
      .select("*")
      .eq("veiculo_id", veiculoId)
      .eq("ativo", true)
      .maybeSingle();

    if (existente) {
      const { data, error } = await supabase
        .from("veiculos_protecoes")
        .update(payload)
        .eq("id", existente.id)
        .select()
        .single();

      if (error) throw error;
      await gerarLancamentosProtecao(veiculoId, data, nomeVeiculo);
      return;
    }

    const { data, error } = await supabase
      .from("veiculos_protecoes")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await gerarLancamentosProtecao(veiculoId, data, nomeVeiculo);
  }

  async function salvarTagDoVeiculo(veiculoId) {
    if (!possuiTag) {
      if (tagId) {
        await supabase.from("contas").update({ ativo: false }).eq("id", tagId);
      }
      return;
    }

    const dadosTag = {
      nome: nomeTag.trim(),
      tipo_conta: "tag",
      veiculo_id: Number(veiculoId),
      tipo_tag: tipoTag,
      saldo_inicial: moedaParaNumero(saldoInicialTag),
      permitir_saldo_negativo: true,
      limite_cheque_especial: 0,
      recarga_automatica: tipoTag === "pre_paga" ? recargaAutomaticaTag : false,
      valor_recarga_automatica:
        tipoTag === "pre_paga" && recargaAutomaticaTag ? moedaParaNumero(valorRecargaTag) : 0,
      percentual_alerta_recarga:
        tipoTag === "pre_paga" && recargaAutomaticaTag ? Number(percentualGatilhoTag || 30) : 30,
      tag_forma_recarga:
        tipoTag === "pos_paga" || (tipoTag === "pre_paga" && recargaAutomaticaTag)
          ? formaRecargaTag
          : null,
      tag_conta_recarga_id:
        (tipoTag === "pos_paga" || (tipoTag === "pre_paga" && recargaAutomaticaTag)) &&
        ["debito", "pix"].includes(formaRecargaTag)
          ? Number(contaRecargaTagId)
          : null,
      tag_cartao_recarga_id:
        (tipoTag === "pos_paga" || (tipoTag === "pre_paga" && recargaAutomaticaTag)) &&
        formaRecargaTag === "credito_avista"
          ? Number(cartaoRecargaTagId)
          : null,
      ativo: true,
      principal: false,
    };

    if (tagId) {
      const { error } = await supabase.from("contas").update(dadosTag).eq("id", tagId);
      if (error) throw error;
      return;
    }

    const { data: tagExistente } = await supabase
      .from("contas")
      .select("*")
      .eq("tipo_conta", "tag")
      .eq("veiculo_id", veiculoId)
      .maybeSingle();

    if (tagExistente) {
      const { error } = await supabase
        .from("contas")
        .update(dadosTag)
        .eq("id", tagExistente.id);

      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("contas").insert(dadosTag);
    if (error) throw error;
  }

  async function salvarContratosVeiculo(veiculoId) {
    await desativarContratoIncompativel(supabase, veiculoId, tipoPosse, situacaoAquisicao);

    if (tipoPosse === "proprio" && situacaoAquisicao === "financiado") {
      await salvarFinanciamentoVeiculo(supabase, {
        veiculoId,
        financiamento: {
          ...financiamento,
          valorVeiculo: moedaParaNumero(financiamento.valorVeiculo),
          valorFinanciado: moedaParaNumero(financiamento.valorFinanciado),
          saldoDevedor: financiamento.saldoDevedor === "" ? null : moedaParaNumero(financiamento.saldoDevedor),
          entrada: moedaParaNumero(financiamento.entrada),
          valorParcela: moedaParaNumero(financiamento.valorParcela),
        },
        cartoes,
      });
    }

    if (tipoPosse === "alugado") {
      await salvarAluguelVeiculo(supabase, {
        veiculoId,
        aluguel: { ...aluguel, valor: moedaParaNumero(aluguel.valor) },
        caucao: { ...caucao, valor: moedaParaNumero(caucao.valor) },
        cartoes,
      });
    }
  }

  async function salvarVeiculoConfirmado(kmInicialConfirmado = null) {
    const kmInicial = Number(kmInicialConfirmado ?? odometroInicial ?? 0);
    const nomeGerado = `${marca.trim()} ${modelo.trim()}`.trim();
    const regras = regrasDaCategoria(categoriaVeiculo);

    const { data: veiculosMesmoNome } = await supabase
      .from("veiculos")
      .select("*")
      .ilike("nome", nomeGerado);

    const veiculoAtivoMesmoNome = (veiculosMesmoNome || []).find(
      (veiculo) => veiculo.ativo === true && veiculo.id !== veiculoEditando?.id
    );

    if (veiculoAtivoMesmoNome) {
      abrirAviso(
        "Veículo já cadastrado",
        "Já existe um veículo ativo com essa marca e modelo. Use uma identificação diferente no modelo ou edite o veículo existente.",
        "erro"
      );
      return;
    }

    const payloadBase = {
      nome: nomeGerado,
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: Number(ano),
      placa: placa.trim().toUpperCase(),
      categoria_veiculo: categoriaVeiculo,
      combustiveis_aceitos: regras.combustiveis,
      aceita_recarga_eletrica: regras.eletrico,
      tipo_posse: tipoPosse,
      situacao_aquisicao: tipoPosse === "proprio" ? situacaoAquisicao : null,
    };

    if (veiculoEditando) {
      const kmAtualBanco = Number(veiculoEditando.odometro_atual || 0);
      const kmInicialBanco = Number(
        veiculoEditando.odometro_inicial || veiculoEditando.odometro_atual || 0
      );
      const diferenca = kmAtualBanco - kmInicialBanco;
      const novoKmAtual = Math.max(kmInicial + diferenca, kmInicial);

      const { error } = await supabase
        .from("veiculos")
        .update({ ...payloadBase, odometro_inicial: kmInicial, odometro_atual: novoKmAtual })
        .eq("id", veiculoEditando.id);

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao editar veículo.", "erro");
        return;
      }

      try {
        await salvarTagDoVeiculo(veiculoEditando.id);
        await onConfiguracaoTagAlterada?.();
        await salvarProtecaoDoVeiculo(veiculoEditando.id, nomeGerado);
        await salvarContratosVeiculo(veiculoEditando.id);
      } catch (errorTag) {
        console.error(errorTag);
        abrirAviso("Erro", "Veículo salvo, mas houve erro ao salvar a estrutura financeira vinculada.", "erro");
        return;
      }

      setModalKmInicialAberto(false);
      setKmInicialPendente("");
      const retornoId = veiculoRetornoDashboardId;
      fecharModal();
      const atualizados = await carregarVeiculos();
      if (retornoId) {
        setVeiculoDetalhes(atualizados.find((item) => String(item.id) === String(retornoId)) || null);
        setVeiculoRetornoDashboardId(null);
      }
      return;
    }

    const veiculoInativoMesmoNome = (veiculosMesmoNome || []).find(
      (veiculo) => veiculo.ativo === false
    );

    if (veiculoInativoMesmoNome) {
      const { data: veiculoReativado, error } = await supabase
        .from("veiculos")
        .update({ ...payloadBase, odometro_inicial: kmInicial, odometro_atual: kmInicial, ativo: true })
        .eq("id", veiculoInativoMesmoNome.id)
        .select()
        .single();

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao reativar veículo.", "erro");
        return;
      }

      try {
        await salvarTagDoVeiculo(veiculoReativado.id);
        await onConfiguracaoTagAlterada?.();
        await salvarProtecaoDoVeiculo(veiculoReativado.id, nomeGerado);
        await salvarContratosVeiculo(veiculoReativado.id);
      } catch (errorTag) {
        console.error(errorTag);
        abrirAviso("Erro", "Veículo reativado, mas houve erro ao salvar a estrutura financeira vinculada.", "erro");
        return;
      }

      fecharModal();
      carregarVeiculos();
      abrirAviso(
        "Veículo reativado",
        "Já existia um veículo excluído com esse nome. Ele foi reativado para manter o histórico correto.",
        "info"
      );
      return;
    }

    const jaExistePrincipal = veiculos.some((veiculo) => veiculo.principal);

    const { data: novoVeiculo, error } = await supabase
      .from("veiculos")
      .insert({ ...payloadBase, odometro_inicial: kmInicial, odometro_atual: kmInicial, principal: !jaExistePrincipal, ativo: true })
      .select()
      .single();

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao criar veículo.", "erro");
      return;
    }

    try {
      await salvarTagDoVeiculo(novoVeiculo.id);
      await onConfiguracaoTagAlterada?.();
      await salvarProtecaoDoVeiculo(novoVeiculo.id, nomeGerado);
      await salvarContratosVeiculo(novoVeiculo.id);
    } catch (errorTag) {
      console.error(errorTag);
      abrirAviso("Erro", "Veículo criado, mas houve erro ao salvar a estrutura financeira vinculada.", "erro");
      return;
    }

    fecharModal();
    carregarVeiculos();
  }

  function solicitarVeiculoPrincipal(veiculo) {
    if (veiculo.principal) return;
    setVeiculoParaPrincipal(veiculo);
    setModalPrincipalAberto(true);
  }

  async function confirmarVeiculoPrincipal() {
    if (!veiculoParaPrincipal) return;

    await supabase.from("veiculos").update({ principal: false }).neq("id", 0);

    await supabase
      .from("veiculos")
      .update({ principal: true })
      .eq("id", veiculoParaPrincipal.id);

    setModalPrincipalAberto(false);
    setVeiculoParaPrincipal(null);
    carregarVeiculos();
  }

  async function solicitarExclusaoVeiculo(veiculo) {
    if (veiculo.principal) {
      abrirAviso(
        "Veículo principal",
        "Você não pode excluir o veículo principal. Defina outro veículo como principal antes.",
        "erro"
      );
      return;
    }

    const dependencias = [
      ["entradas", "Lançamentos de ganhos"], ["manutencoes", "Manutenções"],
      ["saidas_abastecimentos", "Abastecimentos"], ["saidas_recargas_eletricas", "Recargas elétricas"],
      ["saidas_manutencoes", "Despesas de manutenção"], ["contas", "TAG/contas vinculadas"],
      ["veiculos_protecoes", "Seguro/proteção"], ["veiculos_financiamentos", "Financiamento"],
      ["veiculos_alugueis", "Aluguel"], ["veiculos_caucoes", "Caução"], ["saidas", "Despesas financeiras"],
    ];
    const resultados = await Promise.all(dependencias.map(async ([tabela, titulo]) => {
      const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true }).eq("veiculo_id", veiculo.id);
      if (error) throw error;
      return { titulo, count: Number(count || 0) };
    })).catch((error) => {
      console.error(error);
      abrirAviso("Não foi possível verificar", "A exclusão foi bloqueada porque as dependências do veículo não puderam ser auditadas.", "erro");
      return null;
    });
    if (!resultados) return;
    const existentes = resultados.filter((item) => item.count > 0);
    if (existentes.length) {
      abrirAviso(
        "Veículo com histórico vinculado",
        `A exclusão foi bloqueada para preservar: ${existentes.map((item) => item.titulo).join(", ")}.`,
        "erro"
      );
      return;
    }

    setVeiculoParaExcluir(veiculo);
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoVeiculo() {
    if (!veiculoParaExcluir) return;
    const veiculoExcluidoId = veiculoParaExcluir.id;

    const { error } = await supabase
      .from("veiculos")
      .update({ ativo: false })
      .eq("id", veiculoParaExcluir.id);

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao excluir veículo.", "erro");
      return;
    }

    await supabase
      .from("contas")
      .update({ ativo: false })
      .eq("tipo_conta", "tag")
      .eq("veiculo_id", veiculoParaExcluir.id);

    await onConfiguracaoTagAlterada?.();

    setModalExcluirAberto(false);
    setVeiculoParaExcluir(null);
    if (String(veiculoDetalhes?.id) === String(veiculoExcluidoId)) setVeiculoDetalhes(null);
    carregarVeiculos();
  }

  function abrirDetalhes(veiculo) {
    setVeiculoDetalhes(veiculo);
  }

  if (veiculoDetalhes) {
    return (
      <>
        <DetalhesVeiculo
          veiculo={veiculoDetalhes}
          voltar={() => setVeiculoDetalhes(null)}
          nomeCategoria={nomeCategoria}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          numeroParaMoedaInput={numeroParaMoedaInput}
          contasBanco={contasBanco}
          cartoes={cartoes}
          onErro={abrirAviso}
          onRecarregar={carregarVeiculos}
          onConfiguracaoTagAlterada={onConfiguracaoTagAlterada}
          onGerenciarVeiculo={() => {
            setVeiculoRetornoDashboardId(veiculoDetalhes.id);
            setVeiculoDetalhes(null);
            abrirEditarVeiculo(veiculoDetalhes);
          }}
          onExcluirVeiculo={() => solicitarExclusaoVeiculo(veiculoDetalhes)}
          onGerenciarProtecao={(acao = "") => {
            setVeiculoRetornoDashboardId(veiculoDetalhes.id);
            setVeiculoDetalhes(null);
            abrirProtecaoVeiculo(veiculoDetalhes, acao);
          }}
        />
        {modalExcluirAberto && (
          <ModalConfirmacao
            titulo="Excluir Veículo"
            cor="red"
            texto={<>Deseja realmente excluir o veículo <span className="font-bold text-white">{veiculoParaExcluir?.nome}</span>?</>}
            subtitulo="Ele deixará de aparecer para novos lançamentos. A TAG vinculada também será ocultada."
            cancelar={() => { setModalExcluirAberto(false); setVeiculoParaExcluir(null); }}
            confirmar={confirmarExclusaoVeiculo}
            textoConfirmar="Excluir"
          />
        )}
        {modalAviso.aberto && (
          <ModalBase aberto titulo={modalAviso.titulo} onClose={fecharAviso} largura="max-w-md" rodape={<button type="button" onClick={fecharAviso} className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">Entendi</button>}>
            <p className={modalAviso.tipo === "erro" ? "text-red-300" : "text-gray-300"}>{modalAviso.mensagem}</p>
          </ModalBase>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Veículos</h1>
          <p className="text-gray-400 mt-2">Gerencie veículos, km, combustível, TAG e histórico</p>
        </div>

        <button
          onClick={abrirNovoVeiculo}
          className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-5 py-3"
        >
          + Novo Veículo
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {veiculos.map((veiculo) => {
          const tituloBase = veiculo.nome || [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ");
          const anoTexto = veiculo.ano ? String(veiculo.ano) : "";
          const tituloVeiculo = anoTexto && !tituloBase.trim().endsWith(anoTexto)
            ? `${tituloBase} ${anoTexto}`
            : tituloBase;
          const anoAtual = new Date().getFullYear();
          const ipvaAtual = veiculo.documentos?.find((item) => item.tipo === "ipva" && Number(item.ano) === anoAtual);
          const licenciamentoAtual = veiculo.documentos?.find((item) => item.tipo === "licenciamento" && Number(item.ano) === anoAtual);

          return (
            <div
              key={veiculo.id}
              onClick={() => abrirDetalhes(veiculo)}
              className={`rounded-2xl border p-5 sm:p-6 transition cursor-pointer hover:border-green-400/60 ${
                veiculo.principal ? "border-green-400 bg-green-500/10" : "border-gray-800 bg-[#111827]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400">Veículo</p>
                  <h2 className="text-xl font-bold mt-1 leading-snug break-words">
                    {tituloVeiculo}
                  </h2>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      solicitarVeiculoPrincipal(veiculo);
                    }}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                      veiculo.principal
                        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                        : "border-gray-700 text-gray-500 hover:text-yellow-400 hover:border-yellow-400/40"
                    }`}
                    title="Definir como principal"
                  >
                    <FiStar className="w-4 h-4" />
                  </button>

                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {veiculo.principal && (
                  <div className="inline-flex items-center rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1">
                    Veículo Principal
                  </div>
                )}

                {veiculo.tag?.nome && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1">
                    <FiTag className="w-3 h-3" />
                    <span>{veiculo.tag.nome}</span>
                  </div>
                )}

                {veiculo.protecao && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 text-green-300 text-xs font-bold px-3 py-1">
                    <FiShield className="w-3 h-3" />
                    <span>{veiculo.protecao.tipo_protecao === "protecao_veicular" ? "Proteção Veicular" : "Seguro"}</span>
                  </div>
                )}

                {ipvaAtual && (
                  <div className={`inline-flex items-center rounded-full text-xs font-bold px-3 py-1 ${ipvaAtual.status === "pago" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                    IPVA {anoAtual} {ipvaAtual.status === "pago" ? "✓" : "✕"}
                  </div>
                )}

                {licenciamentoAtual && (
                  <div className={`inline-flex items-center rounded-full text-xs font-bold px-3 py-1 ${licenciamentoAtual.status === "pago" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                    Licenciamento {anoAtual} {licenciamentoAtual.status === "pago" ? "✓" : "✕"}
                  </div>
                )}
              </div>

              <div className="mt-7 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Placa</p>
                  <p className="text-lg font-semibold mt-1 break-words">{veiculo.placa || "-"}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-400">Categoria</p>
                  <p className="text-lg font-semibold mt-1 break-words">{nomeCategoria(veiculo.categoria_veiculo)}</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-6">Clique para abrir os dados completos do carro.</p>
            </div>
          );
        })}
      </div>

      {veiculos.length === 0 && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400">Nenhum veículo cadastrado ainda.</p>
        </div>
      )}

      {modalCadastroRapidoAberto && (
        <CadastroVeiculoModal
          aberto
          onClose={() => setModalCadastroRapidoAberto(false)}
          onSalvar={salvarCadastroRapido}
          salvando={salvandoCadastroRapido}
        />
      )}

      {somenteProtecao ? (
        <ProtecaoModal
          aberto={modalAberto}
          protecao={veiculoEditando?.protecao || null}
          acao={substituindoProtecao || ""}
          contas={contasBanco}
          cartoes={cartoes}
          formatarMoeda={formatarMoeda}
          onClose={fecharModalProtecao}
          onSalvar={salvarSomenteProtecao}
        />
      ) : (
      <VeiculoModal
        aberto={modalAberto}
        veiculoEditando={veiculoEditando}
        categoriasVeiculo={categoriasVeiculo}
        categoriaVeiculo={categoriaVeiculo}
        nomeCategoria={nomeCategoria}
        onSelecionarCategoria={selecionarCategoria}
        onClose={somenteProtecao ? fecharModalProtecao : fecharModal}
        onSalvar={somenteProtecao ? salvarSomenteProtecao : salvarVeiculo}
        somenteProtecao={somenteProtecao}
        marca={marca}
        setMarca={setMarca}
        modelo={modelo}
        setModelo={setModelo}
        ano={ano}
        setAno={setAno}
        placa={placa}
        setPlaca={setPlaca}
        odometroInicial={odometroInicial}
        setOdometroInicial={setOdometroInicial}
        tipoPosse={tipoPosse}
        setTipoPosse={setTipoPosse}
        situacaoAquisicao={situacaoAquisicao}
        setSituacaoAquisicao={setSituacaoAquisicao}
        financiamento={financiamento}
        setFinanciamento={setFinanciamento}
        aluguel={aluguel}
        setAluguel={setAluguel}
        caucao={caucao}
        setCaucao={setCaucao}
        plataformas={plataformas}
        possuiTag={possuiTag}
        setPossuiTag={setPossuiTag}
        nomeTag={nomeTag}
        setNomeTag={setNomeTag}
        tipoTag={tipoTag}
        setTipoTag={setTipoTag}
        saldoInicialTag={saldoInicialTag}
        setSaldoInicialTag={setSaldoInicialTag}
        recargaAutomaticaTag={recargaAutomaticaTag}
        setRecargaAutomaticaTag={setRecargaAutomaticaTag}
        valorRecargaTag={valorRecargaTag}
        setValorRecargaTag={setValorRecargaTag}
        percentualGatilhoTag={percentualGatilhoTag}
        setPercentualGatilhoTag={setPercentualGatilhoTag}
        formaRecargaTag={formaRecargaTag}
        setFormaRecargaTag={setFormaRecargaTag}
        contaRecargaTagId={contaRecargaTagId}
        setContaRecargaTagId={setContaRecargaTagId}
        cartaoRecargaTagId={cartaoRecargaTagId}
        setCartaoRecargaTagId={setCartaoRecargaTagId}
        contasBanco={contasBanco}
        cartoes={cartoes}
        formasRecargaTag={formasRecargaTag}
        textoFormaRecargaTag={textoFormaRecargaTag}
        textoContaRecargaTag={textoContaRecargaTag}
        textoCartaoRecargaTag={textoCartaoRecargaTag}
        formatarMoeda={formatarMoeda}
        formatarMoedaDigitada={formatarMoedaDigitada}
        moedaParaNumero={moedaParaNumero}
        somenteNumeros={somenteNumeros}
        tipoProtecaoVeiculo={tipoProtecaoVeiculo}
        setTipoProtecaoVeiculo={setTipoProtecaoVeiculo}
        nomeProtecaoVeiculo={nomeProtecaoVeiculo}
        setNomeProtecaoVeiculo={setNomeProtecaoVeiculo}
        inicioVigenciaProtecao={inicioVigenciaProtecao}
        setInicioVigenciaProtecao={setInicioVigenciaProtecao}
        fimVigenciaProtecao={fimVigenciaProtecao}
        setFimVigenciaProtecao={setFimVigenciaProtecao}
        formaPagamentoProtecao={formaPagamentoProtecao}
        setFormaPagamentoProtecao={setFormaPagamentoProtecao}
        valorProtecao={valorProtecao}
        setValorProtecao={setValorProtecao}
        numeroParcelasProtecao={numeroParcelasProtecao}
        setNumeroParcelasProtecao={setNumeroParcelasProtecao}
        parcelasPagasProtecao={parcelasPagasProtecao}
        setParcelasPagasProtecao={setParcelasPagasProtecao}
        primeiroVencimentoProtecao={primeiroVencimentoProtecao}
        setPrimeiroVencimentoProtecao={setPrimeiroVencimentoProtecao}
        contaProtecaoId={contaProtecaoId}
        setContaProtecaoId={setContaProtecaoId}
        cartaoProtecaoId={cartaoProtecaoId}
        setCartaoProtecaoId={setCartaoProtecaoId}
        formasPagamentoProtecao={formasPagamentoProtecao}
        textoFormaPagamentoProtecao={textoFormaPagamentoProtecao}
        textoContaProtecao={textoContaProtecao}
        textoCartaoProtecao={textoCartaoProtecao}
      />
      )}

      {modalKmInicialAberto && (
        <ModalConfirmacao
          titulo="Alterar KM Inicial"
          cor="red"
          texto={
            <>
              Você está alterando o KM inicial deste veículo para <span className="font-bold text-white">{Number(kmInicialPendente || 0).toLocaleString("pt-BR")} km</span>.
            </>
          }
          subtitulo="Isso pode alterar o total de KM rodados no app. Confirme apenas se o KM inicial foi cadastrado errado."
          cancelar={() => {
            setModalKmInicialAberto(false);
            setKmInicialPendente("");
          }}
          confirmar={() => salvarVeiculoConfirmado(kmInicialPendente)}
          textoConfirmar="Alterar"
        />
      )}

      {modalPrincipalAberto && (
        <ModalConfirmacao
          titulo="Definir Veículo Principal"
          cor="green"
          texto={
            <>
              Deseja definir <span className="font-bold text-white">{veiculoParaPrincipal?.nome}</span> como veículo principal?
            </>
          }
          subtitulo="Os próximos lançamentos de km, abastecimento e recarga usarão este veículo."
          cancelar={() => {
            setModalPrincipalAberto(false);
            setVeiculoParaPrincipal(null);
          }}
          confirmar={confirmarVeiculoPrincipal}
          textoConfirmar="Confirmar"
        />
      )}

      {modalExcluirAberto && (
        <ModalConfirmacao
          titulo="Excluir Veículo"
          cor="red"
          texto={
            <>
              Deseja realmente excluir o veículo <span className="font-bold text-white">{veiculoParaExcluir?.nome}</span>?
            </>
          }
          subtitulo="Ele deixará de aparecer para novos lançamentos. A TAG vinculada também será ocultada."
          cancelar={() => {
            setModalExcluirAberto(false);
            setVeiculoParaExcluir(null);
          }}
          confirmar={confirmarExclusaoVeiculo}
          textoConfirmar="Excluir"
        />
      )}

      {modalAviso.aberto && (
        <ModalBase aberto titulo={modalAviso.titulo} onClose={fecharAviso} largura="max-w-md" rodape={<button type="button" onClick={fecharAviso} className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">Entendi</button>}>
          <p className={modalAviso.tipo === "erro" ? "text-red-300" : "text-gray-300"}>{modalAviso.mensagem}</p>
        </ModalBase>
      )}
    </div>
  );
}

function DetalhesVeiculo({
  veiculo,
  voltar,
  formatarMoeda,
  formatarMoedaDigitada,
  numeroParaMoedaInput,
  contasBanco,
  cartoes,
  onErro,
  onRecarregar,
  onConfiguracaoTagAlterada,
  onGerenciarVeiculo,
  onExcluirVeiculo,
  onGerenciarProtecao,
}) {
  const kmInicial = Number(veiculo.odometro_inicial || 0);
  const kmAtual = Number(veiculo.odometro_atual || 0);
  const totalRodado = Number(veiculo.total_rodado_calculado || 0);
  const kmTrabalho = Number(veiculo.km_trabalho_calculado || 0);
  const kmPessoal = Number(veiculo.km_pessoal_calculado || 0);
  const tag = veiculo.tag;
  const secoesRef = useRef({});
  const [dadosDashboard, setDadosDashboard] = useState({ entradas: [], abastecimentos: [], pagamentosAbastecimentos: [], recargas: [], manutencoes: [], manutencoesLegadas: [], saidasContratos: [], documentos: [], protecoes: [], aquisicao: null, usosTag: [], recargasTag: [] });
  const [carregandoDashboard, setCarregandoDashboard] = useState(true);
  const [documentoModal, setDocumentoModal] = useState(null);
  const [modalAquisicaoAberto, setModalAquisicaoAberto] = useState(false);
  const [consumoSelecionado, setConsumoSelecionado] = useState(null);
  const [manutencaoSelecionada, setManutencaoSelecionada] = useState(null);
  const [tagEtapa, setTagEtapa] = useState("");
  const [salvandoCentral, setSalvandoCentral] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregarDashboardVeiculo() {
      setCarregandoDashboard(true);
      const [entradas, abastecimentos, recargas, manutencoes, manutencoesLegadas, saidasContratos, documentos, protecoes, aquisicao, usosTag, recargasTag] = await Promise.all([
        supabase.from("entradas").select("id, data, km_rodados, entrada_plataformas(faturamento, valor_reembolso)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_abastecimentos").select("*, saidas(id, data_compra, valor_total, categoria, descricao, status)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_recargas_eletricas").select("*, saidas(id, data_compra, valor_total, categoria, descricao, status)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_manutencoes").select("*, saidas(id, data_compra, valor_total, categoria, descricao)").eq("veiculo_id", veiculo.id),
        supabase.from("manutencoes").select("*, servicos:manutencao_servicos(*), itens:manutencao_itens(*)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas").select("*").eq("veiculo_id", veiculo.id).not("tipo_movimentacao", "eq", "conta_pagar"),
        supabase.from("veiculos_documentos").select("*").eq("veiculo_id", veiculo.id).order("ano", { ascending: false }),
        supabase.from("veiculos_protecoes").select("*").eq("veiculo_id", veiculo.id).order("created_at", { ascending: false }),
        supabase.from("veiculos_aquisicoes").select("*").eq("veiculo_id", veiculo.id).maybeSingle(),
        tag
          ? supabase.from("saidas_tag").select("id, created_at, saidas(data_compra, descricao, valor_total)").eq("conta_tag_id", tag.id)
          : Promise.resolve({ data: [] }),
        tag
          ? supabase.from("entradas_avulsas").select("id, data, descricao, valor").eq("conta_id", tag.id).ilike("descricao", "Recarga TAG%").order("data", { ascending: false }).limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      const idsAbastecimentos = (abastecimentos.data || [])
        .map((item) => item.saida_id)
        .filter(Boolean);
      const pagamentosAbastecimentos = idsAbastecimentos.length
        ? await supabase
            .from("saidas")
            .select("id, saida_origem_id, valor_total")
            .in("saida_origem_id", idsAbastecimentos)
        : { data: [] };
      if (!ativo) return;
      setDadosDashboard({
        entradas: entradas.data || [],
        abastecimentos: abastecimentos.data || [],
        pagamentosAbastecimentos: pagamentosAbastecimentos.data || [],
        recargas: recargas.data || [],
        manutencoes: manutencoes.data || [],
        manutencoesLegadas: manutencoesLegadas.data || [],
        saidasContratos: saidasContratos.data || [],
        documentos: documentos.data || [],
        protecoes: protecoes.data || [],
        aquisicao: aquisicao.data || null,
        usosTag: [...(usosTag.data || [])].sort((a, b) => {
          const porData = String(b.saidas?.data_compra || b.created_at || "").localeCompare(String(a.saidas?.data_compra || a.created_at || ""));
          return porData || Number(b.id || 0) - Number(a.id || 0);
        }),
        recargasTag: recargasTag.data || [],
      });
      setCarregandoDashboard(false);
    }
    carregarDashboardVeiculo();
    return () => { ativo = false; };
  }, [veiculo.id, tag]);

  const receita = dadosDashboard.entradas.reduce((total, entrada) => total + (entrada.entrada_plataformas || []).reduce((soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0), 0), 0);
  const gastosAbastecimento = dadosDashboard.abastecimentos.reduce(
    (total, item) =>
      total +
      somarPagamentosDoAbastecimento(
        item.saidas,
        dadosDashboard.pagamentosAbastecimentos.filter(
          (pagamento) => Number(pagamento.saida_origem_id) === Number(item.saida_id)
        )
      ),
    0
  );
  const gastosRecarga = dadosDashboard.recargas.reduce((total, item) => total + Number(item.saidas?.valor_total || 0), 0);
  const gastosManutencao = dadosDashboard.manutencoes.reduce((total, item) => total + Number(item.saidas?.valor_total || 0), 0);
  const hojeDashboard = new Date().toISOString().split("T")[0];
  const gastosContratos = dadosDashboard.saidasContratos
    .filter((item) => item.finalidade !== "caucao_devolvivel" && (item.conta_pagar_origem_id || (item.cartao_id && item.data_compra <= hojeDashboard)))
    .reduce((total, item) => total + Number(item.valor_total || 0), 0);
  const custosOperacionaisAtuais = {
    abastecimentos: gastosAbastecimento,
    recargasEletricas: gastosRecarga,
    manutencoes: gastosManutencao,
    contratos: gastosContratos,
  };
  const gastos = Object.values(custosOperacionaisAtuais).reduce((total, valor) => total + valor, 0);
  const consumosPorFonte = calcularConsumosPorFonte(dadosDashboard.abastecimentos, dadosDashboard.recargas);
  const resultadoOperacional = receita - gastos;
  const historicoManutencao = [
    ...dadosDashboard.manutencoes.map((item) => ({
      id: `m-${item.id}`,
      data: item.saidas?.data_compra,
      tipo: "Manutenção",
      descricao: item.servico || item.saidas?.descricao,
      valor: item.saidas?.valor_total,
      detalhes: {
        titulo: item.servico || item.saidas?.descricao || "Manutenção",
        data: item.saidas?.data_compra,
        odometro: item.odometro,
        observacoes: item.observacoes,
        itens: [],
      },
    })),
    ...dadosDashboard.manutencoesLegadas.map((item) => ({
      id: `ml-${item.id}`,
      data: item.data,
      tipo: "Manutenção",
      descricao: item.titulo,
      valor: null,
      detalhes: item,
    })),
  ].filter((item) => item.data).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const ultimaUtilizacaoTag = dadosDashboard.usosTag[0]?.saidas?.data_compra;
  const ultimaRecargaTag = dadosDashboard.recargasTag[0]?.data;
  const protecaoVigente = Boolean(
    veiculo.protecao
    && veiculo.protecao.fim_vigencia
    && veiculo.protecao.fim_vigencia >= hojeDashboard
    && (!veiculo.protecao.inicio_vigencia || veiculo.protecao.inicio_vigencia <= hojeDashboard),
  );
  const ultimaRevisao = obterUltimaRevisao(dadosDashboard.manutencoes, dadosDashboard.manutencoesLegadas);
  const ultimoIpva = obterUltimoDocumento(dadosDashboard.documentos, "ipva");
  const ultimoLicenciamento = obterUltimoDocumento(dadosDashboard.documentos, "licenciamento");
  const anoAtual = new Date().getFullYear();
  const ipvaAnoAtual = dadosDashboard.documentos.find((item) => item.tipo === "ipva" && Number(item.ano) === anoAtual);
  const licenciamentoAnoAtual = dadosDashboard.documentos.find((item) => item.tipo === "licenciamento" && Number(item.ano) === anoAtual);
  const pendencias = [
    veiculo.tipo_posse === "proprio" && (!veiculo.situacao_aquisicao || dadosDashboard.aquisicao?.valor_pago == null || !dadosDashboard.aquisicao?.forma_aquisicao)
      ? { titulo: "Complete as informações do veículo", detalhe: "Há dados patrimoniais ainda não informados.", acao: "patrimonio" }
      : null,
    !veiculo.protecao ? { titulo: "Seguro / Proteção Veicular não cadastrados", detalhe: "Complete os dados de seguro ou proteção.", alvo: "protecao" } : null,
    !ultimaRevisao ? { titulo: "Histórico de revisões inexistente", detalhe: "Adicione a primeira manutenção do veículo.", alvo: "manutencao" } : null,
    !ultimoIpva ? { titulo: "Histórico de IPVA inexistente", detalhe: "Consulte a área de documentação.", alvo: "documentacao" } : null,
    !ultimoLicenciamento ? { titulo: "Licenciamento não informado", detalhe: "Consulte a área de documentação.", alvo: "documentacao" } : null,
  ].filter(Boolean);
  const percentualTrabalho = totalRodado > 0 ? (kmTrabalho / totalRodado) * 100 : 0;
  const percentualPessoal = totalRodado > 0 ? (kmPessoal / totalRodado) * 100 : 0;
  const categoria = String(veiculo.categoria_veiculo || "");
  const veiculoEletrico = categoria === "eletrico";
  const veiculoHibrido = ["hibrido", "hibrido_plugin"].includes(categoria);
  const mostrarAbastecimentos = !veiculoEletrico;
  const mostrarRecargas = veiculoEletrico || veiculoHibrido;
  const mostrarContrato = veiculo.tipo_posse === "alugado" || (veiculo.tipo_posse === "proprio" && veiculo.situacao_aquisicao === "financiado");

  function irParaSecao(chave) {
    secoesRef.current[chave]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function salvarDocumento(documento) {
    setSalvandoCentral(true);
    try {
      const salvo = await salvarDocumentoVeiculo(supabase, veiculo.id, documento);
      setDadosDashboard((atuais) => ({
        ...atuais,
        documentos: [...atuais.documentos.filter((item) => item.id !== salvo.id), salvo]
          .sort((a, b) => Number(b.ano) - Number(a.ano)),
      }));
      return true;
    } catch (error) {
      console.error(error);
      onErro?.("Erro", "Não foi possível salvar o documento.", "erro");
      return false;
    } finally {
      setSalvandoCentral(false);
    }
  }

  async function salvarAquisicao(dados) {
    setSalvandoCentral(true);
    try {
      const salvo = await salvarAquisicaoVeiculo(supabase, veiculo.id, dados);
      setDadosDashboard((atuais) => ({ ...atuais, aquisicao: salvo }));
      setModalAquisicaoAberto(false);
      await onRecarregar?.();
    } catch (error) {
      console.error(error);
      onErro?.("Erro", "Não foi possível salvar os dados de aquisição.", "erro");
    } finally {
      setSalvandoCentral(false);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={voltar} className="w-10 h-10 rounded-xl border border-gray-700 hover:border-green-400 hover:text-green-400 hover:bg-white/5 flex items-center justify-center shrink-0 transition" aria-label="Voltar para veículos">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-green-400">Dashboard do veículo</p>
            <p className="text-sm text-gray-400 mt-1">Indicadores acompanham a vida do veículo desde sua entrada no ControlDriver.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onGerenciarVeiculo} className="w-10 h-10 rounded-xl border border-gray-700 text-gray-300 hover:border-green-400 hover:text-green-300 flex items-center justify-center" aria-label="Editar veículo" title="Editar veículo"><FiEdit2 /></button>
          <button type="button" onClick={onExcluirVeiculo} className="w-10 h-10 rounded-xl border border-gray-700 text-gray-300 hover:border-red-400 hover:text-red-300 flex items-center justify-center" aria-label="Excluir veículo" title="Excluir veículo"><FiTrash2 /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <section className="rounded-3xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-[#111827] to-[#111827] p-6 sm:p-8 overflow-hidden">
          <div className="flex flex-wrap gap-2">
            {veiculo.principal && <BadgeVeiculo classe="bg-green-500/20 text-green-300">Veículo principal</BadgeVeiculo>}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mt-6 leading-tight break-words">{veiculo.nome || [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ")}</h1>
          {veiculo.placa && <p className="text-lg text-gray-300 mt-2">Placa {veiculo.placa}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <IndicadorResumoVeiculo titulo="TAG" ok={Boolean(tag)} />
            <IndicadorResumoVeiculo titulo="Seguro" ok={protecaoVigente} />
            <IndicadorResumoVeiculo titulo={`IPVA ${anoAtual}`} ok={ipvaAnoAtual?.status === "pago"} />
            <IndicadorResumoVeiculo titulo={`Licenciamento ${anoAtual}`} ok={licenciamentoAnoAtual?.status === "pago"} />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-[#111827] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Avisos</p>
              <h2 className="text-2xl font-black mt-2">{pendencias.length ? `${pendencias.length} aviso(s)` : "Nenhum aviso no momento"}</h2>
            </div>
            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${pendencias.length ? "bg-yellow-500/15 text-yellow-300" : "bg-green-500/15 text-green-300"}`}>
              {pendencias.length ? <FiAlertTriangle /> : <span className="font-black" aria-label="Sem pendências">✓</span>}
            </span>
          </div>
          <div className="mt-5 divide-y divide-gray-800">
            {pendencias.map((item) => <PendenciaVeiculoButton key={item.titulo} {...item} onClick={() => item.acao === "patrimonio" ? setModalAquisicaoAberto(true) : irParaSecao(item.alvo)} />)}
            {!pendencias.length && <p className="py-4 text-sm text-gray-400">Novas informações poderão ser adicionadas nas seções do dashboard.</p>}
          </div>
        </section>
      </div>

      {carregandoDashboard ? (
        <div className="rounded-3xl border border-gray-800 bg-[#111827] p-6 text-gray-400">Carregando dados do veículo...</div>
      ) : (
        <>
          <SecaoDashboardVeiculo titulo="Indicadores operacionais" descricao="Uso acumulado e atividade vinculada a este veículo." icone={<FiActivity />}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <IndicadorVeiculoCard titulo="Odômetro inicial" valor={`${kmInicial.toLocaleString("pt-BR")} km`} />
              <IndicadorVeiculoCard titulo="Odômetro atual" valor={`${kmAtual.toLocaleString("pt-BR")} km`} />
              <IndicadorVeiculoCard titulo="Total de KM rodados" valor={`${totalRodado.toLocaleString("pt-BR")} km`} destaque="text-green-300" />
              <IndicadorVeiculoCard titulo="Uso trabalho" valor={`${kmTrabalho.toLocaleString("pt-BR")} km`} percentual={`(${formatarPercentualLocal(percentualTrabalho)}%)`} destaque="text-blue-300" />
              <IndicadorVeiculoCard titulo="Uso pessoal" valor={`${kmPessoal.toLocaleString("pt-BR")} km`} percentual={`(${formatarPercentualLocal(percentualPessoal)}%)`} destaque="text-purple-300" />
            </div>
          </SecaoDashboardVeiculo>

          <SecaoDashboardVeiculo titulo="Consumo" descricao="Tipo de combustível e ciclos reais registrados." icone={<FiDroplet />}>
            {consumosPorFonte.length ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {consumosPorFonte.map((consumo) => <ConsumoFonteCard key={consumo.chave} consumo={consumo} formatarMoeda={formatarMoeda} onClick={() => setConsumoSelecionado(consumo)} />)}
              </div>
            ) : <PainelVazioVeiculo texto="Os próximos abastecimentos ou recargas com odômetro formarão aqui a leitura de consumo." />}
          </SecaoDashboardVeiculo>

          <div ref={(elemento) => { secoesRef.current.documentacao = elemento; }}>
            <SecaoDashboardVeiculo titulo="Documentação" descricao="Registros existentes de IPVA e licenciamento." icone={<FiFileText />}>
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setDocumentoModal({ tipo: "ipva", documento: null })} className="rounded-xl border border-green-500/40 px-4 py-3 font-bold text-green-300 hover:bg-green-500/10 flex items-center justify-center gap-2"><FiFileText /> ControlDriver · + IPVA</button>
                <button type="button" onClick={() => setDocumentoModal({ tipo: "licenciamento", documento: null })} className="rounded-xl border border-green-500/40 px-4 py-3 font-bold text-green-300 hover:bg-green-500/10 flex items-center justify-center gap-2"><FiFileText /> ControlDriver · + Licenciamento</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoDocumento titulo="IPVA" valor={ultimoIpva ? `Ano ${ultimoIpva.ano} · ${formatarMoeda(ultimoIpva.valor)}` : "Não cadastrado"} status={ultimoIpva ? textoStatusDocumento(ultimoIpva.status) : "Não informado"} ok={ultimoIpva?.status === "pago"} onClick={ultimoIpva ? () => setDocumentoModal({ tipo: "ipva", documento: ultimoIpva }) : undefined} />
                <InfoDocumento titulo="Licenciamento" valor={ultimoLicenciamento ? `Ano ${ultimoLicenciamento.ano} · ${formatarMoeda(ultimoLicenciamento.valor)}` : "Não cadastrado"} status={ultimoLicenciamento ? textoStatusDocumento(ultimoLicenciamento.status) : "Não informado"} ok={ultimoLicenciamento?.status === "pago"} onClick={ultimoLicenciamento ? () => setDocumentoModal({ tipo: "licenciamento", documento: ultimoLicenciamento }) : undefined} />
              </div>
            </SecaoDashboardVeiculo>
          </div>

          <div ref={(elemento) => { secoesRef.current.protecao = elemento; }}>
            <SecaoDashboardVeiculo
              titulo="Proteção"
              descricao="Seguro e proteção vinculados ao veículo."
              icone={<FiShield />}
              acaoCabecalho={!veiculo.protecao ? (
                <button type="button" onClick={() => onGerenciarProtecao()} className="shrink-0 rounded-xl border border-green-500/40 px-4 py-2 font-bold text-green-300 hover:bg-green-500/10">Cadastrar proteção</button>
              ) : null}
            >
              <div className="mb-4 flex flex-wrap gap-3">
                {veiculo.protecao && <button type="button" onClick={() => onGerenciarProtecao("renovar")} className="rounded-xl border border-green-500/40 px-4 py-2 font-bold text-green-300 hover:bg-green-500/10">Renovar</button>}
                {veiculo.protecao && <button type="button" onClick={() => onGerenciarProtecao("cancelar")} className="rounded-xl border border-red-500/40 px-4 py-2 font-bold text-red-300 hover:bg-red-500/10">Cancelar</button>}
                {veiculo.protecao && <button type="button" onClick={() => onGerenciarProtecao("substituir")} className="rounded-xl border border-blue-500/40 px-4 py-2 font-bold text-blue-300 hover:bg-blue-500/10">Substituir</button>}
              </div>
              <InfoDocumento titulo="Seguro / proteção" valor={veiculo.protecao?.nome_protecao || "Não cadastrado"} status={protecaoVigente ? "Vigente" : veiculo.protecao ? "Fora da vigência" : "Não informado"} ok={protecaoVigente} />
              {veiculo.protecao && <ProtecaoVeiculoCard protecao={veiculo.protecao} formatarMoeda={formatarMoeda} compacto />}
              {dadosDashboard.protecoes.some((item) => item.id !== veiculo.protecao?.id) && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-500">Histórico</p>
                  <div className="space-y-2">{dadosDashboard.protecoes.filter((item) => item.id !== veiculo.protecao?.id).map((item) => <div key={item.id} className="rounded-xl border border-gray-800 bg-[#0B1120] p-3"><p className="font-bold">{item.nome_protecao}</p><p className="mt-1 text-xs text-gray-500">{formatarDataBRLocal(item.inicio_vigencia)} até {formatarDataBRLocal(item.fim_vigencia)} · {item.status || "Encerrada"}</p></div>)}</div>
                </div>
              )}
            </SecaoDashboardVeiculo>
          </div>

          <div ref={(elemento) => { secoesRef.current.tag = elemento; }}>
            <SecaoDashboardVeiculo titulo="TAG vinculada" descricao="Saldo e movimentações recentes da TAG deste veículo." icone={<FiTag />}>
              {tag ? (
                <div className="space-y-4">
                  <button type="button" onClick={() => setTagEtapa("menu")} className="w-full rounded-xl border border-green-500/40 p-3 font-bold text-green-300 hover:bg-green-500/10">Movimentar TAG</button>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  <div className="xl:col-span-2">
                    <TagFinanceiraCard
                      tag={tag}
                      contasBanco={contasBanco}
                      cartoes={cartoes}
                      formatarMoeda={formatarMoeda}
                      formatarMoedaDigitada={formatarMoedaDigitada}
                      numeroParaMoedaInput={numeroParaMoedaInput}
                      onAtualizar={async () => {
                        await onRecarregar?.();
                        await onConfiguracaoTagAlterada?.();
                      }}
                      onErro={onErro}
                    />
                  </div>
                  <div className="grid grid-cols-2 xl:grid-cols-1 gap-3">
                    <MiniInfoVeiculo titulo="Última utilização" valor={ultimaUtilizacaoTag ? formatarDataBRLocal(ultimaUtilizacaoTag) : "Não informado"} />
                    <MiniInfoVeiculo titulo="Última recarga" valor={ultimaRecargaTag ? formatarDataBRLocal(ultimaRecargaTag) : "Não informado"} />
                  </div>
                  </div>
                </div>
              ) : <PainelVazioVeiculo texto="Nenhuma TAG está vinculada a este veículo." />}
            </SecaoDashboardVeiculo>
          </div>

          <div ref={(elemento) => { secoesRef.current.manutencao = elemento; }}>
            <SecaoDashboardVeiculo titulo="Manutenção" descricao="Revisões e próximos cuidados do veículo." icone={<FiTool />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <MiniInfoVeiculo titulo="Última revisão" valor={formatarUltimaRevisao(ultimaRevisao)} />
                <MiniInfoVeiculo titulo="Próxima revisão" valor={formatarProximaRevisao(ultimaRevisao)} />
              </div>
              <ListaDashboardVeiculo itens={historicoManutencao.slice(0, 5)} formatarMoeda={formatarMoeda} vazio="Nenhuma manutenção vinculada." onSelecionar={(item) => setManutencaoSelecionada(item.detalhes)} />
            </SecaoDashboardVeiculo>
          </div>

          <SecaoDashboardVeiculo titulo="Informações do Veículo" descricao="Posse, aquisição e situação patrimonial." icone={<FiFileText />}>
            <div className="mb-4 flex flex-wrap gap-3">
              {veiculo.tipo_posse === "proprio" && <button type="button" onClick={() => setModalAquisicaoAberto(true)} className="rounded-xl border border-green-500/40 px-4 py-2 font-bold text-green-300 hover:bg-green-500/10">Editar informações patrimoniais</button>}
              {(veiculo.tipo_posse === "alugado" || veiculo.situacao_aquisicao === "financiado") && <button type="button" onClick={onGerenciarVeiculo} className="rounded-xl border border-green-500/40 px-4 py-2 font-bold text-green-300 hover:bg-green-500/10">Gerenciar contrato</button>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniInfoVeiculo titulo="Posse" valor={veiculo.tipo_posse === "alugado" ? "Alugado" : "Próprio"} />
              <MiniInfoVeiculo titulo="Situação patrimonial" valor={veiculo.tipo_posse === "alugado" ? "Não se aplica" : veiculo.situacao_aquisicao === "financiado" ? "Financiado" : veiculo.situacao_aquisicao === "quitado" ? "Quitado" : "Não informado"} />
              <MiniInfoVeiculo titulo="Valor pago" valor={dadosDashboard.aquisicao?.valor_pago == null ? "Não informado" : formatarMoeda(dadosDashboard.aquisicao.valor_pago)} />
              <MiniInfoVeiculo titulo="Forma de aquisição" valor={dadosDashboard.aquisicao?.forma_aquisicao || "Não informada"} />
              {veiculo.financiamento && <MiniInfoVeiculo titulo="Entrada" valor={formatarMoeda(veiculo.financiamento.valor_entrada)} />}
              {veiculo.financiamento && <MiniInfoVeiculo titulo="Parcelas pagas" valor={`${Number(veiculo.financiamento.parcelas_pagas || 0)} de ${Number(veiculo.financiamento.total_parcelas || 0)}`} />}
              {veiculo.financiamento && <MiniInfoVeiculo titulo="Saldo devedor" valor={veiculo.financiamento.saldo_devedor == null ? "Não informado" : formatarMoeda(veiculo.financiamento.saldo_devedor)} />}
            </div>
          </SecaoDashboardVeiculo>

          <div ref={(elemento) => { secoesRef.current.financeiro = elemento; }}>
          <SecaoDashboardVeiculo titulo="Indicadores financeiros" descricao="Custos, contratos e patrimônio vinculados ao veículo." icone={<FiDollarSign />}>
            {veiculo.aluguel && (
              <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MiniInfoVeiculo titulo="Locador" valor={veiculo.aluguel.locador} />
                <MiniInfoVeiculo titulo="Valor" valor={formatarMoeda(veiculo.aluguel.valor)} />
                <MiniInfoVeiculo titulo="Frequência" valor={veiculo.aluguel.frequencia} />
                <MiniInfoVeiculo titulo="Cobrança" valor={veiculo.aluguel.desconto_plataforma ? "Desconto automático por plataforma" : textoFormaProtecaoLocal(veiculo.aluguel.forma_pagamento)} />
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <IndicadorVeiculoCard titulo="Receita Total Gerada pelo Veículo" valor={formatarMoeda(receita)} destaque="text-green-300" />
              <IndicadorVeiculoCard titulo="Custo Total Gerado pelo Veículo" valor={formatarMoeda(gastos)} destaque="text-red-300" />
              <IndicadorVeiculoCard titulo="Resultado Operacional do Veículo" valor={formatarMoeda(resultadoOperacional)} destaque={resultadoOperacional >= 0 ? "text-green-300" : "text-red-300"} />
              <IndicadorVeiculoCard titulo="Custo operacional por KM (custos acumulados ÷ KM total)" valor={totalRodado > 0 ? formatarMoeda(gastos / totalRodado) : "Base insuficiente"} />
              {dadosDashboard.aquisicao?.valor_pago != null && <IndicadorVeiculoCard titulo="Valor pago" valor={formatarMoeda(dadosDashboard.aquisicao.valor_pago)} />}
              {dadosDashboard.aquisicao?.valor_atual != null && <IndicadorVeiculoCard titulo="Valor atual" valor={formatarMoeda(dadosDashboard.aquisicao.valor_atual)} />}
              {mostrarAbastecimentos && <IndicadorVeiculoCard titulo="Abastecimentos" valor={formatarMoeda(gastosAbastecimento)} />}
              {mostrarRecargas && <IndicadorVeiculoCard titulo="Recargas elétricas" valor={formatarMoeda(gastosRecarga)} />}
              {mostrarContrato && <IndicadorVeiculoCard titulo={veiculo.tipo_posse === "alugado" ? "Aluguel" : "Financiamento"} valor={formatarMoeda(gastosContratos)} />}
            </div>
            <p className="mt-4 text-xs text-gray-500">Base atual do custo operacional: abastecimentos, recargas elétricas, manutenções e contratos vinculados. Seguro/proteção, IPVA, licenciamento e acessórios serão incorporados quando suas regras financeiras forem definidas.</p>
          </SecaoDashboardVeiculo>
          </div>
        </>
      )}

      {documentoModal && <DocumentacaoVeiculoModal aberto tipo={documentoModal.tipo} documento={documentoModal.documento} onClose={() => setDocumentoModal(null)} onSalvar={salvarDocumento} salvando={salvandoCentral} />}
      {modalAquisicaoAberto && <AquisicaoVeiculoModal aberto aquisicao={dadosDashboard.aquisicao} situacaoPatrimonial={veiculo.situacao_aquisicao} onClose={() => setModalAquisicaoAberto(false)} onSalvar={salvarAquisicao} salvando={salvandoCentral} />}
      {consumoSelecionado && <ConsumoCombustivelModal aberto consumo={consumoSelecionado} onClose={() => setConsumoSelecionado(null)} />}
      {manutencaoSelecionada && <ManutencaoDetalhesModal aberto manutencao={manutencaoSelecionada} onClose={() => setManutencaoSelecionada(null)} formatarMoeda={formatarMoeda} />}
      {tagEtapa && tag && <TagModal aberto etapaInicial={tagEtapa} tagInicialId={String(tag.id)} contasTagIniciais={[tag]} onClose={async () => { setTagEtapa(""); await onRecarregar?.(); await onConfiguracaoTagAlterada?.(); }} />}
    </div>
  );
}

function SecaoDashboardVeiculo({ titulo, descricao, icone, acaoCabecalho = null, children }) {
  const cabecalho = (
    <>
      <span className="w-10 h-10 rounded-2xl border border-green-500/20 bg-green-500/10 text-green-300 flex items-center justify-center shrink-0" aria-hidden="true">
        {icone}
      </span>
      <div>
        <h2 className="text-xl sm:text-2xl font-black">{titulo}</h2>
        <p className="text-sm text-gray-400 mt-1">{descricao}</p>
      </div>
    </>
  );
  return (
    <section className="rounded-3xl border border-gray-800 bg-[#111827] p-5 sm:p-6">
      {acaoCabecalho ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {cabecalho}
          </div>
          {acaoCabecalho}
        </div>
      ) : <div className="flex items-start gap-3">{cabecalho}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function IndicadorVeiculoCard({ titulo, valor, percentual = "", destaque = "text-white" }) {
  return (
    <div className="relative min-w-0 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 sm:p-5">
      <p className="text-xs sm:text-sm text-gray-400 leading-snug">{titulo}</p>
      {percentual && <span className="absolute right-4 top-4 text-xs font-black text-gray-400">{percentual}</span>}
      <p className={`text-lg sm:text-2xl font-black mt-2 leading-tight break-words [overflow-wrap:anywhere] ${destaque}`}>{valor}</p>
    </div>
  );
}

function PendenciaVeiculoButton({ titulo, detalhe, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full py-3 text-left flex items-center justify-between gap-3 group">
      <span className="min-w-0">
        <span className="block font-bold text-white group-hover:text-green-300">{titulo}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{detalhe}</span>
      </span>
      <FiArrowLeft className="shrink-0 rotate-180 text-gray-500 group-hover:text-green-400" aria-hidden="true" />
    </button>
  );
}

function ConsumoFonteCard({ consumo, formatarMoeda, onClick }) {
  const temCiclos = consumo.ciclos > 0;
  const formatarConsumo = (valor) => valor > 0 ? `${valor.toFixed(2)} ${consumo.unidadeConsumo}` : "Base insuficiente";

  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl border border-gray-800 bg-[#0B1120] p-4 sm:p-5 text-left hover:border-green-400 transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-300">Fonte de energia</p>
          <h3 className="text-xl font-black mt-1">{consumo.nome}</h3>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-gray-400">{consumo.ciclos} ciclo(s)</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <MiniMetricaConsumo titulo="Média" valor={formatarConsumo(consumo.media)} destaque />
        <MiniMetricaConsumo titulo="Melhor consumo" valor={formatarConsumo(consumo.melhor)} />
        <MiniMetricaConsumo titulo="Pior consumo" valor={formatarConsumo(consumo.pior)} />
        <MiniMetricaConsumo titulo={`Preço médio/${consumo.unidadePreco}`} valor={consumo.precoMedio > 0 ? formatarMoeda(consumo.precoMedio) : "Não informado"} />
        <div className="col-span-2">
          <MiniMetricaConsumo titulo="Custo por KM nos ciclos" valor={temCiclos && consumo.custoPorKm > 0 ? formatarMoeda(consumo.custoPorKm) : "Base insuficiente"} />
        </div>
      </div>
      {!temCiclos && <p className="text-xs text-gray-500 mt-3">É necessário registrar dois lançamentos desta fonte com odômetro válido.</p>}
    </button>
  );
}

function MiniMetricaConsumo({ titulo, valor, destaque = false }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-3 min-w-0">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`font-black mt-1 break-words ${destaque ? "text-blue-300" : "text-white"}`}>{valor}</p>
    </div>
  );
}

function MiniInfoVeiculo({ titulo, valor }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-800 bg-[#0B1120]/80 p-4">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-sm sm:text-base font-bold mt-1 break-words">{valor}</p>
    </div>
  );
}

function BadgeVeiculo({ children, classe }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${classe}`}>{children}</span>;
}

function IndicadorResumoVeiculo({ titulo, ok }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${ok ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>{titulo} {ok ? "✓" : "✕"}</span>;
}

function InfoDocumento({ titulo, valor, status, ok = false, onClick }) {
  const Componente = onClick ? "button" : "div";
  return (
    <Componente type={onClick ? "button" : undefined} onClick={onClick} className={`w-full rounded-2xl border border-gray-800 bg-[#0B1120] p-4 flex items-center justify-between gap-4 text-left ${onClick ? "hover:border-green-400 transition" : ""}`}>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{titulo}</p>
        <p className="font-bold mt-1 break-words">{valor}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black whitespace-nowrap ${ok ? "bg-green-500/15 text-green-300" : "bg-yellow-500/15 text-yellow-300"}`}>{status}</span>
    </Componente>
  );
}

function PainelVazioVeiculo({ texto }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-gray-700 bg-[#0B1120]/60 p-5 text-sm text-gray-400">
      {texto}
    </div>
  );
}

function ProtecaoVeiculoCard({ protecao, formatarMoeda, compacto = false }) {
  const inicio = formatarDataBRLocal(protecao.inicio_vigencia);
  const fim = formatarDataBRLocal(protecao.fim_vigencia);
  const pagas = Number(protecao.parcelas_pagas || 0);
  const total = Number(protecao.numero_parcelas || 1);
  const restantes = Math.max(total - pagas, 0);
  const nomeTipo = protecao.tipo_protecao === "protecao_veicular" ? "Proteção veicular" : "Seguro";

  return (
    <div className={`${compacto ? "mt-4" : "mt-8"} bg-[#111827] border border-purple-500/30 rounded-2xl p-5 sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1">
            <FiShield className="w-3 h-3" />
            {nomeTipo}
          </div>

          <h2 className="text-xl font-bold mt-3">{protecao.nome_protecao}</h2>
          <p className="text-sm text-gray-400 mt-1">
            Vigência: {inicio} até {fim}
          </p>
        </div>

        <div className="sm:text-right">
          <p className="text-xs text-gray-500">Parcelas</p>
          <p className="text-lg font-black text-white">
            {pagas}/{total} pagas
          </p>
          <p className="text-xs text-gray-400">
            {restantes} em aberto
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniInfoTag titulo="Valor da parcela" valor={formatarMoeda(protecao.valor_parcela || protecao.valor_total)} />
        <MiniInfoTag titulo="Forma de pagamento" valor={textoFormaProtecaoLocal(protecao.forma_pagamento)} />
        <MiniInfoTag titulo="Próximo vencimento" valor={formatarDataBRLocal(protecao.primeiro_vencimento_pendente)} />
      </div>
    </div>
  );
}

function normalizarTextoVeiculo(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterUltimoDocumento(documentos, termo) {
  return [...(documentos || [])]
    .filter((documento) => documento.tipo === termo)
    .sort((a, b) => Number(b.ano || 0) - Number(a.ano || 0))[0] || null;
}

function obterUltimaRevisao(manutencoesFinanceiras, manutencoes) {
  const revisoesEstruturadas = (manutencoes || []).map((item) => ({
      data: item.data,
      titulo: item.titulo || "Manutenção",
      odometro: item.odometro,
      proximaRevisaoKm: null,
      proximaRevisaoData: null,
      servicos: item.servicos || [],
    }))
    .filter((item) => item.data)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (revisoesEstruturadas.length) return revisoesEstruturadas[0];

  return (manutencoesFinanceiras || []).map((item) => ({
      data: item.saidas?.data_compra,
      titulo: item.servico || item.saidas?.descricao || "Manutenção",
      odometro: item.odometro,
      proximaRevisaoKm: item.proxima_revisao_km,
      proximaRevisaoData: item.proxima_revisao_data,
      servicos: [],
    }))
    .filter((item) => item.data)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null;
}

function formatarProximaRevisao(revisao) {
  if (!revisao) return "Não informado";
  const proximaKm = [revisao.proximaRevisaoKm, ...(revisao.servicos || []).map((servico) => servico.proxima_revisao_km)]
    .map(Number)
    .filter((valor) => Number.isFinite(valor) && valor > 0)
    .sort((a, b) => a - b)[0];

  const partes = [];
  const proximaData = [revisao.proximaRevisaoData, ...(revisao.servicos || []).map((servico) => servico.proxima_revisao_data)]
    .filter(Boolean)
    .sort()[0];
  if (proximaData) partes.push(formatarDataBRLocal(proximaData));
  if (proximaKm) partes.push(`${proximaKm.toLocaleString("pt-BR")} km previstos`);
  return partes.join(" · ") || "Não informado";
}

function formatarUltimaRevisao(revisao) {
  if (!revisao) return "Não informado";
  const partes = [formatarDataBRLocal(revisao.data)];
  if (Number(revisao.odometro || 0) > 0) partes.push(`${Number(revisao.odometro).toLocaleString("pt-BR")} km`);
  return partes.join(" · ");
}

function formatarPercentualLocal(valor) {
  const numero = Number(valor || 0);
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function textoStatusDocumento(status) {
  const nomes = {
    aberto: "Em aberto",
    aberta: "Em aberto",
    pago: "Pago",
    paga: "Pago",
    pendente: "Pendente",
    parcelado: "Parcelado",
    entrada_parcelas: "Entrada + Parcelas",
    vencido: "Vencido",
    vencida: "Vencido",
  };
  return nomes[normalizarTextoVeiculo(status)] || status || "Registrado";
}

function formatarDataBRLocal(dataISO) {
  if (!dataISO) return "-";
  const [ano, mes, dia] = String(dataISO).split("-");
  return `${dia}/${mes}/${ano}`;
}

function textoFormaProtecaoLocal(valor) {
  const nomes = {
    pix: "Pix",
    debito: "Débito",
    dinheiro: "Dinheiro",
    credito_avista: "Crédito à vista",
    credito_parcelado: "Crédito parcelado",
    boleto: "Boleto",
    boleto_parcelado: "Boleto parcelado",
  };

  return nomes[valor] || valor || "-";
}

function MiniInfoTag({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-sm font-bold text-white mt-1">{valor}</p>
    </div>
  );
}


function ListaDashboardVeiculo({ itens, formatarMoeda, vazio, onSelecionar }) {
  if (!itens.length) return <p className="text-sm text-gray-400">{vazio}</p>;
  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <button type="button" key={item.id} onClick={() => onSelecionar?.(item)} className="w-full rounded-xl border border-gray-800 bg-[#0B1120] p-4 flex items-start justify-between gap-4 text-left hover:border-green-400 transition">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{formatarDataBRLocal(item.data)}</p>
            <p className="font-bold text-white mt-1">{item.tipo}</p>
            <p className="text-sm text-gray-400 truncate">{item.descricao || "Sem descrição"}</p>
          </div>
          {item.valor != null && <p className="font-black text-white shrink-0">{formatarMoeda(item.valor)}</p>}
        </button>
      ))}
    </div>
  );
}

function ModalConfirmacao({ titulo, texto, subtitulo, cancelar, confirmar, textoConfirmar, cor }) {
  const corBotao = cor === "red" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-black";
  const corTitulo = cor === "red" ? "text-red-400" : "text-green-400";

  return (
    <ModalBase aberto titulo={titulo} onClose={cancelar} largura="max-w-md" rodape={(
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={cancelar} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className={`${corBotao} font-bold rounded-xl p-3`}>
            {textoConfirmar}
          </button>
        </div>
      )}>
      <div className={corTitulo}><p className="text-gray-300">{texto}</p>{subtitulo && <p className="text-gray-500 text-sm mt-2">{subtitulo}</p>}</div>
    </ModalBase>
  );
}
