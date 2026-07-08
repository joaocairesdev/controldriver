import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiCreditCard,
  FiFileText,
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";

import ModalBase from "../components/modals/ModalBase";
import DatePickerModal from "../components/modals/DatePickerModal";
import FeedbackModal from "../components/modals/FeedbackModal";
import SelecionarFormaPagamentoModal from "../components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../components/modals/SelecionarCartaoModal";
import useDirtyForm from "../hooks/useDirtyForm";

import {
  carregarDividasDisponiveis,
  carregarItensRenegociacao,
  carregarRenegociacoes,
  criarRenegociacao,
} from "./services/renegociacoesService";
import {
  formatarDataBR,
  formatarMoeda,
  formatarMoedaDigitada,
  hojeISO,
  moedaParaNumero,
  numeroParaMoedaInput,
  textoFormaPagamento,
  textoOrigemItem,
  textoTipoRenegociacao,
} from "./utils/renegociacoesUtils";

const FORM_INICIAL = {
  dataRenegociacao: "",
  formaPagamento: "",
  tipoAcordo: "",
  contaDebitoId: "",
  cartaoPagamentoId: "",
  contaAjusteId: "",
  saldoContaApos: "",
  valorRenegociado: "",
  valorEntrada: "",
  numeroParcelas: "",
  primeiroVencimento: "",
};

