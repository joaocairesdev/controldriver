import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../services/supabase";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";

import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
  somenteNumeros,
} from "../../../shared/utils/moeda";

import {
  hojeBrasil,
  formatarDataBR,
} from "../../../shared/utils/data";

import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import SelecionarVeiculoModal from "../../../shared/components/modals/SelecionarVeiculoModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarCombustivelModal from "./SelecionarCombustivelModal";
import SelecionarParcelasModal from "../../../shared/components/modals/SelecionarParcelasModal";
import {
  calcularUsoELimiteCartao,
  gerarParcelasEFaturasPadrao,
  nomeCartaoComFinal,
  recalcularFaturaPorParcelas as recalcularFaturaPorParcelasCompartilhada,
  removerParcelasDaSaidaERecalcularFaturas,
} from "../../cartoes/utils/cartoesUtils";
import { FORMA_PAGAMENTO_DEBITO_CONTA } from "../../../shared/constants/formasPagamento";
import {
  localizarAbastecimentosVizinhos,
  validarCrescimentoOdometro,
} from "../utils/abastecimentosCronologia";

const COMBUSTIVEIS = [
  { valor: "etanol", titulo: "Etanol" },
  { valor: "etanol_aditivado", titulo: "Etanol aditivado" },
  { valor: "gasolina_comum", titulo: "Gasolina comum" },
  { valor: "gasolina_aditivada", titulo: "Gasolina aditivada" },
  { valor: "gasolina_podium", titulo: "Gasolina Podium" },
  { valor: "gnv", titulo: "GNV" },
  { valor: "diesel", titulo: "Diesel" },
];

