import { useEffect, useState } from "react";
import { supabase } from "../../../services/supabase";
import TagModal from "../../tag/components/TagModal";
import VeiculoModal from "../components/VeiculoModal";
import ModalBase from "../../../shared/components/modals/ModalBase";

import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import { FiArrowDown, FiArrowLeft, FiArrowUp, FiEdit2, FiShield, FiStar, FiTag, FiTrash2, FiX } from "react-icons/fi";
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

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [contasBanco, setContasBanco] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [veiculoDetalhes, setVeiculoDetalhes] = useState(null);
  const [modalConfigTagAberto, setModalConfigTagAberto] = useState(false);
  const [tagConfigEditando, setTagConfigEditando] = useState(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [veiculoEditando, setVeiculoEditando] = useState(null);

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
  const [modalFormaRecargaTagAberto, setModalFormaRecargaTagAberto] = useState(false);
  const [modalContaRecargaTagAberto, setModalContaRecargaTagAberto] = useState(false);
  const [modalCartaoRecargaTagAberto, setModalCartaoRecargaTagAberto] = useState(false);

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
    await Promise.all([carregarVeiculos(), carregarContasBanco(), carregarCartoes()]);
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

        return {
          ...veiculo,
          tag,
          protecao,
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
    setVeiculoEditando(null);
    setMarca("");
    setModelo("");
    setAno("");
    setPlaca("");
    setOdometroInicial("");
    setCategoriaVeiculo("flex");
    resetTag();
    resetProtecao();
    setModalAberto(true);
  }

  function abrirEditarVeiculo(veiculo) {
    setVeiculoEditando(veiculo);
    setMarca(veiculo.marca || "");
    setModelo(veiculo.modelo || "");
    setAno(String(veiculo.ano || ""));
    setPlaca(veiculo.placa || "");
    setOdometroInicial(String(veiculo.odometro_inicial || veiculo.odometro_atual || ""));
    setCategoriaVeiculo(veiculo.categoria_veiculo || "flex");

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

  function fecharModal() {
    setModalAberto(false);
    setVeiculoEditando(null);
    setMarca("");
    setModelo("");
    setAno("");
    setPlaca("");
    setOdometroInicial("");
    setCategoriaVeiculo("flex");
    resetTag();
    resetProtecao();
  }

  function nomeCategoria(valor) {
    return categoriasVeiculo.find((item) => item.valor === valor)?.nome || valor;
  }

  function selecionarCategoria(valor) {
    setCategoriaVeiculo(valor);
    setModalCategoriaAberto(false);
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
          .update({ ativo: false })
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
      tipo_protecao: "protecao_veicular",
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
    };

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

  async function salvarTagDoVeiculo(veiculoId, nomeVeiculo) {
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
        await salvarTagDoVeiculo(veiculoEditando.id, nomeGerado);
        await salvarProtecaoDoVeiculo(veiculoEditando.id, nomeGerado);
      } catch (errorTag) {
        console.error(errorTag);
        abrirAviso("Erro", "Veículo salvo, mas houve erro ao salvar a TAG.", "erro");
        return;
      }

      setModalKmInicialAberto(false);
      setKmInicialPendente("");
      fecharModal();
      carregarVeiculos();
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
        await salvarTagDoVeiculo(veiculoReativado.id, nomeGerado);
        await salvarProtecaoDoVeiculo(veiculoReativado.id, nomeGerado);
      } catch (errorTag) {
        console.error(errorTag);
        abrirAviso("Erro", "Veículo reativado, mas houve erro ao salvar a TAG.", "erro");
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
      await salvarTagDoVeiculo(novoVeiculo.id, nomeGerado);
      await salvarProtecaoDoVeiculo(novoVeiculo.id, nomeGerado);
    } catch (errorTag) {
      console.error(errorTag);
      abrirAviso("Erro", "Veículo criado, mas houve erro ao salvar a TAG.", "erro");
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

  function solicitarExclusaoVeiculo(veiculo) {
    if (veiculo.principal) {
      abrirAviso(
        "Veículo principal",
        "Você não pode excluir o veículo principal. Defina outro veículo como principal antes.",
        "erro"
      );
      return;
    }

    setVeiculoParaExcluir(veiculo);
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoVeiculo() {
    if (!veiculoParaExcluir) return;

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

    setModalExcluirAberto(false);
    setVeiculoParaExcluir(null);
    carregarVeiculos();
  }

  function abrirDetalhes(veiculo) {
    setVeiculoDetalhes(veiculo);
  }

  function abrirConfigurarTag(tag) {
    setTagConfigEditando(tag);
    setModalConfigTagAberto(true);
  }

  function fecharConfigurarTag() {
    setModalConfigTagAberto(false);
    setTagConfigEditando(null);
  }

  async function salvarConfigurarTag(dadosTag) {
    if (!tagConfigEditando) return;

    const payload = {
      nome: dadosTag.nome.trim(),
      tipo_tag: dadosTag.tipo_tag,
      recarga_automatica: dadosTag.tipo_tag === "pre_paga" ? dadosTag.recarga_automatica : false,
      valor_recarga_automatica:
        dadosTag.tipo_tag === "pre_paga" && dadosTag.recarga_automatica
          ? moedaParaNumero(dadosTag.valor_recarga_automatica)
          : 0,
      percentual_alerta_recarga:
        dadosTag.tipo_tag === "pre_paga" && dadosTag.recarga_automatica
          ? Number(dadosTag.percentual_alerta_recarga || 30)
          : 30,
      tag_forma_recarga:
        dadosTag.tipo_tag === "pre_paga" && dadosTag.recarga_automatica
          ? dadosTag.tag_forma_recarga
          : null,
      tag_conta_recarga_id:
        dadosTag.tipo_tag === "pre_paga" &&
        dadosTag.recarga_automatica &&
        ["debito", "pix"].includes(dadosTag.tag_forma_recarga)
          ? Number(dadosTag.tag_conta_recarga_id)
          : null,
      tag_cartao_recarga_id:
        dadosTag.tipo_tag === "pre_paga" &&
        dadosTag.recarga_automatica &&
        dadosTag.tag_forma_recarga === "credito_avista"
          ? Number(dadosTag.tag_cartao_recarga_id)
          : null,
    };

    const { error } = await supabase
      .from("contas")
      .update(payload)
      .eq("id", tagConfigEditando.id);

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao configurar TAG.", "erro");
      return;
    }

    fecharConfigurarTag();
    await carregarVeiculos();

    if (veiculoDetalhes) {
      const { data: veiculoAtualizado } = await supabase
        .from("veiculos")
        .select("*")
        .eq("id", veiculoDetalhes.id)
        .maybeSingle();

      if (veiculoAtualizado) {
        const tagAtualizada = {
          ...tagConfigEditando,
          ...payload,
          saldo_atual: tagConfigEditando.saldo_atual,
        };

        setVeiculoDetalhes({
          ...veiculoDetalhes,
          ...veiculoAtualizado,
          tag: tagAtualizada,
        });
      }
    }
  }

  if (veiculoDetalhes) {
    return (
      <>
        <DetalhesVeiculo
          veiculo={veiculoDetalhes}
          voltar={() => setVeiculoDetalhes(null)}
          nomeCategoria={nomeCategoria}
          formatarMoeda={formatarMoeda}
          configurarTag={abrirConfigurarTag}
          onRecarregar={carregarVeiculos}
        />

        <ConfigurarTagModal
          aberto={modalConfigTagAberto}
          tag={tagConfigEditando}
          contasBanco={contasBanco}
          cartoes={cartoes}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          numeroParaMoedaInput={numeroParaMoedaInput}
          onClose={fecharConfigurarTag}
          onSalvar={salvarConfigurarTag}
        />
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
          const kmInicial = Number(veiculo.odometro_inicial || 0);
          const kmAtual = Number(veiculo.odometro_atual || 0);
          const totalRodado = Number(veiculo.total_rodado_calculado || 0);
          const kmTrabalho = Number(veiculo.km_trabalho_calculado || 0);
          const kmPessoal = Number(veiculo.km_pessoal_calculado || 0);

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
                    {[veiculo.marca, veiculo.modelo, veiculo.ano].filter(Boolean).join(" ")}
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

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditarVeiculo(veiculo);
                    }}
                    className="w-9 h-9 rounded-xl border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 flex items-center justify-center transition"
                    title="Editar veículo"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      solicitarExclusaoVeiculo(veiculo);
                    }}
                    className="w-9 h-9 rounded-xl border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-400/40 flex items-center justify-center transition"
                    title="Excluir veículo"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {veiculo.principal && (
                  <div className="inline-flex items-center rounded-full bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1">
                    Veículo Principal
                  </div>
                )}

                {veiculo.tag && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1">
                    <FiTag className="w-3 h-3" />
                    <span>TAG {veiculo.tag.nome}</span>
                  </div>
                )}

                {veiculo.protecao && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1">
                    <FiShield className="w-3 h-3" />
                    <span>Proteção ativa</span>
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

              <div className="mt-7 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-400">Resumo interno</p>
                  <p className="text-sm text-gray-500 mt-1">KM, uso pessoal/trabalho e histórico ficam nos detalhes.</p>
                </div>
                <span className="text-green-400 font-bold text-sm whitespace-nowrap">Ver detalhes</span>
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

      <VeiculoModal
        aberto={modalAberto}
        veiculoEditando={veiculoEditando}
        categoriasVeiculo={categoriasVeiculo}
        categoriaVeiculo={categoriaVeiculo}
        nomeCategoria={nomeCategoria}
        onSelecionarCategoria={selecionarCategoria}
        onClose={fecharModal}
        onSalvar={salvarVeiculo}
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className={`text-2xl font-bold ${modalAviso.tipo === "erro" ? "text-red-400" : "text-green-400"}`}>
              {modalAviso.titulo}
            </h2>
            <p className="text-gray-300 mt-4">{modalAviso.mensagem}</p>
            <button type="button" onClick={fecharAviso} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalhesVeiculo({ veiculo, voltar, nomeCategoria, formatarMoeda, configurarTag, onRecarregar }) {
  const kmInicial = Number(veiculo.odometro_inicial || 0);
  const kmAtual = Number(veiculo.odometro_atual || 0);
  const totalRodado = Number(veiculo.total_rodado_calculado || 0);
  const kmTrabalho = Number(veiculo.km_trabalho_calculado || 0);
  const kmPessoal = Number(veiculo.km_pessoal_calculado || 0);
  const tag = veiculo.tag;
  const [modalTagAberto, setModalTagAberto] = useState(false);
  const [modalRecargaAberto, setModalRecargaAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [dadosDashboard, setDadosDashboard] = useState({ entradas: [], abastecimentos: [], recargas: [], manutencoes: [], manutencoesLegadas: [] });
  const [carregandoDashboard, setCarregandoDashboard] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregarDashboardVeiculo() {
      setCarregandoDashboard(true);
      const [entradas, abastecimentos, recargas, manutencoes, manutencoesLegadas] = await Promise.all([
        supabase.from("entradas").select("id, data, km_rodados, entrada_plataformas(faturamento, valor_reembolso)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_abastecimentos").select("*, saidas(id, data_compra, valor_total, categoria, descricao)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_recargas_eletricas").select("*, saidas(id, data_compra, valor_total, categoria, descricao)").eq("veiculo_id", veiculo.id),
        supabase.from("saidas_manutencoes").select("*, saidas(id, data_compra, valor_total, categoria, descricao)").eq("veiculo_id", veiculo.id),
        supabase.from("manutencoes").select("*").eq("veiculo_id", veiculo.id),
      ]);
      if (!ativo) return;
      setDadosDashboard({
        entradas: entradas.data || [],
        abastecimentos: abastecimentos.data || [],
        recargas: recargas.data || [],
        manutencoes: manutencoes.data || [],
        manutencoesLegadas: manutencoesLegadas.data || [],
      });
      setCarregandoDashboard(false);
    }
    carregarDashboardVeiculo();
    return () => { ativo = false; };
  }, [veiculo.id]);

  const receita = dadosDashboard.entradas.reduce((total, entrada) => total + (entrada.entrada_plataformas || []).reduce((soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0), 0), 0);
  const gastosAbastecimento = dadosDashboard.abastecimentos.reduce((total, item) => total + Number(item.saidas?.valor_total || 0), 0);
  const gastosRecarga = dadosDashboard.recargas.reduce((total, item) => total + Number(item.saidas?.valor_total || 0), 0);
  const gastosManutencao = dadosDashboard.manutencoes.reduce((total, item) => total + Number(item.saidas?.valor_total || 0), 0);
  const gastos = gastosAbastecimento + gastosRecarga + gastosManutencao;
  const consumos = dadosDashboard.abastecimentos.map((item) => Number(item.consumo_km_l || 0)).filter((valor) => valor > 0);
  const mediaConsumo = consumos.length ? consumos.reduce((soma, valor) => soma + valor, 0) / consumos.length : 0;
  const historico = [
    ...dadosDashboard.abastecimentos.map((item) => ({ id: `a-${item.id}`, data: item.saidas?.data_compra, tipo: "Abastecimento", descricao: item.saidas?.descricao, valor: item.saidas?.valor_total })),
    ...dadosDashboard.recargas.map((item) => ({ id: `r-${item.id}`, data: item.saidas?.data_compra, tipo: "Recarga elétrica", descricao: item.local_recarga, valor: item.saidas?.valor_total })),
    ...dadosDashboard.manutencoes.map((item) => ({ id: `m-${item.id}`, data: item.saidas?.data_compra, tipo: "Manutenção", descricao: item.servico, valor: item.saidas?.valor_total })),
    ...dadosDashboard.manutencoesLegadas.map((item) => ({ id: `ml-${item.id}`, data: item.data, tipo: "Manutenção", descricao: item.titulo, valor: null })),
  ].filter((item) => item.data).sort((a, b) => String(b.data).localeCompare(String(a.data)));

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={voltar}
            className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center shrink-0"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">
              {[veiculo.marca, veiculo.modelo, veiculo.ano].filter(Boolean).join(" ")}
            </h1>
            <p className="text-gray-400 mt-1">Histórico e controle completo do veículo</p>
          </div>
        </div>

        {tag && (
          <TagVidroCard
            tag={tag}
            formatarMoeda={formatarMoeda}
            onClick={() => setModalTagAberto(true)}
          />
        )}
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist">
        {["resumo", "financeiro", "consumo", "manutencao", "historico"].map((aba) => (
          <button key={aba} type="button" role="tab" aria-selected={abaAtiva === aba} onClick={() => setAbaAtiva(aba)} className={`whitespace-nowrap rounded-xl border px-4 py-3 font-bold capitalize ${abaAtiva === aba ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 text-gray-300"}`}>
            {aba === "manutencao" ? "Manutenção" : aba === "historico" ? "Histórico" : aba}
          </button>
        ))}
      </div>

      <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-5 sm:p-8">
        {carregandoDashboard ? <p className="text-gray-400">Carregando dados do veículo...</p> : null}

        {!carregandoDashboard && abaAtiva === "resumo" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResumoCard titulo="Categoria" valor={nomeCategoria(veiculo.categoria_veiculo)} />
          <ResumoCard titulo="Posse" valor={veiculo.tipo_posse === "alugado" ? "Alugado" : veiculo.tipo_posse === "proprio" ? "Próprio" : "Não informado"} />
          <ResumoCard titulo="Aquisição" valor={veiculo.situacao_aquisicao === "financiado" ? "Financiado" : veiculo.situacao_aquisicao === "quitado" ? "Quitado" : "Não informado"} />
          <ResumoCard titulo="KM inicial" valor={`${kmInicial.toLocaleString("pt-BR")} km`} />
          <ResumoCard titulo="KM atual" valor={`${kmAtual.toLocaleString("pt-BR")} km`} />
          <ResumoCard titulo="Total rodado" valor={`${totalRodado.toLocaleString("pt-BR")} km`} />
          <ResumoCard titulo="Uso trabalho" valor={`${kmTrabalho.toLocaleString("pt-BR")} km`} />
          <ResumoCard titulo="Uso pessoal" valor={`${kmPessoal.toLocaleString("pt-BR")} km`} />
          <ResumoCard titulo="TAG / saldo" valor={tag ? `${tag.nome} · ${formatarMoeda(tag.saldo_atual)}` : "Sem TAG"} />
          <ResumoCard titulo="Seguro / proteção" valor={veiculo.protecao?.nome_protecao || "Não informado"} />
        </div>}

        {!carregandoDashboard && abaAtiva === "financeiro" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResumoCard titulo="Receita vinculada" valor={formatarMoeda(receita)} />
          <ResumoCard titulo="Gastos vinculados" valor={formatarMoeda(gastos)} />
          <ResumoCard titulo="Resultado operacional" valor={formatarMoeda(receita - gastos)} />
          <ResumoCard titulo="Abastecimentos" valor={formatarMoeda(gastosAbastecimento)} />
          <ResumoCard titulo="Recargas elétricas" valor={formatarMoeda(gastosRecarga)} />
          <ResumoCard titulo="Manutenções" valor={formatarMoeda(gastosManutencao)} />
          <ResumoCard titulo="Custo por KM" valor={totalRodado > 0 ? formatarMoeda(gastos / totalRodado) : "Base insuficiente"} />
        </div>}

        {!carregandoDashboard && abaAtiva === "consumo" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResumoCard titulo="Média" valor={mediaConsumo > 0 ? `${mediaConsumo.toFixed(2)} km/L` : "Sem base confiável"} />
          <ResumoCard titulo="Melhor" valor={consumos.length ? `${Math.max(...consumos).toFixed(2)} km/L` : "-"} />
          <ResumoCard titulo="Pior" valor={consumos.length ? `${Math.min(...consumos).toFixed(2)} km/L` : "-"} />
          <ResumoCard titulo="Recarga elétrica" valor={veiculo.media_eletrica_km_kwh > 0 ? `${Number(veiculo.media_eletrica_km_kwh).toFixed(2)} km/kWh` : "Sem base confiável"} />
        </div>}

        {!carregandoDashboard && abaAtiva === "manutencao" && <ListaDashboardVeiculo itens={historico.filter((item) => item.tipo === "Manutenção")} formatarMoeda={formatarMoeda} vazio="Nenhuma manutenção vinculada." />}
        {!carregandoDashboard && abaAtiva === "historico" && <ListaDashboardVeiculo itens={historico} formatarMoeda={formatarMoeda} vazio="Nenhum evento vinculado ao veículo." />}
      </div>

      {veiculo.protecao && (
        <ProtecaoVeiculoCard protecao={veiculo.protecao} formatarMoeda={formatarMoeda} />
      )}

      {tag && modalTagAberto && (
        <ModalDetalhesTag
          tag={tag}
          formatarMoeda={formatarMoeda}
          fechar={() => setModalTagAberto(false)}
          configurar={configurarTag}
          recarregar={() => setModalRecargaAberto(true)}
        />
      )}

      {tag && (
        <TagModal
          aberto={modalRecargaAberto}
          onClose={async () => {
            setModalRecargaAberto(false);
            await onRecarregar?.();
          }}
          etapaInicial="recarga"
          tagInicialId={String(tag.id)}
        />
      )}
    </div>
  );
}

