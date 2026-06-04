import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

import ModalBase from "./ModalBase";
import DatePickerModal from "./DatePickerModal";
import FeedbackModal from "./FeedbackModal";
import SelecionarFormaPagamentoModal from "./SelecionarFormaPagamentoModal";
import SelecionarContaModal from "./SelecionarContaModal";
import SelecionarCartaoModal from "./SelecionarCartaoModal";
import SelecionarCategoriaModal from "./SelecionarCategoriaModal";
import SelecionarParcelasModal from "./SelecionarParcelasModal";

export default function SaidaModal({
  aberto,
  onClose,
  titulo = "Nova Despesa",
  descricaoModal = "Registre uma despesa.",
  categoriaInicial = "Outros",
  categoriaBloqueada = false,
  modo = "saida", // saida | futura
}) {
  const hoje = new Date().toISOString().split("T")[0];

  const categorias = [
    "Alimentação",
    "Lavagem",
    "Seguro",
    "Acessórios",
    "Impostos",
    "Multa",
    "Documentação",
    "Pedágio",
    "Estacionamento",
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
    { valor: "boleto", titulo: "Boleto", descricao: "Registra conta a pagar" },
  ];

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);

  const [dataCompra, setDataCompra] = useState(hoje);
  const [dataVencimento, setDataVencimento] = useState(hoje);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(
    modo === "futura" ? "boleto" : "pix"
  );
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
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);

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

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
    resetarFormulario(false);
  }, [aberto, categoriaInicial, modo]);

  useEffect(() => {
    if (isDinheiro && carteiraSelecionada) {
      setContaId(String(carteiraSelecionada.id));
      setCartaoId("");
    }
  }, [isDinheiro, carteiraSelecionada]);

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

    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    const cartoesComUso = await carregarUsoDosCartoes(cartoesData || []);

    setContas(contasComSaldo);
    setCartoes(cartoesComUso);

    const carteira = contasComSaldo.find((conta) => conta.tipo_conta === "carteira");
    const principal = contasComSaldo.find((conta) => conta.principal);
    const bancoPadrao = principal || contasComSaldo.find((conta) => conta.tipo_conta === "banco");

    if (modo === "futura") return;
    if (formaPagamento === "dinheiro" && carteira) setContaId(String(carteira.id));
    else if (bancoPadrao) setContaId(String(bancoPadrao.id));
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
    setDataCompra(hoje);
    setDataVencimento(hoje);
    setCategoria(categoriaInicial);
    setDescricao("");
    setValorTotal("");
    setFormaPagamento(modo === "futura" ? "boleto" : "pix");
    setCartaoId("");
    setNumeroParcelas("1");
    setValorParcela("");
    setUltimoCampoEditado("total");

    if (limparTudo) {
      const principal = contas.find((conta) => conta.principal);
      if (principal) setContaId(String(principal.id));
    }
  }

  function cancelar() {
    const temDados =
      descricao || valorTotal || dataCompra !== hoje || dataVencimento !== hoje;

    if (temDados) {
      const confirmar = window.confirm(
        "Deseja cancelar este lançamento?\n\nOs dados preenchidos serão perdidos."
      );

      if (!confirmar) return;
    }

    resetarFormulario();
    onClose();
  }

  function textoFormaPagamento() {
    return formasPagamento.find((item) => item.valor === formaPagamento)?.titulo || "Selecionar";
  }

  function textoContaCartao() {
    if (isCredito) {
      if (!cartaoSelecionado) return "Selecionar cartão";
      return `${cartaoSelecionado.nome} final ${cartaoSelecionado.final_cartao}`;
    }

    if (isDinheiro) return carteiraSelecionada?.nome || "Carteira";

    return contaSelecionada?.nome || "Selecionar conta";
  }

  function definirContaBancariaPadrao() {
    const contaPrincipal = contasBancarias.find((conta) => conta.principal);
    const contaPadrao = contaPrincipal || contasBancarias[0];

    if (contaPadrao) setContaId(String(contaPadrao.id));
  }

  function atualizarValorTotal(valor) {
    setUltimoCampoEditado("total");
    setValorTotal(formatarMoedaDigitada(valor));
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

  function ultimoDiaMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
  }

  function dataComDiaSeguro(ano, mes, dia) {
    const diaSeguro = Math.min(Number(dia || 1), ultimoDiaMes(ano, mes));
    return `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
  }

  function adicionarMesCompetencia(ano, mes, quantidade) {
    let novoMes = mes + quantidade;
    let novoAno = ano;

    while (novoMes > 12) {
      novoMes -= 12;
      novoAno += 1;
    }

    while (novoMes < 1) {
      novoMes += 12;
      novoAno -= 1;
    }

    return { mes: novoMes, ano: novoAno };
  }

  function somarMeses(dataBase, mesesParaSomar) {
    const data = new Date(`${dataBase}T00:00:00`);
    data.setMonth(data.getMonth() + mesesParaSomar);
    return data;
  }

  function calcularCompetenciaFatura(dataBase, cartao) {
    const data = new Date(`${dataBase}T00:00:00`);
    const diaCompra = data.getDate();
    const diaFechamento = Number(cartao?.dia_fechamento || 1);
    const diaVencimento = Number(cartao?.dia_vencimento || 1);

    let mesFechamento = data.getMonth() + 1;
    let anoFechamento = data.getFullYear();

    if (diaCompra > diaFechamento) {
      const proximo = adicionarMesCompetencia(anoFechamento, mesFechamento, 1);
      mesFechamento = proximo.mes;
      anoFechamento = proximo.ano;
    }

    let mesVencimento = mesFechamento;
    let anoVencimento = anoFechamento;

    if (diaVencimento < diaFechamento) {
      const proximo = adicionarMesCompetencia(anoVencimento, mesVencimento, 1);
      mesVencimento = proximo.mes;
      anoVencimento = proximo.ano;
    }

    return { mes: mesVencimento, ano: anoVencimento, mesFechamento, anoFechamento };
  }

  async function buscarOuCriarFatura({ cartao, dataBase }) {
    const competencia = calcularCompetenciaFatura(dataBase, cartao);

    const dataFechamento = dataComDiaSeguro(
      competencia.anoFechamento,
      competencia.mesFechamento,
      cartao.dia_fechamento
    );

    const dataVencimento = dataComDiaSeguro(
      competencia.ano,
      competencia.mes,
      cartao.dia_vencimento
    );

    const { data: faturaExistente, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", Number(cartao.id))
      .eq("mes", competencia.mes)
      .eq("ano", competencia.ano)
      .maybeSingle();

    if (erroBusca) throw erroBusca;
    if (faturaExistente) return faturaExistente;

    const { data: novaFatura, error: erroCriar } = await supabase
      .from("faturas_cartao")
      .insert({
        cartao_id: Number(cartao.id),
        mes: competencia.mes,
        ano: competencia.ano,
        data_fechamento: dataFechamento,
        data_vencimento: dataVencimento,
        valor_total: 0,
        status: "aberta",
      })
      .select()
      .single();

    if (erroCriar) throw erroCriar;
    return novaFatura;
  }

  async function atualizarValorFatura(faturaId, valorSomar) {
    const { data: fatura, error: erroBusca } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("id", faturaId)
      .single();

    if (erroBusca) throw erroBusca;

    const novoTotal = Number(fatura.valor_total || 0) + Number(valorSomar || 0);

    const { error: erroUpdate } = await supabase
      .from("faturas_cartao")
      .update({ valor_total: novoTotal })
      .eq("id", faturaId);

    if (erroUpdate) throw erroUpdate;
  }

  async function verificarLimiteCartao(total) {
    if (!cartaoSelecionado) return true;

    const { data: faturasAbertas, error: erroFaturas } = await supabase
      .from("faturas_cartao")
      .select("valor_total")
      .eq("cartao_id", Number(cartaoId))
      .in("status", ["aberta", "fechada"]);

    if (erroFaturas) throw erroFaturas;

    const usadoAtual = (faturasAbertas || []).reduce(
      (totalAtual, fatura) => totalAtual + Number(fatura.valor_total || 0),
      0
    );

    const limite = Number(cartaoSelecionado.limite_total || 0);
    const disponivel = limite - usadoAtual;

    if (limite > 0 && total > disponivel) {
      return window.confirm(
        "⚠ Esta compra ultrapassará o limite do cartão.\n\nDeseja continuar mesmo assim?"
      );
    }

    return true;
  }

  async function gerarParcelasEFaturas(saidaId, total, parcelaValor, parcelas) {
    if (!isCredito || !cartaoSelecionado) return;

    const parcelasPayload = [];

    for (let index = 0; index < parcelas; index++) {
      const dataParcela = somarMeses(dataCompra, index);
      const dataBase = dataParcela.toISOString().split("T")[0];

      const fatura = await buscarOuCriarFatura({ cartao: cartaoSelecionado, dataBase });
      await atualizarValorFatura(fatura.id, parcelaValor);

      parcelasPayload.push({
        saida_id: saidaId,
        cartao_id: Number(cartaoId),
        fatura_id: fatura.id,
        numero_parcela: index + 1,
        total_parcelas: parcelas,
        valor_parcela: parcelaValor,
        data_vencimento: fatura.data_vencimento,
        status: "pendente",
      });
    }

    if (parcelasPayload.length > 0) {
      const { error: erroParcelas } = await supabase
        .from("saidas_parcelas")
        .insert(parcelasPayload);

      if (erroParcelas) throw erroParcelas;
    }
  }

  function validarCampos() {
    if (!dataCompra || !categoria || !valorTotal) {
      abrirFeedback("erro", "Campos obrigatórios", "Preencha data, categoria e valor.");
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

    if (!isCredito && !isBoleto && !contaId) {
      abrirFeedback("erro", "Conta obrigatória", "Selecione uma conta.");
      return false;
    }

    if (isBoleto && !dataVencimento) {
      abrirFeedback("erro", "Vencimento obrigatório", "Informe a data de vencimento.");
      return false;
    }

    if (isCreditoParcelado && Number(numeroParcelas || 0) < 2) {
      abrirFeedback("erro", "Parcelamento inválido", "Crédito parcelado precisa começar em 2x.");
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
    const parcelas = isCreditoParcelado ? Number(numeroParcelas || 2) : 1;
    const parcelaValor = isCreditoParcelado ? moedaParaNumero(valorParcela) : total;

    if (isCredito) {
      const limiteOk = await verificarLimiteCartao(total);
      if (!limiteOk) return;
    }

    setSalvando(true);

    try {
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
          descricao: descricao.trim(),
          status: definirStatus(),
        })
        .select()
        .single();

      if (erroSaida) throw erroSaida;

      if (isCredito) {
        await gerarParcelasEFaturas(saidaCriada.id, total, parcelaValor, parcelas);
      }

      abrirFeedback(
        "sucesso",
        isBoleto ? "Despesa futura registrada" : "Despesa salva",
        isBoleto
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
        titulo={titulo}
        descricao={descricaoModal}
        onClose={cancelar}
        largura="max-w-3xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Data da compra">
            <ButtonField onClick={() => setModalDataAberto(true)}>
              {formatarDataBR(dataCompra)}
            </ButtonField>
          </Campo>

          {!categoriaBloqueada && (
            <Campo label="Categoria">
              <ButtonField onClick={() => setModalCategoriaAberto(true)}>
                {categoria}
              </ButtonField>
            </Campo>
          )}

          {categoriaBloqueada && (
            <Campo label="Categoria">
              <div className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 font-semibold">
                {categoria}
              </div>
            </Campo>
          )}

          <Campo label="Descrição">
            <input
              type="text"
              value={descricao}
              placeholder="Ex: almoço, lavagem, seguro, IPVA..."
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
            />
          </Campo>

          <Campo label="Forma de pagamento">
            {modo === "futura" ? (
              <div className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 font-semibold">
                Boleto / Conta a pagar
              </div>
            ) : (
              <ButtonField onClick={() => setModalPagamentoAberto(true)}>
                {textoFormaPagamento()}
              </ButtonField>
            )}
          </Campo>

          {!isBoleto && (
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

          {isBoleto && (
            <Campo label="Vencimento">
              <ButtonField onClick={() => setModalVencimentoAberto(true)}>
                {formatarDataBR(dataVencimento)}
              </ButtonField>
            </Campo>
          )}

          <Campo label="Valor total">
            <MoneyInput
              value={valorTotal}
              onChange={atualizarValorTotal}
              prefix="R$"
              placeholder="0,00"
            />
          </Campo>
        </div>

        {isCreditoParcelado && (
          <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
            <p className="text-sm text-gray-300 font-semibold">Parcelamento</p>

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
                  placeholder="0,00"
                />
              </Campo>
            </div>
          </div>
        )}

        {isBoleto && (
          <div className="mt-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-sm text-blue-300 font-bold">Despesa futura</p>
            <p className="text-xs text-gray-400 mt-2">
              Este lançamento entra como conta a pagar e não altera o saldo até ser pago.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6">
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
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataCompra}
        onChange={setDataCompra}
        onClose={() => setModalDataAberto(false)}
        titulo="Selecionar data"
        descricao="Escolha a data da compra."
      />

      <DatePickerModal
        aberto={modalVencimentoAberto}
        valor={dataVencimento}
        onChange={setDataVencimento}
        onClose={() => setModalVencimentoAberto(false)}
        titulo="Vencimento"
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
        categorias={categorias}
        categoria={categoria}
        onSelecionar={setCategoria}
        onClose={() => setModalCategoriaAberto(false)}
      />

      <SelecionarParcelasModal
        aberto={modalParcelasAberto}
        numeroParcelas={numeroParcelas}
        onSelecionar={setNumeroParcelas}
        onClose={() => setModalParcelasAberto(false)}
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
