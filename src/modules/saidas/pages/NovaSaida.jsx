import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../services/supabase";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";

import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import SelecionarVeiculoModal from "../../../shared/components/modals/SelecionarVeiculoModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarCombustivelModal from "../../abastecimentos/components/SelecionarCombustivelModal";
import SelecionarCategoriaModal from "../../categorias/components/SelecionarCategoriaModal";
import SelecionarParcelasModal from "../../../shared/components/modals/SelecionarParcelasModal";
import { FORMA_PAGAMENTO_DEBITO_CONTA } from "../../../shared/constants/formasPagamento";
import {
  calcularUsoELimiteCartao,
  gerarParcelasEFaturasPadrao,
  nomeCartaoComFinal,
} from "../../cartoes/utils/cartoesUtils";

export default function NovaSaida({ categoriaInicial = "Saída", setPagina }) {
  const hoje = new Date().toISOString().split("T")[0];

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [categorias, setCategorias] = useState(
    categoriasPadrao.map((nome) => ({ id: null, nome }))
  );

  const [dataCompra, setDataCompra] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [dataVencimento, setDataVencimento] = useState(hoje);

  const [categoria, setCategoria] = useState(categoriaInicial);
  const [categoriaId, setCategoriaId] = useState(null);
  const [finalidade, setFinalidade] = useState("trabalho");
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  const [numeroParcelas, setNumeroParcelas] = useState("1");
  const [valorParcela, setValorParcela] = useState("");
  const [ultimoCampoEditado, setUltimoCampoEditado] = useState("total");

  const [veiculoId, setVeiculoId] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("etanol");
  const [valorLitro, setValorLitro] = useState("");
  const [modoKm, setModoKm] = useState("trip");
  const [kmRodados, setKmRodados] = useState("");
  const [odometro, setOdometro] = useState("");

  const [tipoManutencao, setTipoManutencao] = useState("");
  const [servico, setServico] = useState("");
  const [oficina, setOficina] = useState("");
  const [proximaRevisaoKm, setProximaRevisaoKm] = useState("");
  const [proximaRevisaoData, setProximaRevisaoData] = useState("");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVencimentoAberto, setModalVencimentoAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [modalVeiculoAberto, setModalVeiculoAberto] = useState(false);
  const [modalCombustivelAberto, setModalCombustivelAberto] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    voltarDepois: false,
  });

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  function limparErro(campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  const formasPagamento = [
    { valor: "dinheiro", titulo: "Dinheiro", descricao: "Pagamento em espécie / Carteira" },
    { valor: "pix", titulo: "Pix", descricao: "Sai direto da conta" },
    { valor: "debito", titulo: "Débito", descricao: "Sai direto da conta" },
    FORMA_PAGAMENTO_DEBITO_CONTA,
    { valor: "credito_avista", titulo: "Crédito à Vista", descricao: "Entra na próxima fatura do cartão" },
    { valor: "credito_parcelado", titulo: "Crédito Parcelado", descricao: "Divide em 2x ou mais no cartão" },
    { valor: "boleto", titulo: "Boleto", descricao: "Registra uma conta a pagar" },
  ];

  const combustiveis = [
    { valor: "etanol", titulo: "Etanol" },
    { valor: "etanol_aditivado", titulo: "Etanol aditivado" },
    { valor: "gasolina_comum", titulo: "Gasolina comum" },
    { valor: "gasolina_aditivada", titulo: "Gasolina aditivada" },
    { valor: "gasolina_podium", titulo: "Gasolina Podium" },
    { valor: "gnv", titulo: "GNV" },
    { valor: "diesel", titulo: "Diesel" },
  ];

  const categoriasPadrao = [
    "Saída",
    "Abastecimento",
    "Manutenção",
    "Pedágio",
    "Estacionamento",
    "Lavagem",
    "Seguro",
    "Financiamento",
    "Alimentação",
    "Multa",
    "Impostos",
    "Uso de TAG",
    "Outros",
  ];

  const veiculoSelecionado = useMemo(
    () => veiculos.find((veiculo) => String(veiculo.id) === String(veiculoId)),
    [veiculos, veiculoId]
  );

  const contaSelecionada = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaId)),
    [contas, contaId]
  );

  const carteiraSelecionada = useMemo(
    () => contas.find((conta) => conta.tipo_conta === "carteira"),
    [contas]
  );

  const contasBancarias = useMemo(
    () => contas.filter((conta) => (conta.tipo_conta || "banco") === "banco"),
    [contas]
  );

  const cartaoSelecionado = useMemo(
    () => cartoes.find((cartao) => String(cartao.id) === String(cartaoId)),
    [cartoes, cartaoId]
  );

  const categoriasNomes = useMemo(
    () => categorias.map((item) => item.nome).filter(Boolean),
    [categorias]
  );

  const categoriaSelecionada = useMemo(
    () => categorias.find((item) => item.nome === categoria),
    [categorias, categoria]
  );

  const isAbastecimento = categoria === "Abastecimento";
  const isManutencao = categoria === "Manutenção";
  const isManutencaoCompleta = categoriaInicial === "Manutenção" && categoria === "Manutenção";
  const isCredito = formaPagamento === "credito_avista" || formaPagamento === "credito_parcelado";
  const isCreditoParcelado = formaPagamento === "credito_parcelado";
  const isBoleto = formaPagamento === "boleto";
  const isDinheiro = formaPagamento === "dinheiro";

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (isDinheiro && carteiraSelecionada) {
      setContaId(String(carteiraSelecionada.id));
      setCartaoId("");
    }
  }, [isDinheiro, carteiraSelecionada]);

  useEffect(() => {
    setCategoria(categoriaInicial);
    setFinalidade("trabalho");
    const categoriaEncontrada = categorias.find(
      (item) => item.nome === categoriaInicial
    );
    setCategoriaId(categoriaEncontrada?.id || null);
  }, [categoriaInicial, categorias]);

  useEffect(() => {
    setCategoriaId(categoriaSelecionada?.id || null);
  }, [categoriaSelecionada]);

  useEffect(() => {
    if (!isAbastecimento) return;
    const nomeVeiculo = veiculoSelecionado?.nome || "Veículo";
    setDescricao(`Compra de combustível - ${nomeVeiculo}`);
  }, [isAbastecimento, veiculoSelecionado]);

  useEffect(() => {
    if (isCreditoParcelado) {
      const total = moedaParaNumero(valorTotal);
      const parcelas = Number(numeroParcelas || 1);
      if (
  ultimoCampoEditado === "total" &&
  total > 0 &&
  parcelas > 0
) {
        setValorParcela(numeroParaMoedaInput(total / parcelas));
      }
    }
  }, [valorTotal, numeroParcelas, isCreditoParcelado]);

  useEffect(() => {
  if (!isCreditoParcelado) return;

  const parcela = moedaParaNumero(valorParcela);
  const parcelas = Number(numeroParcelas || 1);

  if (
  ultimoCampoEditado === "parcela" &&
  parcela > 0 &&
  parcelas > 0
) {
    const totalCalculado = parcela * parcelas;

    const totalAtual = moedaParaNumero(valorTotal);

    if (Math.abs(totalCalculado - totalAtual) > 0.01) {
      setValorTotal(numeroParaMoedaInput(totalCalculado));
    }
  }
}, [valorParcela, numeroParcelas, isCreditoParcelado]);


  async function carregarContasComSaldo(contasBase) {
    return Promise.all(
      (contasBase || []).map(async (conta) => {
        const contaId = conta.id;

        const { data: entradas } = await supabase
          .from("entradas")
          .select(`
            entrada_plataformas (
              faturamento,
              valor_reembolso
            )
          `)
          .eq("conta_id", contaId);

        const totalEntradas = (entradas || []).reduce((total, entrada) => {
          const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
            (soma, item) =>
              soma +
              Number(item.faturamento || 0) +
              Number(item.valor_reembolso || 0),
            0
          );

          return total + totalPlataformas;
        }, 0);

        const { data: entradasAvulsas } = await supabase
          .from("entradas_avulsas")
          .select("valor")
          .eq("conta_id", contaId);

        const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
          (total, entrada) => total + Number(entrada.valor || 0),
          0
        );

        const { data: transferenciasRecebidas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_destino_id", contaId);

        const totalTransferenciasRecebidas = (
          transferenciasRecebidas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaId);

        const totalTransferenciasEnviadas = (
          transferenciasEnviadas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", contaId);

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

  async function carregarCategorias() {
    const fallback = categoriasPadrao.map((nome) => ({ id: null, nome }));

    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome, ativo, ordem")
      .eq("ativo", true)
      .eq("tipo", "saida")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar categorias:", error);
      setCategorias(fallback);
      return fallback;
    }

    const lista = (data || [])
      .map((item) => ({ id: item.id, nome: item.nome }))
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

    const { data: veiculosData } = await supabase
      .from("veiculos")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const categoriasData = await carregarCategorias();

    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);
    const contasComSaldo = await carregarContasComSaldo(contasData || []);

    setContas(contasComSaldo);
    setCartoes(cartoesComUso);
    setVeiculos(veiculosData || []);

    const categoriaEncontrada = categoriasData.find(
      (item) => item.nome === categoriaInicial
    );
    setCategoriaId(categoriaEncontrada?.id || null);

    const carteira = contasComSaldo.find((conta) => conta.tipo_conta === "carteira");
    const contaPrincipal = contasComSaldo.find((conta) => conta.principal);
    const veiculoPrincipal = (veiculosData || []).find((veiculo) => veiculo.principal);

    if (formaPagamento === "dinheiro" && carteira) setContaId(String(carteira.id));
    else if (contaPrincipal) setContaId(String(contaPrincipal.id));

    if (veiculoPrincipal) setVeiculoId(String(veiculoPrincipal.id));
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];

    const ids = listaCartoes.map((cartao) => cartao.id);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select("cartao_id, valor_total, valor_pago, status")
      .in("cartao_id", ids)
      .in("status", ["aberta", "fechada", "parcial"]);

    return listaCartoes.map((cartao) => {
      const faturasDoCartao = (faturasData || []).filter(
        (fatura) => Number(fatura.cartao_id) === Number(cartao.id)
      );
      const { usado } = calcularUsoELimiteCartao(
        faturasDoCartao,
        cartao.limite_total
      );

      return {
        ...cartao,
        usado,
      };
    });
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "";
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
    return String(valor)
      .replace(/[^\d,]/g, "")
      .replace(/,+/g, ",")
      .replace(/^,/, "")
      .replace(/(,\d{2}).+/, "$1");
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(",", "."));
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function numeroParaDecimalInput(valor, casas = 2) {
    if (!Number.isFinite(Number(valor))) return "";
    return Number(valor || 0).toFixed(casas).replace(".", ",");
  }

  function somenteNumeros(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function definirStatus() {
    if (isBoleto) return "aberto";
    if (isCredito) return "fatura";
    return "pago";
  }

  function definirTipoMovimentacao() {
    if (isBoleto) return "conta_pagar";
    return "saida";
  }

  function textoFormaPagamento() {
    return formasPagamento.find((item) => item.valor === formaPagamento)?.titulo || "Selecionar";
  }

  function textoContaCartao() {
    if (isCredito) {
      if (!cartaoSelecionado) return "Selecionar cartão";
      return nomeCartaoComFinal(cartaoSelecionado);
    }

    if (isDinheiro) {
      return carteiraSelecionada?.nome || "Carteira";
    }

    return contaSelecionada?.nome || "Selecionar conta";
  }

  function textoCombustivel() {
    return combustiveis.find((item) => item.valor === tipoCombustivel)?.titulo || "Selecionar";
  }

  function definirContaBancariaPadrao() {
    const contaPrincipal = contasBancarias.find((conta) => conta.principal);
    const contaPadrao = contaPrincipal || contasBancarias[0];

    if (contaPadrao) {
      setContaId(String(contaPadrao.id));
    }
  }

  function atualizarValorTotal(valor) {
  setUltimoCampoEditado("total");
  setValorTotal(formatarMoedaDigitada(valor));
}

  function selecionarCategoria(nomeCategoria) {
    const categoriaEncontrada = categorias.find(
      (item) => item.nome === nomeCategoria
    );

    setCategoria(nomeCategoria);
    setCategoriaId(categoriaEncontrada?.id || null);
  }

  function atualizarValorLitro(valor) {
    setValorLitro(formatarMoedaDigitada(valor));
  }

  function atualizarKmRodados(valor) {
    const km = somenteNumeros(valor);
    setKmRodados(km);

    if (modoKm === "trip" && veiculoSelecionado) {
      const odometroAtual = Number(veiculoSelecionado.odometro_atual || 0);
      setOdometro(String(odometroAtual + Number(km || 0)));
    }
  }

  function atualizarOdometro(valor) {
    const novoOdometroTexto = somenteNumeros(valor);
    setOdometro(novoOdometroTexto);

    if (modoKm === "odometro" && veiculoSelecionado) {
      const odometroAtual = Number(veiculoSelecionado.odometro_atual || 0);
      const novoOdometro = Number(novoOdometroTexto || 0);
      setKmRodados(String(Math.max(novoOdometro - odometroAtual, 0)));
    }
  }

  function litrosCalculados() {
    const total = moedaParaNumero(valorTotal);
    const litro = moedaParaNumero(valorLitro);

    if (total <= 0 || litro <= 0) return 0;

    return total / litro;
  }

  function consumoCalculado() {
    const km = Number(kmRodados || 0);
    const litros = litrosCalculados();

    if (km <= 0 || litros <= 0) return 0;

    return km / litros;
  }

  function abrirFeedback(tipo, titulo, mensagem, voltarDepois = false) {
    setFeedback({
      aberto: true,
      tipo,
      titulo,
      mensagem,
      voltarDepois,
    });
  }

  function fecharFeedback() {
    const deveVoltar = feedback.voltarDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      voltarDepois: false,
    });

    if (deveVoltar && setPagina) {
      setPagina("novo-lancamento");
    }
  }

  async function verificarLimiteCartao(total) {
    if (!cartaoSelecionado) return true;

    const { data: faturasAbertas, error: erroFaturas } = await supabase
      .from("faturas_cartao")
      .select("valor_total, valor_pago, status")
      .eq("cartao_id", Number(cartaoId))
      .in("status", ["aberta", "fechada", "parcial"]);

    if (erroFaturas) {
      console.error("Erro ao verificar limite do cartão:", erroFaturas);
      abrirFeedback("erro", "Erro no cartão", "Erro ao verificar limite do cartão.");
      return false;
    }

    const { limite, disponivel } = calcularUsoELimiteCartao(
      faturasAbertas,
      cartaoSelecionado.limite_total
    );

    if (limite > 0 && total > disponivel) {
      const passou = total - disponivel;

      return false;
    }

    return true;
  }

  async function gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas) {
    if (!isCredito || !cartaoSelecionado) return;

    return gerarParcelasEFaturasPadrao(supabase, {
      saidaId,
      cartao: cartaoSelecionado,
      cartaoId,
      dataBase: dataCompra,
      quantidadeParcelas: parcelas,
      valorParcela: parcelaValor,
    });
  }

  function validarCampos() {
    const novos = {};
    if (!dataCompra) novos.dataCompra = "Selecione a data da compra.";
    if (!categoria) novos.categoria = "Selecione a categoria.";
    if (moedaParaNumero(valorTotal) <= 0) novos.valorTotal = "Informe o valor total.";
    if (isCredito && !cartaoId) novos.cartaoId = "Selecione um cartão.";

    if (isDinheiro && !carteiraSelecionada) {
      abrirFeedback("erro", "Carteira não encontrada", "Cadastre uma conta do tipo Carteira antes de lançar pagamento em dinheiro.");
      return false;
    }

    if (!isCredito && !isBoleto && !contaId) novos.contaId = "Selecione uma conta.";
    if (isBoleto && !dataVencimento) novos.dataVencimento = "Informe a data de vencimento.";

    if (isCreditoParcelado && Number(numeroParcelas || 0) < 2) {
      novos.numeroParcelas = "Crédito parcelado precisa começar em 2x.";
    }

    if (isAbastecimento) {
      if (!veiculoId) novos.veiculoId = "Selecione o veículo.";
      if (moedaParaNumero(valorLitro) <= 0) novos.valorLitro = "Informe o valor do litro.";
      if (!kmRodados && !odometro) novos.km = "Informe o KM rodado ou o odômetro.";

      if (modoKm === "odometro" && veiculoSelecionado) {
        const odometroAtual = Number(veiculoSelecionado.odometro_atual || 0);
        const novoOdometro = Number(odometro || 0);

        if (novoOdometro < odometroAtual) {
          novos.km = `O odômetro não pode ser menor que ${odometroAtual.toLocaleString("pt-BR")} km.`;
        }
      }
    }
    setErros(novos);
    if (Object.keys(novos).length) setShakeKey(Date.now());
    return Object.keys(novos).length === 0;
  }

  async function salvarSaida() {
    if (!validarCampos()) return;

    const total = moedaParaNumero(valorTotal);
    const parcelas = isCreditoParcelado ? Number(numeroParcelas || 2) : 1;
    const parcelaValor = isCreditoParcelado ? moedaParaNumero(valorParcela) : total;

   if (isCredito) {
  const limiteOk = await verificarLimiteCartao(total);

  if (!limiteOk) {
    const continuar = window.confirm(
      "⚠ Esta compra ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?"
    );

    if (!continuar) return;
  }
}

    setSalvando(true);

    const { data: saidaCriada, error: erroSaida } = await supabase
      .from("saidas")
      .insert({
        data_compra: dataCompra,
        forma_pagamento: formaPagamento,
        tipo_movimentacao: definirTipoMovimentacao(),
        conta_id: isCredito || isBoleto ? null : Number(contaId),
        cartao_id: isCredito ? Number(cartaoId) : null,
        tipo_credito: isCredito ? (isCreditoParcelado ? "parcelado" : "avista") : null,
        numero_parcelas: parcelas,
        valor_total: total,
        valor_parcela: parcelaValor,
        data_efetivacao: isBoleto ? null : dataCompra,
        data_vencimento: isBoleto ? dataVencimento : null,
        categoria,
        categoria_id: categoriaId ? Number(categoriaId) : null,
        finalidade,
        descricao: isAbastecimento
          ? `Compra de combustível - ${veiculoSelecionado?.nome || "Veículo"}`
          : descricao,
        status: definirStatus(),
      })
      .select()
      .single();

    if (erroSaida) {
      console.error(erroSaida);
      abrirFeedback("erro", "Erro ao salvar", "Erro ao salvar saída. Confira a tabela saidas no Supabase.");
      setSalvando(false);
      return;
    }

    try {
      if (isCredito) {
        await gerarParcelasEFaturas(saidaCriada.id, total, parcelaValor, parcelas);
      }

      if (isAbastecimento) {
        await salvarDetalhesAbastecimento(saidaCriada.id);
      }

      if (isManutencaoCompleta) {
        await salvarDetalhesManutencao(saidaCriada.id);
      }

      abrirFeedback(
        "sucesso",
        isBoleto ? "Conta registrada" : isAbastecimento ? "Abastecimento salvo" : "Saída salva",
        isBoleto
          ? "Conta a pagar registrada com sucesso. Ela ainda não alterou o saldo."
          : isAbastecimento
          ? "Abastecimento lançado com sucesso."
          : "Lançamento salvo com sucesso.",
        true
      );
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao finalizar", error.message || "Erro ao finalizar lançamento.");
    }

    setSalvando(false);
  }

  async function salvarDetalhesAbastecimento(saidaId) {
    const litros = litrosCalculados();
    const odometroFinal = Number(odometro || 0);

    const abastecimentoAnterior = await supabase
      .from("saidas_abastecimentos")
      .select("*")
      .eq("veiculo_id", Number(veiculoId))
      .lt("odometro", odometroFinal)
      .order("odometro", { ascending: false })
      .limit(1)
      .maybeSingle();

    const odometroAnterior = abastecimentoAnterior.data?.odometro || 0;

    const kmPeriodo = Math.max(odometroFinal - odometroAnterior, 0);
    const consumoKmLitro = litros > 0 ? kmPeriodo / litros : 0;
    const custoPorKm = kmPeriodo > 0 ? moedaParaNumero(valorTotal) / kmPeriodo : 0;

    const { error: erroAbastecimento } = await supabase
      .from("saidas_abastecimentos")
      .insert({
        saida_id: saidaId,
        veiculo_id: Number(veiculoId),
        odometro: odometroFinal,
        km_rodados: Number(kmRodados || 0),
        km_total_periodo: kmPeriodo,
        tipo_combustivel: tipoCombustivel,
        litros,
        valor_litro: moedaParaNumero(valorLitro),
        uso: "automatico",
        percentual_trabalho: 0,
        consumo_km_l: consumoKmLitro,
        custo_por_km: custoPorKm,
        posto: null,
      });

    if (erroAbastecimento) throw erroAbastecimento;

    let campoMedia = null;

    if (tipoCombustivel === "etanol" || tipoCombustivel === "etanol_aditivado") {
      campoMedia = "media_etanol";
    }

    if (
      tipoCombustivel === "gasolina_comum" ||
      tipoCombustivel === "gasolina_aditivada" ||
      tipoCombustivel === "gasolina_podium"
    ) {
      campoMedia = "media_gasolina";
    }

    if (tipoCombustivel === "gnv") campoMedia = "media_gnv";
    if (tipoCombustivel === "diesel") campoMedia = "media_diesel";

    if (campoMedia && consumoKmLitro > 0) {
      await supabase
        .from("veiculos")
        .update({
          [campoMedia]: consumoKmLitro,
          custo_medio_km_combustivel: custoPorKm,
          custo_medio_km_geral: custoPorKm,
        })
        .eq("id", Number(veiculoId));
    }

    if (odometroFinal > Number(veiculoSelecionado?.odometro_atual || 0)) {
      await supabase
        .from("veiculos")
        .update({ odometro_atual: odometroFinal })
        .eq("id", Number(veiculoId));
    }
  }

  async function salvarDetalhesManutencao(saidaId) {
    await supabase.from("saidas_manutencoes").insert({
      saida_id: saidaId,
      veiculo_id: veiculoId ? Number(veiculoId) : null,
      odometro: Number(odometro || 0),
      tipo_manutencao: tipoManutencao,
      servico,
      oficina,
      proxima_revisao_km: Number(proximaRevisaoKm || 0),
      proxima_revisao_data: proximaRevisaoData || null,
    });
  }

  function renderCamposPrincipais() {
    return (
      <section className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold">Dados principais</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <Campo label="Data da compra" erro={erros.dataCompra} shakeKey={shakeKey}>
            <ButtonField erro={erros.dataCompra} shakeKey={shakeKey} onClick={() => setModalDataAberto(true)}>
              {formatarDataBR(dataCompra)}
            </ButtonField>
          </Campo>

          {!isAbastecimento && (
            <Campo label="Categoria" erro={erros.categoria} shakeKey={shakeKey}>
              <ButtonField erro={erros.categoria} shakeKey={shakeKey} onClick={() => setModalCategoriaAberto(true)}>
                {categoria}
              </ButtonField>
            </Campo>
          )}

          <Campo label="Finalidade">
            <FinalidadeSelector finalidade={finalidade} setFinalidade={setFinalidade} />
          </Campo>

          {!isAbastecimento && (
            <Campo label="Descrição">
              <input
                type="text"
                value={descricao}
                placeholder="Ex: IPVA, revisão..."
                onChange={(e) => setDescricao(e.target.value)}
                className="input-base"
              />
            </Campo>
          )}

          <Campo label="Forma de pagamento">
            <ButtonField onClick={() => setModalPagamentoAberto(true)}>
              {textoFormaPagamento()}
            </ButtonField>
          </Campo>

          {!isBoleto && (
            <Campo label={isCredito ? "Cartão" : isDinheiro ? "Carteira" : "Conta"} erro={isCredito ? erros.cartaoId : erros.contaId} shakeKey={shakeKey}>
              <ButtonField
                erro={isCredito ? erros.cartaoId : erros.contaId}
                shakeKey={shakeKey}
                onClick={() => {
                  if (isDinheiro) return;
                  isCredito
                    ? setModalCartaoAberto(true)
                    : setModalContaAberto(true);
                }}
              >
                {textoContaCartao()}
              </ButtonField>
            </Campo>
          )}

          {isBoleto && (
            <Campo label="Vencimento do boleto" erro={erros.dataVencimento} shakeKey={shakeKey}>
              <ButtonField erro={erros.dataVencimento} shakeKey={shakeKey} onClick={() => setModalVencimentoAberto(true)}>
                {formatarDataBR(dataVencimento)}
              </ButtonField>
            </Campo>
          )}

          <Campo label="Valor total" erro={erros.valorTotal} shakeKey={shakeKey}>
            <MoneyInput
              erro={erros.valorTotal}
              shakeKey={shakeKey}
              value={valorTotal}
              onChange={(valor) => { limparErro("valorTotal"); atualizarValorTotal(valor); }}
              prefix="R$"
              placeholder="0,00"
            />
          </Campo>
        </div>

        {isCreditoParcelado && (
          <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
            <p className="text-sm text-gray-300 font-semibold">Parcelamento no crédito</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Campo label="Quantidade de parcelas" erro={erros.numeroParcelas} shakeKey={shakeKey}>
                <ButtonField erro={erros.numeroParcelas} shakeKey={shakeKey} onClick={() => setModalParcelasAberto(true)}>
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
                  placeholder="0,00"
                />
              </Campo>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Crédito parcelado começa em 2x. Crédito à vista deve ser escolhido como forma de pagamento separada.
            </p>
          </div>
        )}

        {isBoleto && (
          <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
            <p className="text-sm text-gray-300 font-semibold">Conta registrada</p>
            <p className="text-xs text-gray-500 mt-2">
              Este lançamento será registrado como conta a pagar. Ele aparece no extrato de forma neutra e não altera o saldo até ser marcado como pago.
            </p>
          </div>
        )}
      </section>
    );
  }

  function renderCamposAbastecimento() {
    if (!isAbastecimento) return null;

    return (
      <section className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold">Dados do abastecimento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <Campo label="Veículo" erro={erros.veiculoId} shakeKey={shakeKey}>
            <ButtonField erro={erros.veiculoId} shakeKey={shakeKey} onClick={() => setModalVeiculoAberto(true)}>
              {veiculoSelecionado ? veiculoSelecionado.nome : "Selecionar veículo"}
            </ButtonField>
          </Campo>

          <Campo label="Valor do litro" erro={erros.valorLitro} shakeKey={shakeKey}>
            <MoneyInput
              erro={erros.valorLitro}
              shakeKey={shakeKey}
              value={valorLitro}
              onChange={(valor) => { limparErro("valorLitro"); atualizarValorLitro(valor); }}
              prefix="R$"
              placeholder="0,00"
            />
          </Campo>

          <Campo label="Tipo de combustível">
            <ButtonField onClick={() => setModalCombustivelAberto(true)}>
              {textoCombustivel()}
            </ButtonField>
          </Campo>

          <Campo label="Informar por">
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setModoKm("trip")}
                className={`rounded-xl border p-3 font-bold ${
                  modoKm === "trip"
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                KM rodados
              </button>

              <button
                type="button"
                onClick={() => setModoKm("odometro")}
                className={`rounded-xl border p-3 font-bold ${
                  modoKm === "odometro"
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                Odômetro
              </button>
            </div>
          </Campo>

          {modoKm === "trip" ? (
            <Campo label="KM rodados / Trip B" erro={erros.km} shakeKey={shakeKey}>
              <MoneyInput
                erro={erros.km}
                shakeKey={shakeKey}
                value={kmRodados}
                onChange={(valor) => { limparErro("km"); atualizarKmRodados(valor); }}
                suffix="km"
                placeholder="0"
              />
            </Campo>
          ) : (
            <Campo label="Odômetro atual" erro={erros.km} shakeKey={shakeKey}>
              <MoneyInput
                erro={erros.km}
                shakeKey={shakeKey}
                value={odometro}
                onChange={(valor) => { limparErro("km"); atualizarOdometro(valor); }}
                suffix="km"
                placeholder="0"
              />
            </Campo>
          )}

        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResumoItem titulo="Litros calculados" valor={`${numeroParaDecimalInput(litrosCalculados(), 3)} L`} />
          <ResumoItem
            titulo="Consumo estimado"
            valor={consumoCalculado() > 0 ? `${numeroParaDecimalInput(consumoCalculado(), 2)} km/L` : "-"}
          />
          <ResumoItem
            titulo="Odômetro após abastecimento"
            valor={odometro ? `${Number(odometro).toLocaleString("pt-BR")} km` : "-"}
          />
        </div>

        <p className="text-xs text-gray-500 mt-4">
          O app calcula litros, consumo e descrição automaticamente. A divisão entre uso pessoal e trabalho será calculada depois cruzando os km das entradas com os km do abastecimento.
        </p>
      </section>
    );
  }

  function renderCamposManutencao() {
    if (!isManutencaoCompleta) return null;

    return (
      <section className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold">Dados da manutenção</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <Campo label="Veículo">
            <ButtonField onClick={() => setModalVeiculoAberto(true)}>
              {veiculoSelecionado ? veiculoSelecionado.nome : "Selecionar veículo"}
            </ButtonField>
          </Campo>

          <Campo label="Odômetro">
            <MoneyInput
              value={odometro}
              onChange={(valor) => setOdometro(somenteNumeros(valor))}
              suffix="km"
              placeholder="0"
            />
          </Campo>

          <Campo label="Tipo de manutenção">
            <input
              type="text"
              value={tipoManutencao}
              placeholder="Ex: preventiva"
              onChange={(e) => setTipoManutencao(e.target.value)}
              className="input-base"
            />
          </Campo>

          <Campo label="Serviço">
            <input
              type="text"
              value={servico}
              placeholder="Ex: troca de óleo"
              onChange={(e) => setServico(e.target.value)}
              className="input-base"
            />
          </Campo>

          <Campo label="Oficina">
            <input
              type="text"
              value={oficina}
              placeholder="Ex: Auto Center"
              onChange={(e) => setOficina(e.target.value)}
              className="input-base"
            />
          </Campo>

          <Campo label="Próxima revisão em KM">
            <MoneyInput
              value={proximaRevisaoKm}
              onChange={(valor) => setProximaRevisaoKm(somenteNumeros(valor))}
              suffix="km"
              placeholder="0"
            />
          </Campo>

          <Campo label="Data da próxima revisão">
            <input
              type="date"
              value={proximaRevisaoData}
              onChange={(e) => setProximaRevisaoData(e.target.value)}
              className="input-base"
            />
          </Campo>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        {setPagina && (
          <button
            type="button"
            onClick={() => setPagina("novo-lancamento")}
            className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center"
          >
            ←
          </button>
        )}

        <div>
          <h1 className="text-3xl font-bold">
            {isAbastecimento ? "Novo Abastecimento" : isManutencaoCompleta ? "Nova Manutenção" : "Nova Saída"}
          </h1>

          <p className="text-gray-400 mt-1">
            {isAbastecimento
              ? "Registre combustível e atualize km/odômetro do veículo"
              : isManutencaoCompleta
              ? "Registre uma manutenção completa com histórico do veículo"
              : "Registre despesas gerais"}
          </p>
        </div>
      </div>

      {renderCamposPrincipais()}
      {renderCamposAbastecimento()}
      {renderCamposManutencao()}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <button
          type="button"
          onClick={() => setPagina && setPagina("novo-lancamento")}
          className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-4"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={salvarSaida}
          disabled={salvando}
          className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-4"
        >
          {salvando
            ? "Salvando..."
            : isAbastecimento
            ? "Salvar Abastecimento"
            : "Salvar Saída"}
        </button>
      </div>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataCompra}
        onChange={(valor) => { limparErro("dataCompra"); setDataCompra(valor); }}
        onClose={() => setModalDataAberto(false)}
        titulo="Selecionar data"
        descricao="Escolha a data da compra."
      />

      <DatePickerModal
        aberto={modalVencimentoAberto}
        valor={dataVencimento}
        onChange={(valor) => { limparErro("dataVencimento"); setDataVencimento(valor); }}
        onClose={() => setModalVencimentoAberto(false)}
        titulo="Vencimento do boleto"
        descricao="Escolha a data em que esta conta precisa ser paga."
      />

      <SelecionarFormaPagamentoModal
        aberto={modalPagamentoAberto}
        formasPagamento={formasPagamento}
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

          if (valor === "dinheiro") {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");
            if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id));
          }

          if (!["credito_avista", "credito_parcelado", "boleto"].includes(valor)) {
            setCartaoId("");
            setNumeroParcelas("1");
            setValorParcela("");

            if (valor === "dinheiro") {
              if (carteiraSelecionada) setContaId(String(carteiraSelecionada.id));
            } else {
              definirContaBancariaPadrao();
            }
          }
        }}
        onClose={() => setModalPagamentoAberto(false)}
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasBancarias}
        contaId={contaId}
        onSelecionar={(valor) => { limparErro("contaId"); setContaId(valor); }}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoId}
        onSelecionar={(valor) => { limparErro("cartaoId"); setCartaoId(valor); }}
        onClose={() => setModalCartaoAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarVeiculoModal
        aberto={modalVeiculoAberto}
        veiculos={veiculos}
        veiculoId={veiculoId}
        onSelecionar={(valor) => { limparErro("veiculoId"); setVeiculoId(valor); }}
        onClose={() => setModalVeiculoAberto(false)}
      />

      <SelecionarCombustivelModal
        aberto={modalCombustivelAberto}
        combustiveis={combustiveis}
        tipoCombustivel={tipoCombustivel}
        onSelecionar={setTipoCombustivel}
        onClose={() => setModalCombustivelAberto(false)}
      />

      <SelecionarCategoriaModal
        aberto={modalCategoriaAberto}
        categorias={categoriasNomes}
        categoria={categoria}
        onSelecionar={(valor) => { limparErro("categoria"); selecionarCategoria(valor); }}
        onClose={() => setModalCategoriaAberto(false)}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasAberto}
        numeroParcelas={numeroParcelas}
        onSelecionar={(valor) => { limparErro("numeroParcelas"); setNumeroParcelas(valor); }}
        onClose={() => setModalParcelasAberto(false)}
      />

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

function FinalidadeSelector({ finalidade, setFinalidade }) {
  const opcoes = [
    { valor: "trabalho", titulo: "Uso à trabalho" },
    { valor: "pessoal", titulo: "Uso pessoal" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {opcoes.map((opcao) => {
        const ativo = finalidade === opcao.valor;

        return (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => setFinalidade(opcao.valor)}
            className={`rounded-xl border p-3 text-sm font-black transition ${
              ativo
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-gray-700 text-gray-300 hover:bg-white/5"
            }`}
          >
            {opcao.titulo}
          </button>
        );
      })}
    </div>
  );
}

function MoneyInput({ value, onChange, prefix, suffix, placeholder, erro, shakeKey }) {
  return (
    <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden`}>
      {prefix && <span className="px-3 text-gray-400">{prefix}</span>}

      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />

      {suffix && <span className="px-3 text-gray-400">{suffix}</span>}
    </div>
  );
}

function ResumoItem({ titulo, valor }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400">{titulo}</p>
      <p className="text-xl font-bold mt-1">{valor}</p>
    </div>
  );
}