function TagVidroCard({ tag, formatarMoeda, onClick }) {
  const saldo = Number(tag.saldo_atual || 0);
  const saldoNegativo = saldo < 0;
  const prePaga = (tag.tipo_tag || "pre_paga") === "pre_paga";
  const valorRecarga = Number(tag.valor_recarga_automatica || 0);
  const percentual = Number(tag.percentual_alerta_recarga || 30);
  const gatilho = valorRecarga > 0 ? valorRecarga * (percentual / 100) : 0;
  const precisaRecarga = prePaga && valorRecarga > 0 && saldo <= gatilho;
  

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full xl:w-[620px] text-left rounded-2xl border px-5 py-4 transition hover:border-green-400/60 hover:bg-white/[0.03] ${
        precisaRecarga
          ? "border-red-500/40 bg-red-500/10"
          : "border-blue-400/30 bg-[#111827]"
      }`}
    >
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold px-3 py-1">
              <FiTag className="w-3 h-3" /> TAG no vidro • {prePaga ? "Pré-paga" : "Pós-paga"}
            </span>

            {precisaRecarga && (
              <span className="rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold px-3 py-1">
                Recarga necessária
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xl font-black text-white truncate">{tag.nome}</span>
            <span className="text-xs text-gray-500">Toque para mais informações.</span>
          </div>
        </div>

        <div className="shrink-0 text-right border-l border-blue-500/20 pl-5">
          <p className="text-xs text-gray-400">Saldo da TAG</p>
          <strong className={`text-3xl font-black leading-tight ${saldoNegativo ? "text-red-400" : "text-white"}`}>
            {formatarMoeda(saldo)}
          </strong>
        </div>
      </div>
    </button>
  );
}

function ModalDetalhesTag({ tag, formatarMoeda, fechar, configurar, recarregar }) {
  const saldo = Number(tag.saldo_atual || 0);
  const prePaga = (tag.tipo_tag || "pre_paga") === "pre_paga";
  const valorRecarga = Number(tag.valor_recarga_automatica || 0);
  const percentual = Number(tag.percentual_alerta_recarga || 30);
  const gatilho = valorRecarga > 0 ? valorRecarga * (percentual / 100) : 0;
  const precisaRecarga = prePaga && valorRecarga > 0 && saldo <= gatilho;
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregandoMovimentacoes, setCarregandoMovimentacoes] = useState(false);

  useEffect(() => {
    carregarMovimentacoesTag();
  }, [tag.id]);

  function formatarDataBR(dataISO) {
    if (!dataISO) return "-";
    const [ano, mes, dia] = String(dataISO).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function textoFormaRecarga() {
    if (tag.tag_forma_recarga === "credito_avista") return "Cartão de crédito";
    if (tag.tag_forma_recarga === "debito") return "Débito em conta";
    if (tag.tag_forma_recarga === "pix") return "Pix";
    return "Não definida";
  }

  async function carregarMovimentacoesTag() {
    setCarregandoMovimentacoes(true);

    try {
      const { data: usosData } = await supabase
        .from("saidas_tag")
        .select(`
          id,
          conta_tag_id,
          saidas (
            id,
            data_compra,
            created_at,
            categoria,
            descricao,
            valor_total
          )
        `)
        .eq("conta_tag_id", tag.id);

      const usos = (usosData || [])
        .filter((item) => item.saidas)
        .map((item) => ({
          id: `uso-${item.id}`,
          tipo: "uso",
          data: item.saidas.data_compra,
          created_at: item.saidas.created_at,
          titulo: item.saidas.categoria || "Uso da TAG",
          descricao: item.saidas.descricao || "Uso da TAG",
          valor: Number(item.saidas.valor_total || 0),
        }));

      const { data: recargasData } = await supabase
        .from("entradas_avulsas")
        .select("id, data, created_at, valor, descricao")
        .eq("conta_id", tag.id);

      const recargas = (recargasData || []).map((item) => ({
        id: `recarga-${item.id}`,
        tipo: "recarga",
        data: item.data,
        created_at: item.created_at,
        titulo: "Recarga da TAG",
        descricao: item.descricao || "Recarga da TAG",
        valor: Number(item.valor || 0),
      }));

      const lista = [...usos, ...recargas]
        .sort((a, b) => {
          const dataA = new Date(a.created_at || a.data || 0).getTime();
          const dataB = new Date(b.created_at || b.data || 0).getTime();
          return dataB - dataA;
        })
        .slice(0, 10);

      setMovimentacoes(lista);
    } catch (error) {
      console.error(error);
      setMovimentacoes([]);
    } finally {
      setCarregandoMovimentacoes(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">TAG do veículo</h2>
            <p className="text-gray-400 mt-2">Resumo, saldo e últimas movimentações da TAG.</p>
          </div>

          <button
            type="button"
            onClick={fechar}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            <FiX className="w-5 h-5 mx-auto" />
          </button>
        </div>

        <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold px-3 py-1">
                <FiTag className="w-3 h-3" /> TAG no vidro • {prePaga ? "Pré-paga" : "Pós-paga"}
              </span>
              <h3 className="text-xl font-black text-white mt-3">{tag.nome}</h3>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400">Saldo da TAG</p>
              <strong className={`text-3xl font-black ${saldo < 0 ? "text-red-400" : "text-green-400"}`}>
                {formatarMoeda(saldo)}
              </strong>
            </div>
          </div>

          {prePaga && tag.recarga_automatica && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-800 pt-4">
              <MiniInfoTag titulo="Recarga" valor={formatarMoeda(valorRecarga)} />
              <MiniInfoTag titulo="Ao atingir" valor={formatarMoeda(gatilho)} />
              <MiniInfoTag titulo="Recarga automática em:" valor={textoFormaRecarga()} />
            </div>
          )}
        </div>

        {precisaRecarga && (
          <button
            type="button"
            onClick={() => {
              fechar();
              recarregar();
            }}
            className="mt-4 w-full text-left bg-red-500/10 border border-red-500/40 hover:bg-red-500/15 rounded-2xl p-4 transition"
          >
            <p className="font-bold text-red-400">Recarga necessária</p>
            <p className="text-sm text-gray-300 mt-1">
              O saldo está em {formatarMoeda(saldo)}. Toque para registrar uma recarga agora.
            </p>
          </button>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Últimas movimentações</h3>
            <span className="text-xs text-gray-500">até 10 registros</span>
          </div>

          <div className="mt-3 space-y-2">
            {carregandoMovimentacoes && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4 text-gray-400 text-sm">
                Carregando movimentações...
              </div>
            )}

            {!carregandoMovimentacoes && movimentacoes.length === 0 && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4 text-gray-400 text-sm">
                Nenhuma movimentação encontrada para esta TAG.
              </div>
            )}

            {!carregandoMovimentacoes && movimentacoes.map((movimento) => {
              const recarga = movimento.tipo === "recarga";

              return (
                <div
                  key={movimento.id}
                  className="bg-[#0B1120] border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{formatarDataBR(movimento.data)}</p>
                    <p className="font-bold text-white truncate">
                      {recarga ? <FiArrowUp className="inline w-3 h-3 mr-1" /> : <FiArrowDown className="inline w-3 h-3 mr-1" />}{movimento.titulo}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{movimento.descricao}</p>
                  </div>

                  <p className={`font-black shrink-0 ${recarga ? "text-green-400" : "text-red-400"}`}>
                    {recarga ? "+" : "-"} {formatarMoeda(movimento.valor)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={fechar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={() => configurar(tag)}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Configurar TAG
          </button>
        </div>
      </div>
    </div>
  );
}


function ProtecaoVeiculoCard({ protecao, formatarMoeda }) {
  const inicio = formatarDataBRLocal(protecao.inicio_vigencia);
  const fim = formatarDataBRLocal(protecao.fim_vigencia);
  const pagas = Number(protecao.parcelas_pagas || 0);
  const total = Number(protecao.numero_parcelas || 1);
  const restantes = Math.max(total - pagas, 0);
  const nomeTipo = protecao.tipo_protecao === "protecao_veicular" ? "Proteção veicular" : "Seguro";

  return (
    <div className="mt-8 bg-[#111827] border border-purple-500/30 rounded-2xl p-6">
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


function ConfigurarTagModal({
  aberto,
  tag,
  contasBanco,
  cartoes,
  formatarMoedaDigitada,
  numeroParaMoedaInput,
  onClose,
  onSalvar,
}) {
  const [nome, setNome] = useState("");
  const [tipoTag, setTipoTag] = useState("pre_paga");
  const [recargaAutomatica, setRecargaAutomatica] = useState(false);
  const [valorRecarga, setValorRecarga] = useState("");
  const [percentualGatilho, setPercentualGatilho] = useState("30");
  const [formaRecarga, setFormaRecarga] = useState("credito_avista");
  const [contaRecargaId, setContaRecargaId] = useState("");
  const [cartaoRecargaId, setCartaoRecargaId] = useState("");
  const [modalFormaAberto, setModalFormaAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const formasRecarga = [
    { valor: "credito_avista", titulo: "Crédito à vista", descricao: "Recarga lançada no cartão de crédito" },
    { valor: "debito", titulo: "Débito", descricao: "Recarga debitada de uma conta bancária" },
    { valor: "pix", titulo: "Pix", descricao: "Recarga paga via Pix por uma conta bancária" },
  ];

  useEffect(() => {
    if (!aberto || !tag) return;

    setNome(tag.nome || "");
    setTipoTag(tag.tipo_tag || "pre_paga");
    setRecargaAutomatica(Boolean(tag.recarga_automatica));
    setValorRecarga(
      tag.valor_recarga_automatica
        ? numeroParaMoedaInput(tag.valor_recarga_automatica)
        : ""
    );
    setPercentualGatilho(String(tag.percentual_alerta_recarga || 30));
    setFormaRecarga(tag.tag_forma_recarga || "credito_avista");
    setContaRecargaId(tag.tag_conta_recarga_id ? String(tag.tag_conta_recarga_id) : "");
    setCartaoRecargaId(tag.tag_cartao_recarga_id ? String(tag.tag_cartao_recarga_id) : "");
    setModalFormaAberto(false);
    setModalContaAberto(false);
    setModalCartaoAberto(false);
    setErros({});
  }, [aberto, tag, numeroParaMoedaInput]);

  function textoForma(valor) {
    return formasRecarga.find((item) => item.valor === valor)?.titulo || "Selecionar forma";
  }

  function textoConta(id) {
    return contasBanco.find((conta) => String(conta.id) === String(id))?.nome || "Selecionar conta";
  }

  function textoCartao(id) {
    const cartao = cartoes.find((item) => String(item.id) === String(id));
    if (!cartao) return "Selecionar cartão";
    return nomeCartaoComFinal(cartao);
  }

  function formatarMoedaLocal(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function moedaParaNumeroLocal(valor) {
    return Number(String(valor || "0").replace(/\./g, "").replace(",", ".")) || 0;
  }

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

  function salvar() {
    const novos = {};
    if (!nome.trim()) novos.nome = "Digite o nome da TAG.";
    if (tipoTag === "pre_paga" && recargaAutomatica) {
      if (moedaParaNumeroLocal(valorRecarga) <= 0) novos.valorRecarga = "Informe o valor da recarga automática.";
      if (formaRecarga === "credito_avista" && !cartaoRecargaId) novos.cartaoRecargaId = "Escolha o cartão usado na recarga.";
      if (["debito", "pix"].includes(formaRecarga) && !contaRecargaId) novos.contaRecargaId = "Escolha a conta usada na recarga.";
    }
    setErros(novos);
    if (Object.keys(novos).length) {
      setShakeKey(Date.now());
      return;
    }
    onSalvar({
      nome,
      tipo_tag: tipoTag,
      recarga_automatica: recargaAutomatica,
      valor_recarga_automatica: valorRecarga,
      percentual_alerta_recarga: percentualGatilho,
      tag_forma_recarga: formaRecarga,
      tag_conta_recarga_id: contaRecargaId,
      tag_cartao_recarga_id: cartaoRecargaId,
    });
  }

  if (!aberto || !tag) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Configurar TAG"
        descricao="Altere apenas a TAG vinculada ao veículo."
        onClose={onClose}
        largura="max-w-lg"
        z="z-[70]"
      >

          <div key={erros.nome ? shakeKey : "ok"} className={`mt-6 ${erros.nome ? "animate-shake" : ""}`}>
            <label className={erros.nome ? "text-sm text-red-400" : "text-sm text-gray-300"}>Nome da TAG</label>
            <input
              type="text"
              value={nome}
              placeholder="Ex: Veloe"
              onChange={(e) => { limparErro("nome"); setNome(e.target.value); }}
              className={`w-full mt-2 bg-[#0B1120] border ${erros.nome ? "border-red-500" : "border-gray-700 focus:border-green-400"} rounded-xl p-3 outline-none`}
            />
            {erros.nome && <p className="mt-1 text-xs text-red-400">{erros.nome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              onClick={() => setTipoTag("pre_paga")}
              className={`rounded-xl border p-3 font-bold ${
                tipoTag === "pre_paga"
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 text-gray-300 hover:bg-white/5"
              }`}
            >
              Pré-paga
            </button>

            <button
              type="button"
              onClick={() => {
                setTipoTag("pos_paga");
                setRecargaAutomatica(false);
              }}
              className={`rounded-xl border p-3 font-bold ${
                tipoTag === "pos_paga"
                  ? "border-green-400 bg-green-500/10 text-green-400"
                  : "border-gray-700 text-gray-300 hover:bg-white/5"
              }`}
            >
              Pós-paga
            </button>
          </div>

          {tipoTag === "pre_paga" && (
            <div className="mt-5 bg-[#0B1120] border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">Recarga semi-automática</p>
                  <p className="text-xs text-gray-400 mt-1">
                    O app sugere a recarga quando o uso da TAG atingir o gatilho.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRecargaAutomatica(!recargaAutomatica)}
                  className={`relative w-14 h-8 rounded-full transition ${
                    recargaAutomatica ? "bg-green-500" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition ${
                      recargaAutomatica ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {recargaAutomatica && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div key={erros.valorRecarga ? shakeKey : "ok"} className={erros.valorRecarga ? "animate-shake" : ""}>
                      <label className={erros.valorRecarga ? "text-sm text-red-400" : "text-sm text-gray-300"}>Valor da recarga</label>
                      <div className={`flex items-center mt-2 bg-[#111827] border ${erros.valorRecarga ? "border-red-500" : "border-gray-700"} rounded-xl overflow-hidden`}>
                        <span className="px-3 text-gray-400">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valorRecarga}
                          placeholder="30,00"
                          onChange={(e) => { limparErro("valorRecarga"); setValorRecarga(formatarMoedaDigitada(e.target.value)); }}
                          className="w-full bg-transparent p-3 outline-none"
                        />
                      </div>
                      {erros.valorRecarga && <p className="mt-1 text-xs text-red-400">{erros.valorRecarga}</p>}
                    </div>

                    <div>
                      <label className="text-sm text-gray-300">Gatilho (%)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={percentualGatilho}
                        placeholder="30"
                        onChange={(e) => setPercentualGatilho(String(e.target.value).replace(/\D/g, "").slice(0, 3))}
                        className="w-full mt-2 bg-[#111827] border border-gray-700 rounded-xl p-3 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300">Recarga automática em:</label>
                    <button
                      type="button"
                      onClick={() => setModalFormaAberto(true)}
                      className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                    >
                      {textoForma(formaRecarga)}
                    </button>
                  </div>

                  {formaRecarga === "credito_avista" ? (
                    <div key={erros.cartaoRecargaId ? shakeKey : "ok"} className={erros.cartaoRecargaId ? "animate-shake" : ""}>
                      <label className={erros.cartaoRecargaId ? "text-sm text-red-400" : "text-sm text-gray-300"}>Cartão vinculado</label>
                      <button
                        type="button"
                        onClick={() => setModalCartaoAberto(true)}
                        className={`w-full mt-2 bg-[#111827] border ${erros.cartaoRecargaId ? "border-red-500" : "border-gray-700 hover:border-green-400"} rounded-xl p-3 text-left font-semibold`}
                      >
                        {textoCartao(cartaoRecargaId)}
                      </button>
                      {erros.cartaoRecargaId && <p className="mt-1 text-xs text-red-400">{erros.cartaoRecargaId}</p>}
                    </div>
                  ) : (
                    <div key={erros.contaRecargaId ? shakeKey : "ok"} className={erros.contaRecargaId ? "animate-shake" : ""}>
                      <label className={erros.contaRecargaId ? "text-sm text-red-400" : "text-sm text-gray-300"}>Conta vinculada</label>
                      <button
                        type="button"
                        onClick={() => setModalContaAberto(true)}
                        className={`w-full mt-2 bg-[#111827] border ${erros.contaRecargaId ? "border-red-500" : "border-gray-700 hover:border-green-400"} rounded-xl p-3 text-left font-semibold`}
                      >
                        {textoConta(contaRecargaId)}
                      </button>
                      {erros.contaRecargaId && <p className="mt-1 text-xs text-red-400">{erros.contaRecargaId}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 grid grid-cols-2 gap-4 mt-6 bg-[#111827]">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvar}
              className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Salvar TAG
            </button>
          </div>
      </ModalBase>

      <SelecionarFormaPagamentoModal
        aberto={modalFormaAberto}
        formasPagamento={formasRecarga}
        formaPagamento={formaRecarga}
        onSelecionar={(valor) => {
          setFormaRecarga(valor);
          if (valor === "credito_avista") setContaRecargaId("");
          else setCartaoRecargaId("");
        }}
        onClose={() => setModalFormaAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasBanco}
        contaId={contaRecargaId}
        onSelecionar={(valor) => { limparErro("contaRecargaId"); setContaRecargaId(valor); }}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoedaLocal}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoRecargaId}
        onSelecionar={(valor) => { limparErro("cartaoRecargaId"); setCartaoRecargaId(valor); }}
        onClose={() => setModalCartaoAberto(false)}
        formatarMoeda={formatarMoedaLocal}
      />
    </>
  );
}

function ListaDashboardVeiculo({ itens, formatarMoeda, vazio }) {
  if (!itens.length) return <p className="text-sm text-gray-400">{vazio}</p>;
  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-800 bg-[#0B1120] p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{formatarDataBRLocal(item.data)}</p>
            <p className="font-bold text-white mt-1">{item.tipo}</p>
            <p className="text-sm text-gray-400 truncate">{item.descricao || "Sem descrição"}</p>
          </div>
          <p className="font-black text-white shrink-0">{item.valor == null ? "-" : formatarMoeda(item.valor)}</p>
        </div>
      ))}
    </div>
  );
}

function ResumoCard({ titulo, valor, pequeno }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4 sm:p-5 min-w-0">
      <p className="text-sm text-gray-400">{titulo}</p>
      <p className={`${pequeno ? "text-lg sm:text-xl" : "text-2xl"} font-bold mt-2 leading-tight break-words`}>{valor}</p>
    </div>
  );
}

function MiniCard({ titulo, valor }) {
  return (
    <div className="border border-gray-800 rounded-xl p-3 min-w-0">
      <p className="text-xs text-gray-500 leading-snug">{titulo}</p>
      <p className="text-sm font-bold mt-1 leading-tight break-words">{valor}</p>
    </div>
  );
}

function InputTexto({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3"
      />
    </div>
  );
}

function CampoMoeda({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      <div className="flex items-center mt-2 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden">
        <span className="px-3 text-gray-400">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent p-3 outline-none"
        />
      </div>
    </div>
  );
}

function ModalConfirmacao({ titulo, texto, subtitulo, cancelar, confirmar, textoConfirmar, cor }) {
  const corBotao = cor === "red" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-black";
  const corTitulo = cor === "red" ? "text-red-400" : "text-green-400";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <h2 className={`text-2xl font-bold ${corTitulo}`}>{titulo}</h2>
        <p className="text-gray-300 mt-4">{texto}</p>
        {subtitulo && <p className="text-gray-500 text-sm mt-2">{subtitulo}</p>}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button type="button" onClick={cancelar} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className={`${corBotao} font-bold rounded-xl p-3`}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