export default function AbastecimentoModal({ aberto, onClose, veiculosPermitidos = null, edicao = null, onSalvo = null }) {
  const hoje = hojeBrasil();

  const formasPagamento = [
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Sai da carteira" },
    { valor: "pix", titulo: "Pix", descricao: "Sai direto da conta" },
    { valor: "debito", titulo: "Débito", descricao: "Sai direto da conta" },
    FORMA_PAGAMENTO_DEBITO_CONTA,
    { valor: "credito_avista", titulo: "Crédito à Vista", descricao: "Entra na próxima fatura do cartão" },
    { valor: "credito_parcelado", titulo: "Crédito Parcelado", descricao: "Divide em 2x ou mais no cartão" },
    { valor: "boleto", titulo: "Boleto", descricao: "Registra uma conta a pagar" },
  ];

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);

  const [dataCompra, setDataCompra] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [dataVencimento, setDataVencimento] = useState(hoje);
  const [valorTotal, setValorTotal] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("1");
  const [valorParcela, setValorParcela] = useState("");
  const [ultimoCampoEditado, setUltimoCampoEditado] = useState("total");

  const [veiculoId, setVeiculoId] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [valorLitro, setValorLitro] = useState("");
  const [kmRodados, setKmRodados] = useState("");
  const [odometro, setOdometro] = useState("");
  const [tanqueCheio, setTanqueCheio] = useState(true);

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVencimentoAberto, setModalVencimentoAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [modalVeiculoAberto, setModalVeiculoAberto] = useState(false);
  const [modalCombustivelAberto, setModalCombustivelAberto] = useState(false);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const isCredito = formaPagamento === "credito_avista" || formaPagamento === "credito_parcelado";
  const isCreditoParcelado = formaPagamento === "credito_parcelado";
  const isBoleto = formaPagamento === "boleto";
  const isDinheiro = formaPagamento === "dinheiro";

  const veiculoSelecionado = useMemo(() => veiculos.find((v) => String(v.id) === String(veiculoId)), [veiculos, veiculoId]);
  const contaSelecionada = useMemo(() => contas.find((c) => String(c.id) === String(contaId)), [contas, contaId]);
  const carteiraSelecionada = useMemo(() => contas.find((c) => c.tipo_conta === "carteira"), [contas]);
  const contasBancarias = useMemo(() => contas.filter((c) => (c.tipo_conta || "banco") === "banco"), [contas]);
  const cartaoSelecionado = useMemo(() => cartoes.find((c) => String(c.id) === String(cartaoId)), [cartoes, cartaoId]);

  const combustiveisDisponiveis = useMemo(() => {
    const aceitos = veiculoSelecionado?.combustiveis_aceitos;

    if (Array.isArray(aceitos) && aceitos.length > 0) {
      return COMBUSTIVEIS.filter((combustivel) => aceitos.includes(combustivel.valor));
    }

    return COMBUSTIVEIS;
  }, [veiculoSelecionado]);

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
    if (!edicao) limparFormulario(false);
  }, [aberto, veiculosPermitidos, edicao?.id]);

  useEffect(() => {
    if (!aberto || !edicao?.id || !edicao?.abastecimento) return;
    const a = edicao.abastecimento;
    setDataCompra(edicao.data_compra || hoje);
    setDataVencimento(edicao.data_vencimento || edicao.data_compra || hoje);
    setFormaPagamento(edicao.forma_pagamento || "pix");
    setContaId(edicao.conta_id ? String(edicao.conta_id) : "");
    setCartaoId(edicao.cartao_id ? String(edicao.cartao_id) : "");
    setValorTotal(numeroParaMoedaInput(edicao.valor_total || 0));
    setNumeroParcelas(String(edicao.numero_parcelas || 1));
    setValorParcela(numeroParaMoedaInput(edicao.valor_parcela || edicao.valor_total || 0));
    setVeiculoId(a.veiculo_id ? String(a.veiculo_id) : "");
    setTipoCombustivel(a.tipo_combustivel || "etanol");
    setValorLitro(numeroParaMoedaInput(a.valor_litro || 0));
    setKmRodados(String(Number(a.km_rodados || a.km_total_periodo || 0)));
    setOdometro(String(Number(a.odometro || 0)));
    setTanqueCheio(a.tanque_cheio ?? true);
  }, [aberto, edicao?.id, edicao?.abastecimento?.id]);

  useEffect(() => {
    if (isDinheiro && carteiraSelecionada) {
      setContaId(String(carteiraSelecionada.id));
      setCartaoId("");
    }
  }, [isDinheiro, carteiraSelecionada]);

  useEffect(() => {
    if (!veiculoSelecionado) return;

    const aceitos = veiculoSelecionado.combustiveis_aceitos || [];

    if (!aceitos.includes(tipoCombustivel)) {
      setTipoCombustivel(aceitos.length === 1 ? aceitos[0] : "");
    }
  }, [veiculoSelecionado, tipoCombustivel]);

  useEffect(() => {
    if (!isCreditoParcelado) return;
    const total = moedaParaNumero(valorTotal);
    const parcelas = Number(numeroParcelas || 1);
    if (ultimoCampoEditado === "total" && total > 0 && parcelas > 0) {
      setValorParcela(numeroParaMoedaInput(total / parcelas));
    }
  }, [valorTotal, numeroParcelas, isCreditoParcelado, ultimoCampoEditado]);

  useEffect(() => {
    if (!isCreditoParcelado) return;
    const parcela = moedaParaNumero(valorParcela);
    const parcelas = Number(numeroParcelas || 1);
    if (ultimoCampoEditado === "parcela" && parcela > 0 && parcelas > 0) {
      setValorTotal(numeroParaMoedaInput(parcela * parcelas));
    }
  }, [valorParcela, numeroParcelas, isCreditoParcelado, ultimoCampoEditado]);

  async function carregarContasComSaldo(contasBase) {
    return Promise.all((contasBase || []).map(async (conta) => {
      const contaIdAtual = conta.id;
      const { data: entradas } = await supabase.from("entradas").select(`entrada_plataformas (faturamento, valor_reembolso)`).eq("conta_id", contaIdAtual);
      const totalEntradas = (entradas || []).reduce((total, entrada) => total + (entrada.entrada_plataformas || []).reduce((soma, item) => soma + Number(item.faturamento || 0) + Number(item.valor_reembolso || 0), 0), 0);
      const { data: entradasAvulsas } = await supabase.from("entradas_avulsas").select("valor").eq("conta_id", contaIdAtual);
      const totalEntradasAvulsas = (entradasAvulsas || []).reduce((t, e) => t + Number(e.valor || 0), 0);
      const { data: recebidas } = await supabase.from("transferencias").select("valor").eq("conta_destino_id", contaIdAtual);
      const totalRecebidas = (recebidas || []).reduce((t, e) => t + Number(e.valor || 0), 0);
      const { data: enviadas } = await supabase.from("transferencias").select("valor").eq("conta_origem_id", contaIdAtual);
      const totalEnviadas = (enviadas || []).reduce((t, e) => t + Number(e.valor || 0), 0);
      const { data: saidas } = await supabase.from("saidas").select("valor_total, tipo_movimentacao").eq("conta_id", contaIdAtual);
      const totalSaidas = (saidas || []).filter((s) => s.tipo_movimentacao !== "conta_pagar").reduce((t, s) => t + Number(s.valor_total || 0), 0);
      return { ...conta, tipo_conta: conta.tipo_conta || "banco", saldo_atual: Number(conta.saldo_inicial || 0) + totalEntradas + totalEntradasAvulsas + totalRecebidas - totalSaidas - totalEnviadas };
    }));
  }

  async function carregarDados() {
    const { data: contasData } = await supabase.from("contas").select("*").eq("ativo", true).order("id");
    const { data: cartoesData } = await supabase.from("cartoes").select("*").eq("ativo", true).order("id");
    const { data: veiculosData } = await supabase.from("veiculos").select("*").eq("ativo", true).order("id");
    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);
    setContas(contasComSaldo);
    setCartoes(cartoesComUso);
    setVeiculos(veiculosPermitidos || veiculosData || []);
    const carteira = contasComSaldo.find((c) => c.tipo_conta === "carteira");
    const contasValidas = contasComSaldo.filter((c) => (c.tipo_conta || "banco") === "banco");
    const listaVeiculos = veiculosPermitidos || veiculosData || [];
    if (formaPagamento === "dinheiro" && carteira) setContaId(String(carteira.id));
    else setContaId(contasValidas.length === 1 ? String(contasValidas[0].id) : "");
    setCartaoId(cartoesComUso.length === 1 ? String(cartoesComUso[0].id) : "");
    setVeiculoId(listaVeiculos.length === 1 ? String(listaVeiculos[0].id) : "");
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];
    const ids = listaCartoes.map((c) => c.id);
    const { data: faturasData } = await supabase.from("faturas_cartao").select("cartao_id, valor_total, valor_pago, status").in("cartao_id", ids).in("status", ["aberta", "fechada", "parcial"]);
    return listaCartoes.map((cartao) => ({ ...cartao, usado: calcularUsoELimiteCartao((faturasData || []).filter((f) => Number(f.cartao_id) === Number(cartao.id)), cartao.limite_total).usado }));
  }

  function limparFormulario(limparTudo = true) {
    setDataCompra(hoje); setDataVencimento(hoje); setFormaPagamento(""); setValorTotal(""); setNumeroParcelas("1"); setValorParcela(""); setUltimoCampoEditado("total");
    setValorLitro(""); setKmRodados(""); setOdometro(""); setTanqueCheio(true); setTipoCombustivel(""); setCartaoId("");
    if (limparTudo) { setContaId(""); setVeiculoId(""); }
  }

  function numeroParaDecimalInput(valor, casas = 2) { if (!Number.isFinite(Number(valor))) return ""; return Number(valor || 0).toFixed(casas).replace(".", ","); }

  function textoFormaPagamento() { return formasPagamento.find((f) => f.valor === formaPagamento)?.titulo || "Selecionar"; }
  function textoContaCartao() {
    if (isCredito) return cartaoSelecionado ? nomeCartaoComFinal(cartaoSelecionado) : "Selecionar cartão";
    if (isDinheiro) return carteiraSelecionada?.nome || "Carteira";
    return contaSelecionada?.nome || "Selecionar conta";
  }
  function textoCombustivel() { return COMBUSTIVEIS.find((c) => c.valor === tipoCombustivel)?.titulo || "Selecionar"; }
  function litrosCalculados() { const total = moedaParaNumero(valorTotal); const litro = moedaParaNumero(valorLitro); return total > 0 && litro > 0 ? total / litro : 0; }
  function consumoCalculado() { const km = Number(kmRodados || 0); const litros = litrosCalculados(); return km > 0 && litros > 0 ? km / litros : 0; }

  function atualizarValorTotal(valor) { setUltimoCampoEditado("total"); setValorTotal(formatarMoedaDigitada(valor)); }
  function atualizarOdometro(valor) {
    setOdometro(somenteNumeros(valor));
    setKmRodados("");
  }
  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) { setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois }); }
  function limparErro(campo) { setErros((atuais) => { if (!atuais[campo]) return atuais; const novos = { ...atuais }; delete novos[campo]; return novos; }); }
  async function fecharFeedback() {
    const fechar = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      fecharDepois: false,
    });

    if (fechar) {
      if (edicao?.id) await onSalvo?.();
      limparFormulario(false);
      onClose?.();
    }
  }

  function definirContaBancariaPadrao() { setContaId(contasBancarias.length === 1 ? String(contasBancarias[0].id) : ""); }
  function definirStatus() { if (isBoleto) return "aberto"; if (isCredito) return "fatura"; return "pago"; }
  function definirTipoMovimentacao() { if (isBoleto) return "conta_pagar"; return "saida"; }
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

  async function ajustarFaturasAoRemoverParcelasDaSaida(saidaId) {
    return removerParcelasDaSaidaERecalcularFaturas(supabase, saidaId);
  }

  async function gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas) { if (!isCredito || !cartaoSelecionado) return; return gerarParcelasEFaturasPadrao(supabase, { saidaId, cartao: cartaoSelecionado, cartaoId, dataBase: dataCompra, quantidadeParcelas: parcelas, valorParcela: parcelaValor, recalcularAoFinal: () => recalcularFaturasDaSaida(saidaId) }); }

  async function verificarLimiteCartao(total) {
    if (!cartaoSelecionado) return true;
    const { data, error } = await supabase.from("faturas_cartao").select("valor_total, valor_pago, status").eq("cartao_id", Number(cartaoId)).in("status", ["aberta", "fechada", "parcial"]);
    if (error) throw error;
    const { limite, disponivel } = calcularUsoELimiteCartao(data, cartaoSelecionado.limite_total);
    if (limite > 0 && total > disponivel) return window.confirm("⚠ Esta compra ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?");
    return true;
  }

  function validar() {
    const novos = {};
    if (!dataCompra) novos.dataCompra = "Selecione a data da compra.";
    if (!formaPagamento) novos.formaPagamento = "Selecione a forma de pagamento.";
    if (!veiculoId) novos.veiculoId = "Selecione o veículo.";
    if (!tipoCombustivel) novos.tipoCombustivel = "Selecione o combustível.";
    if (moedaParaNumero(valorTotal) <= 0) novos.valorTotal = "Informe o valor total.";
    if (moedaParaNumero(valorLitro) <= 0) novos.valorLitro = "Informe o valor do litro.";
    if (isCredito && !cartaoId) novos.cartaoId = "Selecione um cartão.";
    if (isDinheiro && !carteiraSelecionada) { abrirFeedback("erro", "Carteira não encontrada", "Cadastre uma carteira antes de lançar dinheiro."); return false; }
    if (!isCredito && !isBoleto && !contaId) novos.contaId = "Selecione uma conta.";
    if (isBoleto && !dataVencimento) novos.dataVencimento = "Informe a data de vencimento.";
    if (isCreditoParcelado && Number(numeroParcelas || 0) < 2) { abrirFeedback("erro", "Parcelamento inválido", "Crédito parcelado precisa começar em 2x."); return false; }
    if (!odometro) novos.km = "Informe o odômetro.";
    setErros(novos); if (Object.keys(novos).length) setShakeKey(Date.now());
    return Object.keys(novos).length === 0;
  }

  async function validarSequenciaOdometro() {
    const { data: historico, error } = await supabase
      .from("saidas_abastecimentos")
      .select("id, saida_id, odometro, saidas!inner(data_compra)")
      .eq("veiculo_id", Number(veiculoId));

    if (error) throw error;

    const abastecimentoEditado = edicao?.abastecimento || null;
    const lancamento = {
      id: abastecimentoEditado?.id || Number.MAX_SAFE_INTEGER,
      data_compra: dataCompra,
      odometro: Number(odometro),
    };
    const vizinhos = localizarAbastecimentosVizinhos(
      historico,
      lancamento,
      abastecimentoEditado?.id || null
    );
    const resultado = validarCrescimentoOdometro(
      odometro,
      vizinhos.anterior,
      vizinhos.posterior
    );

    if (!resultado.valido) {
      let mensagem = "O odômetro deve respeitar a sequência cronológica dos abastecimentos.";

      if (resultado.valorAnterior !== null && resultado.valorPosterior !== null) {
        mensagem = `Informe um odômetro maior que ${resultado.valorAnterior.toLocaleString("pt-BR")} km e menor que ${resultado.valorPosterior.toLocaleString("pt-BR")} km.`;
      } else if (resultado.valorAnterior !== null) {
        mensagem = `Informe um odômetro maior que ${resultado.valorAnterior.toLocaleString("pt-BR")} km.`;
      } else if (resultado.valorPosterior !== null) {
        mensagem = `Informe um odômetro menor que ${resultado.valorPosterior.toLocaleString("pt-BR")} km.`;
      }

      setErros((atuais) => ({ ...atuais, km: mensagem }));
      setShakeKey(Date.now());
      return null;
    }

    return vizinhos;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      const vizinhos = await validarSequenciaOdometro();
      if (!vizinhos) return;

      const total = moedaParaNumero(valorTotal);
      const parcelas = isCreditoParcelado ? Number(numeroParcelas || 2) : 1;
      const parcelaValor = isCreditoParcelado ? moedaParaNumero(valorParcela) : total;
      if (isCredito && !(await verificarLimiteCartao(total))) return;

      const dadosSaida = { data_compra: dataCompra, forma_pagamento: formaPagamento, tipo_movimentacao: definirTipoMovimentacao(), conta_id: isCredito || isBoleto ? null : Number(contaId), cartao_id: isCredito ? Number(cartaoId) : null, tipo_credito: isCredito ? (isCreditoParcelado ? "parcelado" : "avista") : null, numero_parcelas: parcelas, valor_total: total, valor_parcela: parcelaValor, data_efetivacao: isBoleto ? null : dataCompra, data_vencimento: isBoleto ? dataVencimento : null, categoria: "Abastecimento", descricao: `Compra de combustível - ${veiculoSelecionado?.nome || "Veículo"}`, status: definirStatus() };
      let saidaId = edicao?.id || null;
      if (saidaId) {
        await ajustarFaturasAoRemoverParcelasDaSaida(saidaId);

        const { error: erroSaida } = await supabase.from("saidas").update(dadosSaida).eq("id", saidaId);
        if (erroSaida) throw erroSaida;

        if (isCredito) await gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas);

      } else {
        const { data: saidaCriada, error: erroSaida } = await supabase.from("saidas").insert(dadosSaida).select().single();
        if (erroSaida) throw erroSaida;
        saidaId = saidaCriada.id;
        if (isCredito) await gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas);
      }
      await salvarDetalhesAbastecimento(saidaId, vizinhos);
      abrirFeedback(
        "sucesso",
        edicao?.id ? "Abastecimento atualizado" : isBoleto ? "Conta registrada" : "Abastecimento registrado",
        isBoleto
          ? "Conta a pagar registrada com sucesso."
          : `${formatarMoeda(total)} lançados com sucesso para ${veiculoSelecionado?.nome || "o veículo"}.`,
        true
      );
      limparFormulario(false);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar abastecimento.");
    } finally { setSalvando(false); }
  }

  async function salvarDetalhesAbastecimento(saidaId, vizinhos) {
    const litros = litrosCalculados();
    const odometroFinal = Number(odometro || 0);
    const odometroAnterior = Number(
      vizinhos.anterior?.odometro ??
      veiculoSelecionado?.odometro_inicial ??
      veiculoSelecionado?.odometro_atual ??
      0
    );
    const kmPeriodo = Math.max(odometroFinal - odometroAnterior, 0);

    const consumoKmLitro = litros > 0 ? kmPeriodo / litros : 0;
    const custoPorKm = kmPeriodo > 0 ? moedaParaNumero(valorTotal) / kmPeriodo : 0;
    const dadosAbastecimento = { saida_id: saidaId, veiculo_id: Number(veiculoId), odometro: odometroFinal, km_rodados: kmPeriodo, km_total_periodo: kmPeriodo, tipo_combustivel: tipoCombustivel, litros, valor_litro: moedaParaNumero(valorLitro), tanque_cheio: tanqueCheio, uso: "automatico", percentual_trabalho: 0, consumo_km_l: consumoKmLitro, custo_por_km: custoPorKm, posto: null };
    const { error } = edicao?.abastecimento?.id
      ? await supabase
          .from("saidas_abastecimentos")
          .update(dadosAbastecimento)
          .eq("id", edicao.abastecimento.id)
      : await supabase.from("saidas_abastecimentos").insert(dadosAbastecimento);
    if (error) throw error;
    let campoMedia = null;
    if (tipoCombustivel === "etanol" || tipoCombustivel === "etanol_aditivado") campoMedia = "media_etanol";
    if (["gasolina_comum", "gasolina_aditivada", "gasolina_podium"].includes(tipoCombustivel)) campoMedia = "media_gasolina";
    if (tipoCombustivel === "gnv") campoMedia = "media_gnv";
    if (tipoCombustivel === "diesel") campoMedia = "media_diesel";
    if (campoMedia && consumoKmLitro > 0) await supabase.from("veiculos").update({ [campoMedia]: consumoKmLitro, custo_medio_km_combustivel: custoPorKm, custo_medio_km_geral: custoPorKm }).eq("id", Number(veiculoId));
    if (odometroFinal > Number(veiculoSelecionado?.odometro_atual || 0)) await supabase.from("veiculos").update({ odometro_atual: odometroFinal }).eq("id", Number(veiculoId));
  }

  if (!aberto) return null;

  return (
    <>
      <ModalBase aberto={aberto} titulo="Novo Abastecimento" descricao="Registre combustível e atualize o odômetro do veículo." onClose={onClose} largura="max-w-5xl" confirmarAoFecharSeAlterado>
        <div className="max-h-[72vh] overflow-y-auto pr-1 scrollbar-hide">
          <section className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Campo label="Data da compra" erro={erros.dataCompra} shakeKey={shakeKey}>
                <ButtonField erro={erros.dataCompra} shakeKey={shakeKey} onClick={() => setModalDataAberto(true)}>{formatarDataBR(dataCompra)}</ButtonField>
              </Campo>

              <Campo label="Forma de pagamento" erro={erros.formaPagamento} shakeKey={shakeKey}>
                <ButtonField erro={erros.formaPagamento} shakeKey={shakeKey} onClick={() => setModalPagamentoAberto(true)}>{textoFormaPagamento()}</ButtonField>
              </Campo>

              {!isBoleto && (
                <Campo label={isCredito ? "Cartão" : isDinheiro ? "Carteira" : "Conta"} erro={isCredito ? erros.cartaoId : erros.contaId} shakeKey={shakeKey}>
                  <ButtonField
                    erro={isCredito ? erros.cartaoId : erros.contaId}
                    shakeKey={shakeKey}
                    onClick={() => {
                      if (isDinheiro) return;
                      isCredito ? setModalCartaoAberto(true) : setModalContaAberto(true);
                    }}
                  >
                    {textoContaCartao()}
                  </ButtonField>
                </Campo>
              )}

              {isBoleto && (
                <Campo label="Vencimento do boleto" erro={erros.dataVencimento} shakeKey={shakeKey}>
                  <ButtonField erro={erros.dataVencimento} shakeKey={shakeKey} onClick={() => setModalVencimentoAberto(true)}>{formatarDataBR(dataVencimento)}</ButtonField>
                </Campo>
              )}

              <Campo label="Veículo" erro={erros.veiculoId} shakeKey={shakeKey}>
                <ButtonField erro={erros.veiculoId} shakeKey={shakeKey} onClick={() => setModalVeiculoAberto(true)}>{veiculoSelecionado?.nome || "Selecionar veículo"}</ButtonField>
              </Campo>

              <Campo label="Tipo de combustível" erro={erros.tipoCombustivel} shakeKey={shakeKey}>
                <ButtonField erro={erros.tipoCombustivel} shakeKey={shakeKey} onClick={() => setModalCombustivelAberto(true)}>{textoCombustivel()}</ButtonField>
              </Campo>

              <Campo label="Valor do litro" erro={erros.valorLitro} shakeKey={shakeKey}>
                <MoneyInput erro={erros.valorLitro} shakeKey={shakeKey} value={valorLitro} onChange={(v) => { limparErro("valorLitro"); setValorLitro(formatarMoedaDigitada(v)); }} prefix="R$" placeholder="" />
              </Campo>

              <Campo label="Valor total" erro={erros.valorTotal} shakeKey={shakeKey}>
                <MoneyInput erro={erros.valorTotal} shakeKey={shakeKey} value={valorTotal} onChange={(v) => { limparErro("valorTotal"); atualizarValorTotal(v); }} prefix="R$" placeholder="" />
              </Campo>

              {isCreditoParcelado && (
                <>
                  <Campo label="Quantidade de parcelas">
                    <ButtonField onClick={() => setModalParcelasAberto(true)}>{numeroParcelas}x</ButtonField>
                  </Campo>

                  <Campo label="Valor da parcela">
                    <MoneyInput
                      value={valorParcela}
                      onChange={(v) => {
                        setUltimoCampoEditado("parcela");
                        setValorParcela(formatarMoedaDigitada(v));
                      }}
                      prefix="R$"
                      placeholder=""
                    />
                  </Campo>
                </>
              )}

              <Campo label="Odômetro atual" erro={erros.km} shakeKey={shakeKey}>
                <MoneyInput erro={erros.km} shakeKey={shakeKey} value={odometro} onChange={(valor) => { limparErro("km"); atualizarOdometro(valor); }} suffix="km" placeholder="0" />
              </Campo>

              <Campo label="Completou o tanque?">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Toggle ativo={tanqueCheio} onClick={() => setTanqueCheio(true)}>Sim</Toggle>
                  <Toggle ativo={!tanqueCheio} onClick={() => setTanqueCheio(false)}>Não</Toggle>
                </div>
              </Campo>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <ResumoItem titulo="Litros calculados" valor={`${numeroParaDecimalInput(litrosCalculados(), 3)} L`} />
              <ResumoItem titulo="Consumo estimado" valor={consumoCalculado() > 0 ? `${numeroParaDecimalInput(consumoCalculado(), 2)} km/L` : "-"} />
              <ResumoItem titulo="Odômetro após abastecimento" valor={odometro ? `${Number(odometro).toLocaleString("pt-BR")} km` : "-"} />
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button type="button" onClick={onClose} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">{salvando ? "Salvando..." : "Salvar"}</button>
        </div>
      </ModalBase>

      <DatePickerModal aberto={modalDataAberto} valor={dataCompra} onChange={(valor) => { limparErro("dataCompra"); setDataCompra(valor); }} onClose={() => setModalDataAberto(false)} titulo="Selecionar data" descricao="Escolha a data da compra." />
      <DatePickerModal aberto={modalVencimentoAberto} valor={dataVencimento} onChange={(valor) => { limparErro("dataVencimento"); setDataVencimento(valor); }} onClose={() => setModalVencimentoAberto(false)} titulo="Vencimento do boleto" descricao="Escolha a data em que esta conta precisa ser paga." />
      <SelecionarFormaPagamentoModal aberto={modalPagamentoAberto} formasPagamento={formasPagamento} formaPagamento={formaPagamento} onSelecionar={(valor) => { limparErro("formaPagamento"); setFormaPagamento(valor); if (valor === "credito_parcelado") { setContaId(""); setNumeroParcelas((a) => Number(a || 0) < 2 ? "2" : a); } if (valor === "credito_avista") { setContaId(""); setNumeroParcelas("1"); setValorParcela(""); } if (valor === "boleto") { setContaId(""); setCartaoId(""); setNumeroParcelas("1"); setValorParcela(""); } if (valor === "dinheiro") { setCartaoId(""); setNumeroParcelas("1"); setValorParcela(""); if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id)); } if (!["credito_avista", "credito_parcelado", "boleto"].includes(valor)) { setCartaoId(""); setNumeroParcelas("1"); setValorParcela(""); if (valor !== "dinheiro") definirContaBancariaPadrao(); } }} onClose={() => setModalPagamentoAberto(false)} />
      <SelecionarContaModal aberto={modalContaAberto} contas={contasBancarias} contaId={contaId} onSelecionar={(valor) => { limparErro("contaId"); setContaId(valor); }} onClose={() => setModalContaAberto(false)} formatarMoeda={formatarMoeda} />
      <SelecionarCartaoModal aberto={modalCartaoAberto} cartoes={cartoes} cartaoId={cartaoId} onSelecionar={(valor) => { limparErro("cartaoId"); setCartaoId(valor); }} onClose={() => setModalCartaoAberto(false)} formatarMoeda={formatarMoeda} />
      <SelecionarVeiculoModal aberto={modalVeiculoAberto} veiculos={veiculos} veiculoId={veiculoId} onSelecionar={(valor) => { limparErro("veiculoId"); setVeiculoId(valor); }} onClose={() => setModalVeiculoAberto(false)} />
      <SelecionarCombustivelModal aberto={modalCombustivelAberto} combustiveis={combustiveisDisponiveis} tipoCombustivel={tipoCombustivel} onSelecionar={(valor) => { limparErro("tipoCombustivel"); setTipoCombustivel(valor); }} onClose={() => setModalCombustivelAberto(false)} />
      <SelecionarParcelasModal aberto={modalParcelasAberto} numeroParcelas={numeroParcelas} onSelecionar={setNumeroParcelas} onClose={() => setModalParcelasAberto(false)} />
      <FeedbackAbastecimentoModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </>
  );
}

