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
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import SelecionarVeiculoModal from "../../../shared/components/modals/SelecionarVeiculoModal";
import SelecionarCombustivelModal from "./SelecionarCombustivelModal";
import PagamentosMultiplos from "../../../shared/components/financeiro/PagamentosMultiplos";
import {
  calcularUsoELimiteCartao,
  gerarParcelasEFaturasPadrao,
  recalcularFaturaPorParcelas as recalcularFaturaPorParcelasCompartilhada,
  removerParcelasDaSaidaERecalcularFaturas,
} from "../../cartoes/utils/cartoesUtils";
import { FORMA_PAGAMENTO_DEBITO_CONTA } from "../../../shared/constants/formasPagamento";
import {
  calcularMetricasConsumo,
  localizarAbastecimentosVizinhos,
  validarCrescimentoOdometro,
} from "../utils/abastecimentosCronologia";
import { criarFeedbackAbastecimento } from "../utils/abastecimentosFeedback";
import {
  criarPagamentoVazio,
  criarPayloadSaidaPagamento,
  formaPagamentoEhCredito,
  normalizarPagamentosEdicao,
  planejarPersistenciaPagamentos,
  validarCamposPagamento,
  validarTotalPagamentos,
} from "../../../shared/utils/pagamentosMultiplos";

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
  const [pagamentos, setPagamentos] = useState(() => [criarPagamentoVazio(hoje)]);
  const [saidasAdicionaisEdicao, setSaidasAdicionaisEdicao] = useState([]);
  const [erroCarregamentoPagamentos, setErroCarregamentoPagamentos] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  const [veiculoId, setVeiculoId] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [valorLitro, setValorLitro] = useState("");
  const [odometro, setOdometro] = useState("");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVeiculoAberto, setModalVeiculoAberto] = useState(false);
  const [modalCombustivelAberto, setModalCombustivelAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    destaque: "",
    textoBotao: "Entendi",
    fecharDepois: false,
  });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const veiculoSelecionado = useMemo(() => veiculos.find((v) => String(v.id) === String(veiculoId)), [veiculos, veiculoId]);
  const carteiraSelecionada = useMemo(() => contas.find((c) => c.tipo_conta === "carteira"), [contas]);
  const validacaoPagamentos = useMemo(
    () => validarTotalPagamentos(valorTotal, pagamentos),
    [valorTotal, pagamentos]
  );
  const litrosFormulario = useMemo(() => {
    const total = moedaParaNumero(valorTotal);
    const valorUnitario = moedaParaNumero(valorLitro);
    return total > 0 && valorUnitario > 0 ? total / valorUnitario : 0;
  }, [valorTotal, valorLitro]);
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
    const saidaPrincipal = edicao.pagamentos?.[0] || edicao;
    setErroCarregamentoPagamentos("");
    setSaidasAdicionaisEdicao([]);
    setPagamentos(
      normalizarPagamentosEdicao(
        saidaPrincipal,
        [],
        edicao.data_compra || hoje
      )
    );
    setDataCompra(edicao.data_compra || hoje);
    setValorTotal(numeroParaMoedaInput(edicao.valor_total || 0));
    setVeiculoId(a.veiculo_id ? String(a.veiculo_id) : "");
    setTipoCombustivel(a.tipo_combustivel || "etanol");
    setValorLitro(numeroParaMoedaInput(a.valor_litro || 0));
    setOdometro(String(Number(a.odometro || 0)));

    let ativo = true;
    supabase
      .from("saidas")
      .select("*")
      .eq("saida_origem_id", Number(edicao.id))
      .order("id")
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          console.error(error);
          setErroCarregamentoPagamentos(
            "Não foi possível carregar todas as formas de pagamento. Feche e tente novamente."
          );
          return;
        }

        const adicionais = data || [];
        setSaidasAdicionaisEdicao(adicionais);
        setPagamentos(
          normalizarPagamentosEdicao(
            saidaPrincipal,
            adicionais,
            edicao.data_compra || hoje
          )
        );
        const totalGrupo = [saidaPrincipal, ...adicionais].reduce(
          (total, saida) => total + Number(saida.valor_total || 0),
          0
        );
        setValorTotal(numeroParaMoedaInput(totalGrupo));
      });

    return () => {
      ativo = false;
    };
  }, [aberto, edicao?.id, edicao?.abastecimento?.id]);

  useEffect(() => {
    if (!veiculoSelecionado) return;

    const aceitos = veiculoSelecionado.combustiveis_aceitos || [];

    if (!aceitos.includes(tipoCombustivel)) {
      setTipoCombustivel(aceitos.length === 1 ? aceitos[0] : "");
    }
  }, [veiculoSelecionado, tipoCombustivel]);


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
    const listaVeiculos = veiculosPermitidos || veiculosData || [];
    setVeiculoId(listaVeiculos.length === 1 ? String(listaVeiculos[0].id) : "");
  }

  async function carregarUsoDosCartoes(listaCartoes) {
    if (!listaCartoes.length) return [];
    const ids = listaCartoes.map((c) => c.id);
    const { data: faturasData } = await supabase.from("faturas_cartao").select("cartao_id, valor_total, valor_pago, status").in("cartao_id", ids).in("status", ["aberta", "fechada", "parcial"]);
    return listaCartoes.map((cartao) => ({ ...cartao, usado: calcularUsoELimiteCartao((faturasData || []).filter((f) => Number(f.cartao_id) === Number(cartao.id)), cartao.limite_total).usado }));
  }

  function limparFormulario(limparTudo = true) {
    setDataCompra(hoje); setValorTotal(""); setPagamentos([criarPagamentoVazio(hoje)]); setSaidasAdicionaisEdicao([]); setErroCarregamentoPagamentos("");
    setValorLitro(""); setOdometro(""); setTipoCombustivel("");
    if (limparTudo) setVeiculoId("");
  }

  function textoCombustivel() { return COMBUSTIVEIS.find((c) => c.valor === tipoCombustivel)?.titulo || "Selecionar"; }
  function litrosCalculados() { return litrosFormulario; }

  function atualizarValorTotal(valor) {
    const valorFormatado = formatarMoedaDigitada(valor);
    setValorTotal(valorFormatado);
    limparErro("somaPagamentos");

    if (pagamentos.length === 1) {
      setPagamentos((atuais) =>
        atuais.map((pagamento) => {
          const parcelas = Math.max(Number(pagamento.numeroParcelas || 1), 1);
          return {
            ...pagamento,
            valor: valorFormatado,
            valorParcela:
              pagamento.formaPagamento === "credito_parcelado"
                ? numeroParaMoedaInput(moedaParaNumero(valorFormatado) / parcelas)
                : valorFormatado,
          };
        })
      );
    }
  }
  function atualizarOdometro(valor) {
    setOdometro(somenteNumeros(valor));
  }
  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({
      aberto: true,
      tipo,
      titulo,
      mensagem,
      destaque: "",
      textoBotao: "Entendi",
      fecharDepois,
    });
  }
  function limparErro(campo) { setErros((atuais) => { if (!atuais[campo]) return atuais; const novos = { ...atuais }; delete novos[campo]; return novos; }); }
  function limparErroPagamento(chave, campo) {
    if (campo === "total") {
      limparErro("somaPagamentos");
      return;
    }

    setErros((atuais) => {
      const errosPagamento = atuais.pagamentos?.[chave];
      if (!errosPagamento?.[campo]) return atuais;
      const proximosCampos = { ...errosPagamento };
      delete proximosCampos[campo];
      const proximosPagamentos = { ...atuais.pagamentos };

      if (Object.keys(proximosCampos).length) {
        proximosPagamentos[chave] = proximosCampos;
      } else {
        delete proximosPagamentos[chave];
      }

      const proximos = { ...atuais, pagamentos: proximosPagamentos };
      if (!Object.keys(proximosPagamentos).length) delete proximos.pagamentos;
      return proximos;
    });
  }
  async function fecharFeedback() {
    const fechar = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      destaque: "",
      textoBotao: "Entendi",
      fecharDepois: false,
    });

    if (fechar) {
      if (edicao?.id) await onSalvo?.();
      limparFormulario(false);
      onClose?.();
    }
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

  async function ajustarFaturasAoRemoverParcelasDaSaida(saidaId) {
    return removerParcelasDaSaidaERecalcularFaturas(supabase, saidaId);
  }

  async function gerarParcelasEFaturas(saidaId, pagamento) {
    if (!formaPagamentoEhCredito(pagamento.formaPagamento)) return;
    const cartao = cartoes.find(
      (item) => String(item.id) === String(pagamento.cartaoId)
    );
    if (!cartao) throw new Error("Cartão selecionado não encontrado.");
    const total = moedaParaNumero(pagamento.valor);
    const parcelas =
      pagamento.formaPagamento === "credito_parcelado"
        ? Number(pagamento.numeroParcelas || 2)
        : 1;
    const parcelaValor =
      pagamento.formaPagamento === "credito_parcelado"
        ? moedaParaNumero(pagamento.valorParcela) || total / parcelas
        : total;

    return gerarParcelasEFaturasPadrao(supabase, {
      saidaId,
      cartao,
      cartaoId: pagamento.cartaoId,
      dataBase: dataCompra,
      quantidadeParcelas: parcelas,
      valorParcela: parcelaValor,
      valorTotal: total,
      recalcularAoFinal: () => recalcularFaturasDaSaida(saidaId),
    });
  }

  async function verificarLimitesCartoes() {
    const valoresPorCartao = pagamentos
      .filter((pagamento) => formaPagamentoEhCredito(pagamento.formaPagamento))
      .reduce((grupos, pagamento) => {
        const id = String(pagamento.cartaoId);
        grupos.set(id, (grupos.get(id) || 0) + moedaParaNumero(pagamento.valor));
        return grupos;
      }, new Map());

    for (const [cartaoId, total] of valoresPorCartao) {
      const cartao = cartoes.find((item) => String(item.id) === cartaoId);
      if (!cartao) throw new Error("Cartão selecionado não encontrado.");
      const { data, error } = await supabase
        .from("faturas_cartao")
        .select("valor_total, valor_pago, status")
        .eq("cartao_id", Number(cartaoId))
        .in("status", ["aberta", "fechada", "parcial"]);
      if (error) throw error;
      const { limite, disponivel } = calcularUsoELimiteCartao(
        data,
        cartao.limite_total
      );
      if (
        limite > 0 &&
        total > disponivel &&
        !window.confirm(
          `⚠ Os pagamentos neste cartão somam ${formatarMoeda(total)} e ultrapassarão o limite disponível.\n\nDeseja continuar mesmo assim?`
        )
      ) {
        return false;
      }
    }

    return true;
  }

  function validar() {
    const novos = {};
    if (erroCarregamentoPagamentos) {
      novos.somaPagamentos = erroCarregamentoPagamentos;
    }
    if (!dataCompra) novos.dataCompra = "Selecione a data da compra.";
    if (!veiculoId) novos.veiculoId = "Selecione o veículo.";
    if (!tipoCombustivel) novos.tipoCombustivel = "Selecione o combustível.";
    if (moedaParaNumero(valorTotal) <= 0) novos.valorTotal = "Informe o valor total.";
    if (moedaParaNumero(valorLitro) <= 0) novos.valorLitro = "Informe o valor do litro.";
    if (!odometro) novos.km = "Informe o odômetro.";

    const errosPagamentos = {};
    pagamentos.forEach((pagamento) => {
      const errosPagamento = validarCamposPagamento(pagamento, {
        carteiraDisponivel: Boolean(carteiraSelecionada),
      });

      if (Object.keys(errosPagamento).length) {
        errosPagamentos[pagamento.chave] = errosPagamento;
      }
    });

    if (Object.keys(errosPagamentos).length) {
      novos.pagamentos = errosPagamentos;
    }

    const validacaoTotal = validarTotalPagamentos(valorTotal, pagamentos);
    if (moedaParaNumero(valorTotal) > 0 && !validacaoTotal.valido) {
      novos.somaPagamentos = validacaoTotal.mensagem;
    }

    setErros(novos); if (Object.keys(novos).length) setShakeKey(Date.now());
    return Object.keys(novos).length === 0;
  }

  async function validarSequenciaOdometro() {
    const { data: historico, error } = await supabase
      .from("saidas_abastecimentos")
      .select("id, saida_id, veiculo_id, odometro, saidas!inner(data_compra)")
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
      if (!(await verificarLimitesCartoes())) return;

      const descricao = `Compra de combustível - ${veiculoSelecionado?.nome || "Veículo"}`;
      let saidaId = edicao?.id || null;
      const pagamentosPersistidos = [];

      if (saidaId) {
        const plano = planejarPersistenciaPagamentos(
          pagamentos,
          saidaId,
          saidasAdicionaisEdicao
        );
        const idsAnteriores = [
          Number(saidaId),
          ...saidasAdicionaisEdicao.map((saida) => Number(saida.id)),
        ];

        for (const id of idsAnteriores) {
          await ajustarFaturasAoRemoverParcelasDaSaida(id);
        }

        if (plano.excluirIds.length) {
          const { error: erroExcluir } = await supabase
            .from("saidas")
            .delete()
            .in("id", plano.excluirIds);
          if (erroExcluir) throw erroExcluir;
        }

        const payloadPrincipal = criarPayloadSaidaPagamento({
          pagamento: plano.atualizarPrincipal,
          dataCompra,
          categoria: "Abastecimento",
          descricao,
        });
        const { error: erroPrincipal } = await supabase
          .from("saidas")
          .update(payloadPrincipal)
          .eq("id", saidaId);
        if (erroPrincipal) throw erroPrincipal;
        pagamentosPersistidos.push({
          saidaId: Number(saidaId),
          pagamento: plano.atualizarPrincipal,
        });

        for (const pagamento of plano.atualizarAdicionais) {
          const payload = criarPayloadSaidaPagamento({
            pagamento,
            dataCompra,
            categoria: "Abastecimento",
            descricao,
            saidaOrigemId: Number(saidaId),
          });
          const { error } = await supabase
            .from("saidas")
            .update(payload)
            .eq("id", Number(pagamento.saidaId));
          if (error) throw error;
          pagamentosPersistidos.push({
            saidaId: Number(pagamento.saidaId),
            pagamento,
          });
        }

        for (const pagamento of plano.inserirAdicionais) {
          const payload = criarPayloadSaidaPagamento({
            pagamento,
            dataCompra,
            categoria: "Abastecimento",
            descricao,
            saidaOrigemId: Number(saidaId),
          });
          const { data: saidaCriada, error } = await supabase
            .from("saidas")
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          pagamentosPersistidos.push({
            saidaId: Number(saidaCriada.id),
            pagamento,
          });
        }
      } else {
        const [pagamentoPrincipal, ...pagamentosAdicionais] = pagamentos;
        const payloadPrincipal = criarPayloadSaidaPagamento({
          pagamento: pagamentoPrincipal,
          dataCompra,
          categoria: "Abastecimento",
          descricao,
        });
        const { data: saidaCriada, error: erroSaida } = await supabase
          .from("saidas")
          .insert(payloadPrincipal)
          .select()
          .single();
        if (erroSaida) throw erroSaida;
        saidaId = saidaCriada.id;
        pagamentosPersistidos.push({
          saidaId: Number(saidaId),
          pagamento: pagamentoPrincipal,
        });

        for (const pagamento of pagamentosAdicionais) {
          const payload = criarPayloadSaidaPagamento({
            pagamento,
            dataCompra,
            categoria: "Abastecimento",
            descricao,
            saidaOrigemId: Number(saidaId),
          });
          const { data: adicionalCriada, error } = await supabase
            .from("saidas")
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          pagamentosPersistidos.push({
            saidaId: Number(adicionalCriada.id),
            pagamento,
          });
        }
      }

      for (const registro of pagamentosPersistidos) {
        await gerarParcelasEFaturas(registro.saidaId, registro.pagamento);
      }

      const metricasSalvas = await salvarDetalhesAbastecimento(saidaId, vizinhos);
      const feedbackSucesso = criarFeedbackAbastecimento({
        consumoKmLitro: metricasSalvas.consumoKmLitro,
        possuiAbastecimentoAnterior: Boolean(vizinhos.anterior),
      });
      setFeedback({
        aberto: true,
        tipo: "sucesso",
        ...feedbackSucesso,
        fecharDepois: true,
      });
      limparFormulario(false);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar abastecimento.");
    } finally { setSalvando(false); }
  }

  async function salvarDetalhesAbastecimento(saidaId, vizinhos) {
    const litros = litrosCalculados();
    const odometroFinal = Number(odometro || 0);
    const { kmPeriodo, consumoKmLitro } = calcularMetricasConsumo({
      odometro: odometroFinal,
      litros,
      anterior: vizinhos.anterior,
      odometroInicial:
        veiculoSelecionado?.odometro_inicial
        ?? veiculoSelecionado?.odometro_atual
        ?? 0,
    });
    const custoPorKm = kmPeriodo > 0 ? moedaParaNumero(valorTotal) / kmPeriodo : 0;
    const dadosAbastecimento = { saida_id: saidaId, veiculo_id: Number(veiculoId), odometro: odometroFinal, km_rodados: kmPeriodo, km_total_periodo: kmPeriodo, tipo_combustivel: tipoCombustivel, litros, valor_litro: moedaParaNumero(valorLitro), uso: "automatico", percentual_trabalho: 0, consumo_km_l: consumoKmLitro, custo_por_km: custoPorKm, posto: null };
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
    return { consumoKmLitro };
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

              <Campo label="Odômetro atual" erro={erros.km} shakeKey={shakeKey}>
                <MoneyInput erro={erros.km} shakeKey={shakeKey} value={odometro} onChange={(valor) => { limparErro("km"); atualizarOdometro(valor); }} suffix="km" placeholder="0" />
              </Campo>

            </div>

            <div className="mt-5">
              <PagamentosMultiplos
                pagamentos={pagamentos}
                valorTotal={valorTotal}
                onChange={(proximos) => {
                  setPagamentos(proximos);
                  limparErro("somaPagamentos");
                }}
                formasPagamento={formasPagamento}
                contas={contas}
                cartoes={cartoes}
                dataVencimentoPadrao={dataCompra || hoje}
                erros={erros.pagamentos}
                erroTotal={
                  erroCarregamentoPagamentos ||
                  erros.somaPagamentos ||
                  (moedaParaNumero(valorTotal) > 0 && !validacaoPagamentos.valido
                    ? validacaoPagamentos.mensagem
                    : "")
                }
                shakeKey={shakeKey}
                onLimparErro={limparErroPagamento}
              />
            </div>

          </section>
        </div>

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button type="button" onClick={onClose} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || Boolean(erroCarregamentoPagamentos) || (moedaParaNumero(valorTotal) > 0 && !validacaoPagamentos.valido)} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3 disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button>
        </div>
      </ModalBase>

      <DatePickerModal aberto={modalDataAberto} valor={dataCompra} onChange={(valor) => { limparErro("dataCompra"); setDataCompra(valor); }} onClose={() => setModalDataAberto(false)} titulo="Selecionar data" descricao="Escolha a data da compra." />
      <SelecionarVeiculoModal aberto={modalVeiculoAberto} veiculos={veiculos} veiculoId={veiculoId} onSelecionar={(valor) => { limparErro("veiculoId"); setVeiculoId(valor); }} onClose={() => setModalVeiculoAberto(false)} />
      <SelecionarCombustivelModal aberto={modalCombustivelAberto} combustiveis={combustiveisDisponiveis} tipoCombustivel={tipoCombustivel} onSelecionar={(valor) => { limparErro("tipoCombustivel"); setTipoCombustivel(valor); }} onClose={() => setModalCombustivelAberto(false)} />
      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        destaque={feedback.destaque}
        textoBotao={feedback.textoBotao}
        onClose={fecharFeedback}
      />
    </>
  );
}

function MoneyInput({ value, onChange, prefix, suffix, placeholder, erro, shakeKey }) { return <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden`}>{prefix && <span className="px-3 text-gray-400">{prefix}</span>}<input type="text" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent p-3 outline-none" />{suffix && <span className="px-3 text-gray-400">{suffix}</span>}</div>; }