export default function Renegociacoes() {
  const [renegociacoes, setRenegociacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [renegociacaoDetalhe, setRenegociacaoDetalhe] = useState(null);
  const [itensDetalhe, setItensDetalhe] = useState([]);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setCarregando(true);

    try {
      const dados = await carregarRenegociacoes();
      setRenegociacoes(dados);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao carregar", error.message || "Não foi possível carregar as renegociações.");
    } finally {
      setCarregando(false);
    }
  }

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  async function abrirDetalhe(renegociacao) {
    setRenegociacaoDetalhe(renegociacao);

    try {
      const itens = await carregarItensRenegociacao(renegociacao.id);
      setItensDetalhe(itens);
    } catch (error) {
      console.error(error);
      setItensDetalhe([]);
      abrirFeedback("erro", "Erro ao abrir", error.message || "Não foi possível abrir os itens da renegociação.");
    }
  }

  const totais = useMemo(() => {
    return renegociacoes.reduce(
      (acc, item) => {
        if (item.status !== "cancelada") {
          acc.valorOriginal += Number(item.valor_original || 0);
          acc.valorRenegociado += Number(item.valor_renegociado || 0);
          acc.ativas += 1;
        }

        return acc;
      },
      { valorOriginal: 0, valorRenegociado: 0, ativas: 0 }
    );
  }, [renegociacoes]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Renegociações</h1>
          <p className="text-gray-400 mt-2">
            Junte dívidas antigas, quite a origem e gere um novo acordo para pagar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl px-5 py-3 flex items-center justify-center gap-2"
        >
          <FiPlus />
          Nova renegociação
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResumoCard titulo="Renegociações ativas" valor={totais.ativas} destaque="green" />
        <ResumoCard titulo="Dívida original" valor={formatarMoeda(totais.valorOriginal)} destaque="red" />
        <ResumoCard titulo="Valor renegociado" valor={formatarMoeda(totais.valorRenegociado)} destaque="yellow" />
      </div>

      {carregando ? (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando renegociações...</p>
        </div>
      ) : renegociacoes.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {renegociacoes.map((renegociacao) => (
            <button
              key={renegociacao.id}
              type="button"
              onClick={() => abrirDetalhe(renegociacao)}
              className="text-left bg-[#111827] border border-gray-800 hover:border-green-400 rounded-2xl p-5 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Credor</p>
                  <h2 className="text-xl font-black mt-1 truncate">{renegociacao.credor}</h2>
                </div>

                <span className="text-[11px] font-black rounded-full px-3 py-1 bg-green-500/10 text-green-400 whitespace-nowrap">
                  {renegociacao.status || "ativa"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <MiniInfo titulo="Original" valor={formatarMoeda(renegociacao.valor_original)} />
                <MiniInfo titulo="Acordo" valor={formatarMoeda(renegociacao.valor_renegociado)} />
                <MiniInfo titulo="Parcelas" valor={`${renegociacao.numero_parcelas || 1}x`} />
                <MiniInfo titulo="1º vencimento" valor={formatarDataBR(renegociacao.primeiro_vencimento)} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
          <FiRefreshCw className="w-10 h-10 mx-auto text-green-400" />
          <h2 className="text-xl font-black mt-4">Nenhuma renegociação ainda</h2>
          <p className="text-gray-400 mt-2">Quando você fizer um acordo, ele aparecerá aqui.</p>
        </div>
      )}

      {modalAberto && (
        <RenegociacaoModal
          fechar={() => setModalAberto(false)}
          onSalvo={async () => {
            setModalAberto(false);
            await carregarTudo();
            abrirFeedback("sucesso", "Renegociação criada", "As dívidas antigas foram marcadas como renegociadas e as novas parcelas foram criadas.");
          }}
        />
      )}

      {renegociacaoDetalhe && (
        <DetalheRenegociacaoModal
          renegociacao={renegociacaoDetalhe}
          itens={itensDetalhe}
          fechar={() => {
            setRenegociacaoDetalhe(null);
            setItensDetalhe([]);
          }}
        />
      )}

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

function RenegociacaoModal({ fechar, onSalvo }) {
  const [etapa, setEtapa] = useState(1);
  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [dividas, setDividas] = useState([]);
  const [selecionadas, setSelecionadas] = useState({});
  const [origensAbertas, setOrigensAbertas] = useState({});
  const [modalData, setModalData] = useState(null);
  const [modalFormaPagamento, setModalFormaPagamento] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalCartao, setModalCartao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  const { form, setField, isDirty } = useDirtyForm(FORM_INICIAL);

  useEffect(() => {
    carregarBase();
  }, []);

  async function carregarBase() {
    setCarregando(true);

    try {
      const dados = await carregarDividasDisponiveis();
      setContas(dados.contas || []);
      setCartoes(dados.cartoes || []);
      setDividas(dados.dividas || []);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao carregar dívidas", error.message || "Não foi possível carregar as dívidas disponíveis.");
    } finally {
      setCarregando(false);
    }
  }

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  const contasBanco = contas.filter((conta) => (conta.tipo_conta || "banco") !== "tag");
  const cartoesAtivos = cartoes.filter((cartao) => cartao.ativo !== false);
  const formasPagamentoAcordo = [
    { valor: "debito_conta", titulo: "Débito em conta" },
    { valor: "boleto", titulo: "Boleto" },
    { valor: "pix", titulo: "Pix" },
    { valor: "dinheiro", titulo: "Dinheiro" },
    { valor: "transferencia", titulo: "Transferência" },
    { valor: "credito", titulo: "Cartão de crédito" },
  ];
  const tiposAcordo = [
    { valor: "avista", titulo: "À vista" },
    { valor: "entrada_avista", titulo: "Entrada + à vista" },
    { valor: "parcelado", titulo: "Só parcelas" },
    { valor: "entrada_parcelado", titulo: "Entrada + parcelas" },
  ];
  const exigeContaPagamento = ["debito_conta", "pix", "transferencia"].includes(form.formaPagamento);
  const exigeCartaoPagamento = form.formaPagamento === "credito";
  const temEntrada = ["entrada_avista", "entrada_parcelado"].includes(form.tipoAcordo);
  const temParcelas = ["parcelado", "entrada_parcelado"].includes(form.tipoAcordo);

  const origens = useMemo(() => {
    return agruparDividasPorOrigem(dividas).filter((origem) =>
      origem.tipo === "cartao" || origem.tipo === "conta_negativa"
    );
  }, [dividas]);

  const itensSelecionados = useMemo(() => {
    return dividas
      .filter((divida) => selecionadas[divida.chave]?.selecionado)
      .map((divida) => ({
        ...divida,
        tipo_renegociacao: selecionadas[divida.chave]?.tipoRenegociacao || "total",
        valor_renegociado:
          selecionadas[divida.chave]?.tipoRenegociacao === "parcial"
            ? moedaParaNumero(selecionadas[divida.chave]?.valorParcial)
            : Number(divida.valor_aberto || 0),
        ajustar_limite: Boolean(selecionadas[divida.chave]?.ajustarLimite),
        novo_limite_total: moedaParaNumero(selecionadas[divida.chave]?.novoLimite),
      }));
  }, [dividas, selecionadas]);

  const valorOriginal = itensSelecionados.reduce(
    (total, item) => total + Number(item.valor_aberto || 0),
    0
  );

  const valorBaseRenegociado = itensSelecionados.reduce(
    (total, item) => total + Number(item.valor_renegociado || 0),
    0
  );

  const valorRenegociado = moedaParaNumero(form.valorRenegociado) || valorBaseRenegociado;
  const valorEntrada = moedaParaNumero(form.valorEntrada);
  const numeroParcelas = temParcelas ? Math.max(Number(form.numeroParcelas || 1), 1) : 1;
  const valorParcela = Math.max(valorRenegociado - valorEntrada, 0) / numeroParcelas;
  const contaNegativaSelecionada = itensSelecionados.find((item) => item.tipo === "conta_negativa");
  const possuiCartaoSelecionado = itensSelecionados.some((item) => item.tipo === "fatura");
  const credorAutomatico = definirCredorAutomatico(itensSelecionados);

  function criarEstadoDivida(divida) {
    return {
      selecionado: true,
      tipoRenegociacao: "total",
      valorParcial: numeroParaMoedaInput(divida.valor_aberto),
      ajustarLimite: false,
      novoLimite: divida.original?.cartoes?.limite_total
        ? numeroParaMoedaInput(divida.original.cartoes.limite_total)
        : "",
    };
  }

  function selecionarOrigemTotal(origem) {
    setSelecionadas((atual) => {
      const novo = { ...atual };

      origem.itens.forEach((divida) => {
        novo[divida.chave] = criarEstadoDivida(divida);
      });

      return novo;
    });
  }

  function limparOrigem(origem) {
    setSelecionadas((atual) => {
      const novo = { ...atual };

      origem.itens.forEach((divida) => {
        if (novo[divida.chave]) {
          novo[divida.chave] = {
            ...novo[divida.chave],
            selecionado: false,
          };
        }
      });

      return novo;
    });
  }

  function abrirEscolhaOrigem(origem) {
    setOrigensAbertas((atual) => ({
      ...atual,
      [origem.chave]: !atual[origem.chave],
    }));
  }

  function selecionarContaNegativaParcial(origem) {
    setSelecionadas((atual) => {
      const novo = { ...atual };

      origem.itens.forEach((divida) => {
        novo[divida.chave] = {
          ...criarEstadoDivida(divida),
          tipoRenegociacao: "parcial",
        };
      });

      return novo;
    });
  }

  function alternarDivida(divida) {
    setSelecionadas((atual) => {
      const atualItem = atual[divida.chave];

      if (atualItem?.selecionado) {
        return {
          ...atual,
          [divida.chave]: {
            ...atualItem,
            selecionado: false,
          },
        };
      }

      return {
        ...atual,
        [divida.chave]: criarEstadoDivida(divida),
      };
    });
  }

  function atualizarSelecionada(chave, campo, valor) {
    setSelecionadas((atual) => ({
      ...atual,
      [chave]: {
        ...(atual[chave] || {}),
        [campo]: valor,
      },
    }));
  }

  function proximo() {
    if (etapa === 1 && itensSelecionados.length === 0) {
      abrirFeedback("erro", "Selecione uma dívida", "Escolha pelo menos um cartão, conta ou boleto para renegociar.");
      return;
    }

    if (etapa === 2) {
      if (!form.dataRenegociacao) {
        abrirFeedback("erro", "Data obrigatória", "Informe a data do acordo.");
        return;
      }

      if (!form.formaPagamento) {
        abrirFeedback("erro", "Forma obrigatória", "Selecione a forma de pagamento do acordo.");
        return;
      }

      if (!form.tipoAcordo) {
        abrirFeedback("erro", "Tipo obrigatório", "Selecione como esse acordo será pago.");
        return;
      }

      if (exigeContaPagamento && !form.contaDebitoId) {
        abrirFeedback("erro", "Conta obrigatória", "Selecione a conta usada no pagamento do acordo.");
        return;
      }

      if (exigeCartaoPagamento && !form.cartaoPagamentoId) {
        abrirFeedback("erro", "Cartão obrigatório", "Selecione o cartão usado no pagamento do acordo.");
        return;
      }

      if (valorRenegociado <= 0) {
        abrirFeedback("erro", "Valor obrigatório", "Informe o valor da renegociação.");
        return;
      }

      if (temEntrada && valorEntrada <= 0) {
        abrirFeedback("erro", "Entrada obrigatória", "Informe o valor da entrada.");
        return;
      }

      if (temEntrada && valorEntrada >= valorRenegociado) {
        abrirFeedback("erro", "Entrada inválida", "A entrada precisa ser menor que o valor da renegociação.");
        return;
      }

      if (temParcelas && Number(form.numeroParcelas || 0) <= 0) {
        abrirFeedback("erro", "Parcelas obrigatórias", "Informe a quantidade de parcelas.");
        return;
      }

      if (!form.primeiroVencimento && valorRenegociado > valorEntrada) {
        abrirFeedback("erro", "Data obrigatória", temParcelas ? "Informe o primeiro vencimento." : "Informe a data de vencimento.");
        return;
      }
    }

    setEtapa((valor) => Math.min(valor + 1, 3));
  }

  async function salvar() {
    if (itensSelecionados.length === 0) {
      abrirFeedback("erro", "Selecione uma dívida", "Escolha pelo menos um item para renegociar.");
      return;
    }

    setSalvando(true);

    try {
      await criarRenegociacao({
        credor: credorAutomatico,
        dataRenegociacao: form.dataRenegociacao,
        formaPagamento: form.formaPagamento,
        contaDebitoId: form.contaDebitoId,
        cartaoPagamentoId: form.cartaoPagamentoId,
        contaAjusteId: form.contaAjusteId || contaNegativaSelecionada?.origem_id || "",
        saldoContaApos: form.saldoContaApos ? moedaParaNumero(form.saldoContaApos) : null,
        valorOriginal,
        valorRenegociado,
        valorEntrada: temEntrada ? valorEntrada : 0,
        numeroParcelas,
        primeiroVencimento: form.primeiroVencimento,
        itens: itensSelecionados,
      });

      onSalvo?.();
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Não foi possível criar a renegociação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo="Nova renegociação"
        descricao="Selecione as dívidas antigas, informe o acordo novo e o ControlDriver gera as parcelas."
        onClose={fechar}
        largura="max-w-5xl"
        confirmarAoFecharSeAlterado
        isDirty={isDirty || Object.values(selecionadas).some((item) => item?.selecionado)}
      >
        <div className="space-y-6">
          <ProgressStepper etapa={etapa} total={3} />

          {etapa === 1 && (
            <div className="space-y-4">
              {carregando ? (
                <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
                  <p className="text-gray-400">Carregando dívidas disponíveis...</p>
                </div>
              ) : origens.length > 0 ? (
                <div className="space-y-4">
                  {origens.map((origem) => {
                    const itensSelecionadosOrigem = origem.itens.filter(
                      (item) => selecionadas[item.chave]?.selecionado
                    );
                    const origemSelecionada = itensSelecionadosOrigem.length > 0;
                    const aberto = Boolean(origensAbertas[origem.chave]);
                    const faturasAtrasadas = origem.itens.filter((item) => item.tipo === "fatura" && estaAtrasada(item.data_referencia));
                    const podeExpandir = origem.tipo === "cartao" && faturasAtrasadas.length > 0;

                    return (
                      <div
                        key={origem.chave}
                        className={`rounded-2xl border transition ${
                          origemSelecionada
                            ? "border-green-400 bg-green-500/10"
                            : "border-gray-800 bg-[#0B1120]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => origemSelecionada ? limparOrigem(origem) : selecionarOrigemTotal(origem)}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${origemSelecionada ? "bg-green-500 text-black" : "bg-[#111827] text-green-400"}`}>
                                {origem.tipo === "cartao" ? <FiCreditCard /> : <FiAlertTriangle />}
                              </div>

                              <div className="min-w-0">
                                <p className="font-black truncate">{origem.titulo}</p>
                                <p className="text-sm text-gray-400 truncate">{origem.detalhe}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {origem.tipo === "cartao"
                                    ? `${origem.itens.length} ${origem.itens.length === 1 ? "fatura em aberto" : "faturas em aberto"}`
                                    : "Saldo negativo"}
                                  {origemSelecionada ? " • selecionado" : ""}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs text-gray-500">{origem.tipo === "cartao" ? "Total em aberto" : "Saldo negativo"}</p>
                              <p className="font-black text-lg">{formatarMoeda(origem.total)}</p>
                            </div>
                          </div>
                        </button>

                        {origem.tipo === "conta_negativa" && origemSelecionada && origem.itens.map((divida) => {
                          const estado = selecionadas[divida.chave] || {};

                          return (
                            <div key={divida.chave} className="px-4 pb-4" onClick={(event) => event.stopPropagation()}>
                              <Campo label="Valor que entra no acordo">
                                <InputMoeda
                                  value={estado.valorParcial || numeroParaMoedaInput(divida.valor_aberto)}
                                  onChange={(valor) => {
                                    atualizarSelecionada(divida.chave, "valorParcial", valor);
                                    atualizarSelecionada(
                                      divida.chave,
                                      "tipoRenegociacao",
                                      moedaParaNumero(valor) >= Number(divida.valor_aberto || 0) ? "total" : "parcial"
                                    );
                                  }}
                                />
                              </Campo>
                            </div>
                          );
                        })}

                        {podeExpandir && (
                          <div className="border-t border-gray-800">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                abrirEscolhaOrigem(origem);
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-sm text-gray-300 hover:text-white font-black"
                            >
                              <span>{aberto ? "Ocultar faturas atrasadas" : "Ver faturas atrasadas"}</span>
                              {aberto ? <FiChevronDown /> : <FiChevronRight />}
                            </button>

                            {aberto && (
                              <div className="px-4 pb-4 space-y-3">
                                {faturasAtrasadas.map((divida) => {
                                  const selecionado = Boolean(selecionadas[divida.chave]?.selecionado);

                                  return (
                                    <button
                                      key={divida.chave}
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        alternarDivida(divida);
                                      }}
                                      className={`w-full rounded-xl border p-3 text-left flex items-start justify-between gap-3 ${
                                        selecionado ? "border-green-400 bg-green-500/10" : "border-gray-800 bg-[#111827]"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className="font-black truncate">{divida.titulo}</p>
                                        <p className="text-sm text-gray-400 truncate">{divida.detalhe}</p>
                                        {divida.data_referencia ? (
                                          <p className="text-xs text-gray-500 mt-1">Vencimento: {formatarDataBR(divida.data_referencia)}</p>
                                        ) : null}
                                      </div>

                                      <div className="text-right shrink-0">
                                        <p className="text-xs text-gray-500">Em aberto</p>
                                        <p className="font-black">{formatarMoeda(divida.valor_aberto)}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-6 text-center">
                  <p className="text-gray-400">Nenhuma dívida disponível para renegociar.</p>
                </div>
              )}
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Data do acordo">
                  <ButtonField onClick={() => setModalData("dataRenegociacao")}>
                    {form.dataRenegociacao ? formatarDataBR(form.dataRenegociacao) : "Selecionar data"}
                  </ButtonField>
                </Campo>

                <Campo label="Forma de pagamento">
                  <ButtonField onClick={() => setModalFormaPagamento(true)}>
                    {form.formaPagamento ? textoFormaPagamento(form.formaPagamento) : "Selecionar forma de pagamento"}
                  </ButtonField>
                </Campo>

                <Campo label="Tipo do acordo">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {tiposAcordo.map((tipo) => (
                      <OpcaoPequena
                        key={tipo.valor}
                        ativo={form.tipoAcordo === tipo.valor}
                        onClick={() => {
                          setField("tipoAcordo", tipo.valor);
                          if (tipo.valor === "avista") {
                            setField("valorEntrada", "");
                            setField("numeroParcelas", "1");
                          }
                          if (tipo.valor === "entrada_avista") {
                            setField("numeroParcelas", "1");
                          }
                          if (tipo.valor === "parcelado") {
                            setField("valorEntrada", "");
                            if (!form.numeroParcelas) setField("numeroParcelas", "2");
                          }
                          if (tipo.valor === "entrada_parcelado" && !form.numeroParcelas) {
                            setField("numeroParcelas", "2");
                          }
                        }}
                      >
                        {tipo.titulo}
                      </OpcaoPequena>
                    ))}
                  </div>
                </Campo>

                <Campo label={exigeCartaoPagamento ? "Cartão" : "Conta"}>
                  <ButtonField
                    onClick={() => {
                      if (exigeCartaoPagamento) setModalCartao(true);
                      else setModalConta(true);
                    }}
                  >
                    {exigeCartaoPagamento
                      ? nomeCartaoSelecionado(cartoesAtivos, form.cartaoPagamentoId) || "Selecionar cartão"
                      : nomeContaSelecionada(contasBanco, form.contaDebitoId) || "Selecionar conta"}
                  </ButtonField>
                </Campo>

                <Campo label="Valor original da dívida">
                  <CampoSomenteLeitura>{formatarMoeda(valorBaseRenegociado)}</CampoSomenteLeitura>
                </Campo>

                <Campo label="Valor da renegociação">
                  <InputMoeda
                    value={form.valorRenegociado || numeroParaMoedaInput(valorBaseRenegociado)}
                    onChange={(valor) => setField("valorRenegociado", valor)}
                  />
                </Campo>

                {temEntrada && (
                  <Campo label="Valor da entrada">
                    <InputMoeda value={form.valorEntrada} onChange={(valor) => setField("valorEntrada", valor)} />
                  </Campo>
                )}

                {temParcelas && (
                  <Campo label="Quantidade de parcelas">
                    <input
                      type="number"
                      min="1"
                      value={form.numeroParcelas}
                      onChange={(event) => setField("numeroParcelas", event.target.value)}
                      placeholder="Ex.: 12"
                      className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
                    />
                  </Campo>
                )}

                <Campo label={temParcelas ? "Primeiro vencimento" : "Data de vencimento"}>
                  <ButtonField onClick={() => setModalData("primeiroVencimento")}>
                    {form.primeiroVencimento ? formatarDataBR(form.primeiroVencimento) : "Selecionar data"}
                  </ButtonField>
                </Campo>

                {valorRenegociado > 0 && valorRenegociado > valorEntrada && (
                  <Campo label={temParcelas ? "Valor da parcela" : "Valor restante"}>
                    <CampoSomenteLeitura>{formatarMoeda(valorParcela)}</CampoSomenteLeitura>
                  </Campo>
                )}
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MiniInfo titulo="Credor" valor={credorAutomatico} />
                <MiniInfo titulo="Data" valor={formatarDataBR(form.dataRenegociacao)} />
                <MiniInfo titulo="Forma" valor={textoFormaPagamento(form.formaPagamento)} />
                <MiniInfo titulo="Tipo" valor={textoTipoAcordo(form.tipoAcordo)} />
                <MiniInfo titulo="Entrada" valor={formatarMoeda(temEntrada ? valorEntrada : 0)} />
                <MiniInfo titulo="Parcelas" valor={temParcelas ? `${numeroParcelas}x de ${formatarMoeda(valorParcela)}` : "À vista"} />
              </div>

              {(contaNegativaSelecionada || possuiCartaoSelecionado) && (
                <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5 space-y-4">
                  {possuiCartaoSelecionado && (
                    <p className="text-sm text-gray-400">As faturas selecionadas serão marcadas como renegociadas. Se o banco liberou ou alterou limite depois do acordo, ajuste o cartão depois no cadastro dele.</p>
                  )}

                  {contaNegativaSelecionada && (
                    <Campo label="Saldo da conta após renegociação">
                      <InputMoeda
                        value={form.saldoContaApos}
                        onChange={(valor) => {
                          setField("saldoContaApos", valor);
                          setField("contaAjusteId", String(contaNegativaSelecionada.origem_id || ""));
                        }}
                      />
                    </Campo>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
                <p className="font-black mb-3">Dívidas incluídas</p>
                <div className="space-y-2">
                  {itensSelecionados.map((item) => (
                    <div key={item.chave} className="flex items-center justify-between gap-3 text-sm border-b border-gray-800 last:border-0 py-2">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{item.titulo}</p>
                        <p className="text-gray-500 truncate">{textoOrigemItem(item.tipo)} • {textoTipoRenegociacao(item.tipo_renegociacao)}</p>
                      </div>
                      <p className="font-black shrink-0">{formatarMoeda(item.valor_renegociado)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 pt-4 pb-1 bg-[#111827]">
            <button
              type="button"
              onClick={() => (etapa === 1 ? fechar() : setEtapa((valor) => Math.max(valor - 1, 1)))}
              disabled={salvando}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3 disabled:opacity-50"
            >
              {etapa === 1 ? "Cancelar" : "Voltar"}
            </button>

            <button
              type="button"
              onClick={etapa === 3 ? salvar : proximo}
              disabled={salvando}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : etapa === 3 ? "Criar renegociação" : "Próximo"}
            </button>
          </div>
        </div>
      </ModalBase>

      {modalData && (
        <DatePickerModal
          aberto={true}
          valor={form[modalData] || hojeISO()}
          onSelecionar={(data) => {
            setField(modalData, data);
            setModalData(null);
          }}
          onClose={() => setModalData(null)}
        />
      )}

      <SelecionarFormaPagamentoModal
        aberto={modalFormaPagamento}
        formasPagamento={formasPagamentoAcordo}
        formaPagamento={form.formaPagamento}
        onSelecionar={(valor) => {
          setField("formaPagamento", valor);
          if (valor === "credito") setField("contaDebitoId", "");
          else setField("cartaoPagamentoId", "");
        }}
        onClose={() => setModalFormaPagamento(false)}
      />

      <SelecionarContaModal
        aberto={modalConta}
        contas={contasBanco}
        contaId={form.contaDebitoId}
        onSelecionar={(id) => setField("contaDebitoId", id)}
        onClose={() => setModalConta(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartao}
        cartoes={cartoesAtivos}
        cartaoId={form.cartaoPagamentoId}
        onSelecionar={(id) => setField("cartaoPagamentoId", id)}
        onClose={() => setModalCartao(false)}
        formatarMoeda={formatarMoeda}
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

function DetalheRenegociacaoModal({ renegociacao, itens, fechar }) {
  return (
    <ModalBase
      aberto={true}
      titulo="Detalhes da renegociação"
      descricao={renegociacao.credor}
      onClose={fechar}
      largura="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MiniInfo titulo="Data" valor={formatarDataBR(renegociacao.data_renegociacao)} />
          <MiniInfo titulo="Forma" valor={textoFormaPagamento(renegociacao.forma_pagamento)} />
          <MiniInfo titulo="Dívida original" valor={formatarMoeda(renegociacao.valor_original)} />
          <MiniInfo titulo="Valor renegociado" valor={formatarMoeda(renegociacao.valor_renegociado)} />
          <MiniInfo titulo="Entrada" valor={formatarMoeda(renegociacao.valor_entrada)} />
          <MiniInfo titulo="Parcelas" valor={`${renegociacao.numero_parcelas || 1}x`} />
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
          <p className="font-black mb-3">Itens renegociados</p>
          {itens.length > 0 ? (
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm border-b border-gray-800 last:border-0 py-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{item.titulo}</p>
                    <p className="text-gray-500 truncate">{textoOrigemItem(item.tipo_origem)} • {textoTipoRenegociacao(item.tipo_renegociacao)}</p>
                  </div>
                  <p className="font-black shrink-0">{formatarMoeda(item.valor_renegociado)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Nenhum item encontrado.</p>
          )}
        </div>

        <button
          type="button"
          onClick={fechar}
          className="w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3"
        >
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}

function ResumoSelecao({ valorOriginal, valorRenegociado }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <ResumoCard titulo="Dívida original selecionada" valor={formatarMoeda(valorOriginal)} destaque="red" />
      <ResumoCard titulo="Base do acordo" valor={formatarMoeda(valorRenegociado)} destaque="yellow" />
    </div>
  );
}

function ResumoCard({ titulo, valor, destaque }) {
  const cores = {
    red: "border-red-500/40 bg-red-500/10 text-red-400",
    yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    green: "border-green-500/40 bg-green-500/10 text-green-400",
  };

  return (
    <div className={`rounded-2xl border p-5 ${cores[destaque] || "border-gray-800 bg-[#111827] text-white"}`}>
      <p className="text-sm text-gray-300">{titulo}</p>
      <p className="text-2xl font-black mt-2">{valor}</p>
    </div>
  );
}

function MiniInfo({ titulo, valor }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{titulo}</p>
      <p className="font-black mt-1 break-words">{valor}</p>
    </div>
  );
}

function definirCredorAutomatico(itens) {
  const nomes = Array.from(new Set((itens || []).map((item) => item.titulo).filter(Boolean)));

  if (nomes.length === 1) return nomes[0];
  if (nomes.length > 1) return nomes.slice(0, 2).join(" + ") + (nomes.length > 2 ? ` +${nomes.length - 2}` : "");

  return "Renegociação";
}

function nomeContaSelecionada(contas, contaId) {
  const conta = (contas || []).find((item) => String(item.id) === String(contaId));
  return conta?.nome || "";
}

function nomeCartaoSelecionado(cartoes, cartaoId) {
  const cartao = (cartoes || []).find((item) => String(item.id) === String(cartaoId));
  return cartao?.nome || "";
}

function textoTipoAcordo(tipo) {
  const textos = {
    avista: "À vista",
    entrada_avista: "Entrada + à vista",
    parcelado: "Só parcelas",
    entrada_parcelado: "Entrada + parcelas",
  };

  return textos[tipo] || "-";
}

function estaAtrasada(data) {
  if (!data) return false;

  return String(data).slice(0, 10) < hojeISO();
}

function agruparDividasPorOrigem(dividas) {
  const mapa = new Map();

  dividas.forEach((divida) => {
    const original = divida.original || {};
    const cartao = original.cartoes || original.cartao || {};
    const conta = original.contas || original.conta || {};
    const cartaoId = original.cartao_id || cartao.id || divida.cartao_id || divida.origem_id;
    const contaId = original.conta_id || conta.id || original.id || divida.conta_id || divida.origem_id;

    let chave;
    let tipo;
    let titulo;
    let detalhe;

    if (divida.tipo === "fatura") {
      chave = `cartao-${cartaoId || cartao.nome || divida.detalhe || divida.titulo}`;
      tipo = "cartao";
      titulo = cartao.nome || divida.nome_cartao || divida.cartao_nome || divida.detalhe || "Cartão";
      detalhe = cartao.tipo_cartao === "terceiro" ? "Cartão de terceiro" : "Cartão de crédito";
    } else if (divida.tipo === "conta_negativa") {
      chave = `conta-negativa-${contaId || divida.titulo}`;
      tipo = "conta_negativa";
      titulo = conta.nome || divida.nome_conta || divida.titulo || "Conta";
      detalhe = "Conta com saldo negativo";
    } else {
      chave = `conta-pagar-${contaId || divida.origem_id || divida.titulo}`;
      tipo = "conta";
      titulo = conta.nome || divida.nome_conta || divida.titulo || "Conta a pagar";
      detalhe = divida.detalhe || "Boleto/conta em aberto";
    }

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        tipo,
        titulo,
        detalhe,
        itens: [],
        total: 0,
      });
    }

    const origem = mapa.get(chave);
    origem.itens.push(divida);
    origem.total += Number(divida.valor_aberto || 0);
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const ordem = { cartao: 1, conta_negativa: 2, conta: 3 };
    return (ordem[a.tipo] || 9) - (ordem[b.tipo] || 9) || a.titulo.localeCompare(b.titulo);
  });
}

function ProgressStepper({ etapa, total }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`h-2 rounded-full ${index + 1 <= etapa ? "bg-green-400" : "bg-gray-800"}`}
        />
      ))}
    </div>
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

function CampoSomenteLeitura({ children }) {
  return (
    <div className="w-full mt-2 bg-[#0B1120] border border-gray-800 rounded-xl p-3 font-black text-gray-200">
      {children}
    </div>
  );
}

function InputTexto({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
    />
  );
}

function InputMoeda({ value, onChange, disabled = false }) {
  return (
    <div className={`flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden ${disabled ? "opacity-60" : ""}`}>
      <span className="px-3 text-gray-400">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(formatarMoedaDigitada(event.target.value))}
        className="w-full bg-transparent p-3 outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

function OpcaoPequena({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 font-black text-sm transition ${
        ativo
          ? "border-green-400 bg-green-500/10 text-green-400"
          : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