function MoneyInput({ value, onChange, prefix, suffix, placeholder, erro, shakeKey }) { return <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden`}>{prefix && <span className="px-3 text-gray-400">{prefix}</span>}<input type="text" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent p-3 outline-none" />{suffix && <span className="px-3 text-gray-400">{suffix}</span>}</div>; }
function Toggle({ ativo, onClick, children }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-3 font-bold ${ativo ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 text-gray-300 hover:bg-white/5"}`}>{children}</button>; }
function ResumoItem({ titulo, valor }) { return <div className="bg-[#111827] border border-gray-800 rounded-xl p-4"><p className="text-xs text-gray-400">{titulo}</p><p className="text-xl font-bold mt-1">{valor}</p></div>; }


function FeedbackAbastecimentoModal({ aberto, tipo = "sucesso", titulo, mensagem, onClose }) {
  if (!aberto) return null;

  const isErro = tipo === "erro";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${
            isErro
              ? "text-red-400 bg-red-500/10"
              : "text-green-400 bg-green-500/10"
          }`}
        >
          {isErro ? "!" : "✓"}
        </div>

        <h2
          className={`text-2xl font-bold mt-5 ${
            isErro ? "text-red-400" : "text-green-400"
          }`}
        >
          {titulo}
        </h2>

        <p className="text-gray-300 mt-3">{mensagem}</p>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
