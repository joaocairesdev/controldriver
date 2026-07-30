import { useEffect, useMemo, useState } from "react";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import ParcelasContrato from "../../../shared/components/financeiro/ParcelasContrato";
import ResumoContrato from "../../../shared/components/financeiro/ResumoContrato";
import TelaParcelaContrato, { CabecalhoVoltar } from "../../../shared/components/financeiro/TelaParcelaContrato";
import {
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
  FiCreditCard,
  FiInfo,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";

import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import ConfirmacaoModal from "../../../shared/components/modals/ConfirmacaoModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarParcelasModal from "../../../shared/components/modals/SelecionarParcelasModal";
import SelecionarTipoAcordoModal from "../components/SelecionarTipoAcordoModal";
import ToggleSwitch from "../../../shared/components/ui/ToggleSwitch";
import useDirtyForm from "../../../shared/hooks/useDirtyForm";
import RegistrarPagamentoModal from "../../contas/components/RegistrarPagamentoModal";

import {
  atualizarParcelaRenegociacao,
  carregarContasComSaldo,
  carregarDividasDisponiveis,
  carregarItensRenegociacao,
  carregarRenegociacoes,
  criarRenegociacao,
  excluirRenegociacao,
  editarRenegociacao,
} from "../services/renegociacoesService";
import {
  formatarDataBR,
  formatarMoeda,
  formatarMoedaDigitada,
  hojeISO,
  moedaParaNumero,
  normalizarProdutosRenegociados,
  numeroParaMoedaInput,
  textoFormaPagamento,
} from "../utils/renegociacoesUtils";

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
  valorParcela: "",
  numeroParcelas: "",
  primeiroVencimento: "",
};

export default function Renegociacoes() {
  const [renegociacoes, setRenegociacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [renegociacaoDetalhe, setRenegociacaoDetalhe] = useState(null);
  const [parcelaDetalhe, setParcelaDetalhe] = useState(null);
  const [itensDetalhe, setItensDetalhe] = useState([]);
  const [contasPagamento, setContasPagamento] = useState([]);
  const [parcelaPagamento, setParcelaPagamento] = useState(null);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setCarregando(true);

    try {
      const [dados, contas] = await Promise.all([
        carregarRenegociacoes(),
        carregarContasComSaldo(),
      ]);
      setRenegociacoes(dados);
      setContasPagamento((contas || []).filter((conta) => conta.tipo_conta !== "tag"));
      setRenegociacaoDetalhe((atual) =>
        atual ? dados.find((item) => String(item.id) === String(atual.id)) || null : null
      );
      setParcelaDetalhe((atual) => {
        if (!atual) return null;
        const acordo = dados.find((item) => String(item.id) === String(atual.renegociacaoId));
        const parcela = acordo?.parcelas.find((item) => String(item.id) === String(atual.id));
        return parcela ? { ...parcela, renegociacaoId: acordo.id } : null;
      });
      return dados;
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
  const produtosDetalhe = useMemo(
    () => normalizarProdutosRenegociados(itensDetalhe),
    [itensDetalhe]
  );

  return (
    <div>
      {!renegociacaoDetalhe && (
        <>
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

              <div className="mt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Valor total</p>
                    <p className="text-2xl font-black mt-1">{formatarMoeda(renegociacao.valor_renegociado)}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {Math.max(Number(renegociacao.numero_parcelas || 1), 1)}x de {formatarMoeda(Number(renegociacao.valor_renegociado || 0) / Math.max(Number(renegociacao.numero_parcelas || 1), 1))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Acordo em</p>
                    <p className="font-bold">{formatarDataBR(renegociacao.data_renegociacao)}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min((Number(renegociacao.parcelas_pagas || 0) / Math.max(Number(renegociacao.numero_parcelas || 1), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                    <p className="text-gray-400">{renegociacao.parcelas_pagas || 0} de {renegociacao.numero_parcelas || 1} parcelas pagas</p>
                    <p className="font-bold">Restante: {formatarMoeda(renegociacao.saldo_devedor)}</p>
                  </div>
                </div>

                {renegociacao.proximo_vencimento && (
                  <div className="mt-4 rounded-xl border border-gray-800 bg-[#0B1120] px-4 py-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-400">Próxima parcela</span>
                    <span className="font-black">{formatarMoeda(renegociacao.proxima_parcela_valor)} em {formatarDataBR(renegociacao.proximo_vencimento)}</span>
                  </div>
                )}
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
        </>
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

      {renegociacaoDetalhe && parcelaDetalhe ? (
        <TelaParcelaContrato
          parcela={parcelaDetalhe}
          itensBase={produtosDetalhe.map((produto) => ({
            id: produto.id,
            nome: produto.titulo,
            valor: produto.valor,
          }))}
          nomePadrao={renegociacaoDetalhe.credor}
          onVoltar={() => setParcelaDetalhe(null)}
          onSalvarItem={async (parcela, itemId, ajuste) => {
            const itensBase = produtosDetalhe.map((produto) => ({
              id: produto.id,
              nome: produto.titulo,
              valor: produto.valor,
            }));
            await atualizarParcelaRenegociacao(
              parcela,
              itemId,
              ajuste,
              itensBase,
              renegociacaoDetalhe.credor
            );
            await carregarTudo();
            abrirFeedback("sucesso", "Item atualizado", "O valor da parcela e a Conta a Pagar foram atualizados sem recalcular o acordo.");
          }}
          onPagar={(parcela) => setParcelaPagamento(parcela.cobranca)}
        />
      ) : renegociacaoDetalhe ? (
        <TelaRenegociacao
          renegociacao={renegociacaoDetalhe}
          produtos={produtosDetalhe}
          fechar={() => {
            setRenegociacaoDetalhe(null);
            setItensDetalhe([]);
          }}
          onSelecionarParcela={(parcela) => setParcelaDetalhe({ ...parcela, renegociacaoId: renegociacaoDetalhe.id })}
          onExcluido={async () => {
            setRenegociacaoDetalhe(null);
            setItensDetalhe([]);
            await carregarTudo();
            abrirFeedback("sucesso", "Renegociação excluída", "O acordo foi removido e as dívidas originais foram restauradas.");
          }}
          onAtualizado={async (renegociacaoAtualizada) => {
            setRenegociacaoDetalhe(renegociacaoAtualizada);
            const itens = await carregarItensRenegociacao(renegociacaoAtualizada.id);
            setItensDetalhe(itens);
            await carregarTudo();
            abrirFeedback("sucesso", "Renegociação atualizada", "As informações do acordo foram atualizadas.");
          }}
        />
      ) : null}

      {parcelaPagamento && (
        <RegistrarPagamentoModal
          aberto
          contaPagar={parcelaPagamento}
          contas={contasPagamento}
          saldoContaPagar={(conta) => Math.max(Number(conta?.valor_total || 0) - Number(conta?.valor_pago || 0), 0)}
          onClose={() => setParcelaPagamento(null)}
          onSalvo={async () => {
            setParcelaPagamento(null);
            await carregarTudo();
            abrirFeedback("sucesso", "Pagamento registrado", "O valor efetivamente pago foi registrado no Extrato e a parcela foi atualizada.");
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
  const [modalTipoAcordo, setModalTipoAcordo] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalCartao, setModalCartao] = useState(false);
  const [modalParcelas, setModalParcelas] = useState(false);
  const [dadosItens, setDadosItens] = useState({});
  const [infoValorBancoAberto, setInfoValorBancoAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const { form, setField, isDirty } = useDirtyForm(FORM_INICIAL);

  useEffect(() => {
    carregarBase();
  }, []);

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

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

  const valorRenegociado = moedaParaNumero(form.valorRenegociado);
  const valorEntrada = moedaParaNumero(form.valorEntrada);
  const numeroParcelas = temParcelas ? Math.max(Number(form.numeroParcelas || 1), 1) : 1;
  const valorParcelaInformado = moedaParaNumero(form.valorParcela);
  const valorParcela = temParcelas
    ? valorParcelaInformado || Math.max(valorRenegociado - valorEntrada, 0) / numeroParcelas
    : Math.max(valorRenegociado - valorEntrada, 0);
  const contaNegativaSelecionada = itensSelecionados.find((item) => item.tipo === "conta_negativa");
  const possuiCartaoSelecionado = itensSelecionados.some((item) => item.tipo === "fatura");
  const credorAutomatico = definirCredorAutomatico(itensSelecionados);
  const gruposSelecionados = useMemo(() => agruparItensContrato(itensSelecionados), [itensSelecionados]);
  const totalItensControlDriver = gruposSelecionados.reduce((total, grupo) => total + grupo.totalOriginal, 0);
  const totalAcordoItens = gruposSelecionados.reduce(
    (total, grupo) => total + moedaParaNumero(dadosItens[grupo.chave]?.valorTotal),
    0
  );
  const totalConsideradoBanco = gruposSelecionados.reduce(
    (total, grupo) => total + moedaParaNumero(dadosItens[grupo.chave]?.valorBanco),
    0
  );
  const parcelaTotalItens = gruposSelecionados.reduce(
    (total, grupo) => total + moedaParaNumero(dadosItens[grupo.chave]?.valorParcela),
    0
  );
  const custoEstimado = totalConsideradoBanco > 0 ? totalAcordoItens - totalConsideradoBanco : null;

  function atualizarDadoItem(chave, campo, valor) {
    limparErro(`item-${chave}-${campo}`);
    setDadosItens((atual) => ({
      ...atual,
      [chave]: {
        ...(atual[chave] || {}),
        [campo]: valor,
      },
    }));
  }

  function itensComDadosContrato() {
    return gruposSelecionados.flatMap((grupo) => {
      const dados = dadosItens[grupo.chave] || {};
      const totalOriginalGrupo = Math.max(grupo.totalOriginal, 0);
      const valorBancoGrupo = moedaParaNumero(dados.valorBanco);
      const valorTotalGrupo = moedaParaNumero(dados.valorTotal);
      const valorParcelaGrupo = moedaParaNumero(dados.valorParcela);

      return grupo.itens.map((item, indice) => {
        const peso = totalOriginalGrupo > 0
          ? Number(item.valor_aberto || 0) / totalOriginalGrupo
          : indice === 0 ? 1 : 0;

        return {
          ...item,
          valor_renegociado: valorBancoGrupo > 0 ? valorBancoGrupo * peso : Number(item.valor_aberto || 0),
          valor_considerado_banco: valorBancoGrupo > 0 ? valorBancoGrupo * peso : null,
          valor_total_acordo: valorTotalGrupo * peso,
          valor_parcela_acordo: valorParcelaGrupo * peso,
          saldo_apos_acordo: grupo.tipo === "conta_negativa" ? moedaParaNumero(dados.saldoApos) : null,
          ajustar_limite: grupo.tipo === "cartao" ? Boolean(dados.ajustarLimite) : false,
          novo_limite_total: grupo.tipo === "cartao" && dados.ajustarLimite
            ? moedaParaNumero(dados.novoLimite)
            : null,
          limite_anterior: grupo.limiteAnterior,
          grupo_acordo: grupo.chave,
        };
      });
    });
  }

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
    limparErro("dividas");
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
    limparErro("dividas");
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
    limparErro("dividas");
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

  function selecionarTipoAcordo(tipo) {
    setField("tipoAcordo", tipo);

    if (tipo === "avista") {
      setField("valorEntrada", "");
      setField("valorParcela", "");
      setField("numeroParcelas", "1");
    }

    if (tipo === "entrada_avista") {
      setField("numeroParcelas", "1");
    }

    if (tipo === "parcelado") {
      setField("valorEntrada", "");
      if (!form.numeroParcelas) setField("numeroParcelas", "2");
    }

    if (tipo === "entrada_parcelado" && !form.numeroParcelas) {
      setField("numeroParcelas", "2");
    }
  }

  function atualizarValorTotalRenegociado(valor) {
    setField("valorRenegociado", valor);

    if (!temParcelas || !numeroParcelas) return;

    const total = moedaParaNumero(valor);
    const parcela = Math.max(total - valorEntrada, 0) / numeroParcelas;
    setField("valorParcela", numeroParaMoedaInput(parcela));
  }

  function atualizarValorParcelaRenegociada(valor) {
    setField("valorParcela", valor);

    if (!temParcelas || !numeroParcelas) return;

    const parcela = moedaParaNumero(valor);
    const total = valorEntrada + parcela * numeroParcelas;
    setField("valorRenegociado", numeroParaMoedaInput(total));
  }

  function atualizarValorEntrada(valor) {
    setField("valorEntrada", valor);

    if (!temParcelas || !numeroParcelas) return;

    const entrada = moedaParaNumero(valor);
    const parcelaAtual = moedaParaNumero(form.valorParcela);
    const totalAtual = moedaParaNumero(form.valorRenegociado);

    if (parcelaAtual > 0) {
      setField("valorRenegociado", numeroParaMoedaInput(entrada + parcelaAtual * numeroParcelas));
      return;
    }

    if (totalAtual > 0) {
      setField("valorParcela", numeroParaMoedaInput(Math.max(totalAtual - entrada, 0) / numeroParcelas));
    }
  }

  function atualizarQuantidadeParcelas(numero) {
    setField("numeroParcelas", numero);

    const parcelas = Math.max(Number(numero || 1), 1);
    const parcelaAtual = moedaParaNumero(form.valorParcela);
    const totalAtual = moedaParaNumero(form.valorRenegociado);

    if (parcelaAtual > 0) {
      setField("valorRenegociado", numeroParaMoedaInput(valorEntrada + parcelaAtual * parcelas));
      return;
    }

    if (totalAtual > 0) {
      setField("valorParcela", numeroParaMoedaInput(Math.max(totalAtual - valorEntrada, 0) / parcelas));
    }
  }

  function proximo() {
    if (etapa === 1 && itensSelecionados.length === 0) {
      setErros({ dividas: "Escolha pelo menos um cartão ou uma conta para renegociar." });
      setShakeKey(Date.now());
      return;
    }

    if (etapa === 2) {
      const novos = {};
      if (!form.dataRenegociacao) novos.dataRenegociacao = "Informe a data do acordo.";
      if (!form.formaPagamento) novos.formaPagamento = "Selecione a forma de pagamento do acordo.";
      if (!form.tipoAcordo) novos.tipoAcordo = "Selecione como esse acordo será pago.";
      if (exigeContaPagamento && !form.contaDebitoId) novos.contaDebitoId = "Selecione a conta usada no pagamento.";
      if (exigeCartaoPagamento && !form.cartaoPagamentoId) novos.cartaoPagamentoId = "Selecione o cartão usado no pagamento.";
      gruposSelecionados.forEach((grupo) => {
        if (moedaParaNumero(dadosItens[grupo.chave]?.valorTotal) <= 0) novos[`item-${grupo.chave}-valorTotal`] = "Informe o valor total deste item.";
        if (temParcelas && moedaParaNumero(dadosItens[grupo.chave]?.valorParcela) <= 0) novos[`item-${grupo.chave}-valorParcela`] = "Informe o valor da parcela deste item.";
      });
      if (temEntrada && valorEntrada <= 0) novos.valorEntrada = "Informe o valor da entrada.";
      else if (temEntrada && valorEntrada >= totalAcordoItens) novos.valorEntrada = "A entrada precisa ser menor que o valor total.";
      if (temParcelas && Number(form.numeroParcelas || 0) <= 0) novos.numeroParcelas = "Informe a quantidade de parcelas.";
      if (!form.primeiroVencimento && totalAcordoItens > valorEntrada) novos.primeiroVencimento = temParcelas ? "Informe o primeiro vencimento." : "Informe a data de vencimento.";
      else if (form.primeiroVencimento && form.dataRenegociacao && form.primeiroVencimento < form.dataRenegociacao) novos.primeiroVencimento = "O vencimento não pode ser anterior à data do acordo.";
      setErros(novos);
      if (Object.keys(novos).length) {
        setShakeKey(Date.now());
        return;
      }
    }

    setErros({});
    setEtapa((valor) => Math.min(valor + 1, 3));
  }

  async function salvar() {
    setSalvando(true);

    try {
      await criarRenegociacao({
        credor: credorAutomatico,
        dataRenegociacao: form.dataRenegociacao,
        formaPagamento: form.formaPagamento,
        contaDebitoId: form.contaDebitoId,
        cartaoPagamentoId: form.cartaoPagamentoId,
        contaAjusteId: form.contaAjusteId || contaNegativaSelecionada?.origem_id || "",
        saldoContaApos: (() => {
          const grupoConta = gruposSelecionados.find((grupo) => grupo.tipo === "conta_negativa");
          return grupoConta ? moedaParaNumero(dadosItens[grupoConta.chave]?.saldoApos) : null;
        })(),
        valorOriginal: totalItensControlDriver,
        valorRenegociado: totalAcordoItens,
        valorEntrada: temEntrada ? valorEntrada : 0,
        numeroParcelas,
        primeiroVencimento: form.primeiroVencimento,
        itens: itensComDadosContrato(),
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
        scrollKey={etapa}
        confirmarAoFecharSeAlterado
        isDirty={isDirty || Object.values(selecionadas).some((item) => item?.selecionado)}
      >
        <div className="space-y-6">
          <ProgressStepper etapa={etapa} total={3} />

          {etapa === 1 && (
            <div key={erros.dividas ? shakeKey : "ok"} className={`space-y-4 ${erros.dividas ? "animate-shake" : ""}`}>
              {erros.dividas && <p className="rounded-xl border border-red-500 bg-red-500/10 p-3 text-sm font-semibold text-red-400">{erros.dividas}</p>}
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
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Data do acordo" erro={erros.dataRenegociacao} shakeKey={shakeKey}>
                  <ButtonField erro={erros.dataRenegociacao} shakeKey={shakeKey} onClick={() => setModalData("dataRenegociacao")}>
                    {form.dataRenegociacao ? formatarDataBR(form.dataRenegociacao) : "Selecionar data"}
                  </ButtonField>
                </Campo>

                <Campo label="Tipo do acordo" erro={erros.tipoAcordo} shakeKey={shakeKey}>
                  <ButtonField erro={erros.tipoAcordo} shakeKey={shakeKey} onClick={() => setModalTipoAcordo(true)}>
                    {form.tipoAcordo ? textoTipoAcordo(form.tipoAcordo) : "Selecionar tipo do acordo"}
                  </ButtonField>
                </Campo>

                <Campo label="Forma de pagamento" erro={erros.formaPagamento} shakeKey={shakeKey}>
                  <ButtonField erro={erros.formaPagamento} shakeKey={shakeKey} onClick={() => setModalFormaPagamento(true)}>
                    {form.formaPagamento ? textoFormaPagamento(form.formaPagamento) : "Selecionar forma de pagamento"}
                  </ButtonField>
                </Campo>

                <Campo label={exigeCartaoPagamento ? "Cartão" : "Conta"} erro={exigeCartaoPagamento ? erros.cartaoPagamentoId : erros.contaDebitoId} shakeKey={shakeKey}>
                  <ButtonField erro={exigeCartaoPagamento ? erros.cartaoPagamentoId : erros.contaDebitoId} shakeKey={shakeKey} onClick={() => exigeCartaoPagamento ? setModalCartao(true) : setModalConta(true)}>
                    {exigeCartaoPagamento
                      ? nomeCartaoSelecionado(cartoesAtivos, form.cartaoPagamentoId) || "Selecionar cartão"
                      : nomeContaSelecionada(contasBanco, form.contaDebitoId) || "Selecionar conta"}
                  </ButtonField>
                </Campo>

                {temEntrada && (
                  <Campo label="Entrada" erro={erros.valorEntrada} shakeKey={shakeKey}>
                    <InputMoeda erro={erros.valorEntrada} shakeKey={shakeKey} value={form.valorEntrada} onChange={(valor) => { limparErro("valorEntrada"); atualizarValorEntrada(valor); }} />
                  </Campo>
                )}

                {temParcelas && (
                  <Campo label="Quantidade de parcelas" erro={erros.numeroParcelas} shakeKey={shakeKey}>
                    <ButtonField erro={erros.numeroParcelas} shakeKey={shakeKey} onClick={() => setModalParcelas(true)}>
                      {form.numeroParcelas ? `${form.numeroParcelas}x` : "Selecionar parcelas"}
                    </ButtonField>
                  </Campo>
                )}

                <Campo label={temParcelas ? "Primeiro vencimento" : "Data de vencimento"} erro={erros.primeiroVencimento} shakeKey={shakeKey}>
                  <ButtonField erro={erros.primeiroVencimento} shakeKey={shakeKey} onClick={() => setModalData("primeiroVencimento")}>
                    {form.primeiroVencimento ? formatarDataBR(form.primeiroVencimento) : "Selecionar data"}
                  </ButtonField>
                </Campo>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-green-400">Itens em acordo</p>
                  <p className="text-sm text-gray-400 mt-1">Informe os dados de cada operação do contrato.</p>
                </div>
                <p className="text-xl font-black text-green-400 shrink-0">{formatarMoeda(totalAcordoItens)}</p>
              </div>

              <div className="space-y-4">
                {gruposSelecionados.map((grupo) => {
                  const dados = dadosItens[grupo.chave] || {};
                  return (
                    <div key={grupo.chave} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black text-lg">{grupo.titulo}</p>
                          <p className="text-sm text-gray-500">{grupo.detalhe}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">No ControlDriver</p>
                          <p className="font-black">{formatarMoeda(grupo.tipo === "conta_negativa" ? -grupo.totalOriginal : grupo.totalOriginal)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Campo label={
                          <span className="inline-flex items-center gap-2">
                            Valor considerado pelo banco
                            <button type="button" onClick={() => setInfoValorBancoAberto(true)} className="text-green-400 hover:text-green-300" aria-label="O que é o valor considerado pelo banco?">
                              <FiInfo />
                            </button>
                          </span>
                        }>
                          <InputMoeda value={dados.valorBanco || ""} onChange={(valor) => atualizarDadoItem(grupo.chave, "valorBanco", valor)} />
                        </Campo>

                        {temParcelas && (
                          <Campo label="Valor da parcela" erro={erros[`item-${grupo.chave}-valorParcela`]} shakeKey={shakeKey}>
                            <InputMoeda erro={erros[`item-${grupo.chave}-valorParcela`]} shakeKey={shakeKey} value={dados.valorParcela || ""} onChange={(valor) => {
                              atualizarDadoItem(grupo.chave, "valorParcela", valor);
                              if (numeroParcelas > 0) atualizarDadoItem(grupo.chave, "valorTotal", numeroParaMoedaInput(moedaParaNumero(valor) * numeroParcelas));
                            }} />
                          </Campo>
                        )}

                        <Campo label="Valor total" erro={erros[`item-${grupo.chave}-valorTotal`]} shakeKey={shakeKey}>
                          <InputMoeda erro={erros[`item-${grupo.chave}-valorTotal`]} shakeKey={shakeKey} value={dados.valorTotal || ""} onChange={(valor) => {
                            atualizarDadoItem(grupo.chave, "valorTotal", valor);
                            if (temParcelas && numeroParcelas > 0) atualizarDadoItem(grupo.chave, "valorParcela", numeroParaMoedaInput(moedaParaNumero(valor) / numeroParcelas));
                          }} />
                        </Campo>

                        {grupo.tipo === "conta_negativa" && (
                          <Campo label="Saldo da conta após o acordo">
                            <InputMoeda value={dados.saldoApos || ""} onChange={(valor) => atualizarDadoItem(grupo.chave, "saldoApos", valor)} />
                          </Campo>
                        )}
                      </div>

                      {grupo.tipo === "cartao" && (
                        <div className="rounded-xl border border-gray-800 bg-[#111827] p-4 space-y-3">
                          <label className="flex items-center justify-between gap-4 cursor-pointer">
                            <div>
                              <p className="font-bold">O limite do cartão foi alterado?</p>
                              <p className="text-sm text-gray-500">Limite anterior: {formatarMoeda(grupo.limiteAnterior)}</p>
                            </div>
                            <ToggleSwitch
                              ativo={Boolean(dados.ajustarLimite)}
                              onChange={(ativo) => atualizarDadoItem(grupo.chave, "ajustarLimite", ativo)}
                              ariaLabel="Informar alteração do limite do cartão"
                            />
                          </label>
                          {dados.ajustarLimite && (
                            <Campo label="Novo limite">
                              <InputMoeda value={dados.novoLimite || ""} onChange={(valor) => atualizarDadoItem(grupo.chave, "novoLimite", valor)} />
                            </Campo>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {etapa === 3 && (
            <ResumoResultadoAcordo
              grupos={gruposSelecionados}
              dadosItens={dadosItens}
              numeroParcelas={numeroParcelas}
              temParcelas={temParcelas}
              totalAcordo={totalAcordoItens}
              parcelaTotal={parcelaTotalItens}
              totalConsideradoBanco={totalConsideradoBanco}
              custoEstimado={custoEstimado}
            />
          )}

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 pt-4 pb-1 bg-[#111827]">
            <button
              type="button"
              onClick={() => {
                if (etapa === 1) {
                  fechar();
                  return;
                }
                setErros({});
                setEtapa((valor) => Math.max(valor - 1, 1));
              }}
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
          valor={form[modalData] || ""}
          minDate={modalData === "primeiroVencimento" ? form.dataRenegociacao || null : null}
          maxDate={modalData === "dataRenegociacao" ? hojeISO() : null}
          onChange={(data) => {
            limparErro(modalData);
            setField(modalData, data);
            if (modalData === "dataRenegociacao" && form.primeiroVencimento && form.primeiroVencimento < data) {
              setField("primeiroVencimento", "");
            }
            setModalData(null);
          }}
          onClose={() => setModalData(null)}
        />
      )}

      <SelecionarTipoAcordoModal
        aberto={modalTipoAcordo}
        tipoAcordo={form.tipoAcordo}
        onSelecionar={(valor) => { limparErro("tipoAcordo"); selecionarTipoAcordo(valor); }}
        onClose={() => setModalTipoAcordo(false)}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaPagamento}
        formasPagamento={formasPagamentoAcordo}
        formaPagamento={form.formaPagamento}
        onSelecionar={(valor) => {
          limparErro("formaPagamento");
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
        onSelecionar={(id) => { limparErro("contaDebitoId"); setField("contaDebitoId", id); }}
        onClose={() => setModalConta(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartao}
        cartoes={cartoesAtivos}
        cartaoId={form.cartaoPagamentoId}
        onSelecionar={(id) => { limparErro("cartaoPagamentoId"); setField("cartaoPagamentoId", id); }}
        onClose={() => setModalCartao(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarParcelasModal
        aberto={modalParcelas}
        numeroParcelas={form.numeroParcelas}
        onSelecionar={(valor) => { limparErro("numeroParcelas"); atualizarQuantidadeParcelas(valor); }}
        onClose={() => setModalParcelas(false)}
      />

      <FeedbackModal
        aberto={infoValorBancoAberto}
        tipo="aviso"
        titulo="Valor considerado pelo banco"
        mensagem="É o saldo que a instituição usou como base para este item no contrato. Pode ser diferente do ControlDriver por juros, multas, encargos, pagamentos ou créditos anteriores. Normalmente aparece no contrato definitivo. Se você não encontrar, deixe em branco."
        onClose={() => setInfoValorBancoAberto(false)}
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

function TelaRenegociacao({ renegociacao, produtos, fechar, onExcluido, onAtualizado, onSelecionarParcela }) {
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  const tipoAcordo = definirTipoAcordoRenegociacao(renegociacao);
  const temParcelas = ["parcelado", "entrada_parcelado"].includes(tipoAcordo);
  const valorEntrada = Number(renegociacao.valor_entrada || 0);
  const numeroParcelas = temParcelas ? Math.max(Number(renegociacao.numero_parcelas || 1), 1) : 1;
  const valorParcelas = temParcelas
    ? Math.max(Number(renegociacao.valor_renegociado || 0) - valorEntrada, 0) / numeroParcelas
    : 0;
  const proximaParcela = (renegociacao.parcelas || []).find(
    (parcela) => !["paga", "pago"].includes(String(parcela.status || "").toLowerCase())
  );

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  async function confirmarExcluirRenegociacao() {
    setExcluindo(true);

    try {
      await excluirRenegociacao(renegociacao.id);
      setConfirmarExclusao(false);
      await onExcluido?.();
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao excluir",
        error.message || "Não foi possível excluir a renegociação e restaurar as dívidas originais."
      );
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
      <div>
        <CabecalhoVoltar
          voltar={fechar}
          titulo={renegociacao.credor}
          descricao="Renegociação"
          acoes={
          <>
            <button
              type="button"
              onClick={() => setModalEdicaoAberto(true)}
              disabled={excluindo}
              className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 text-white font-bold flex items-center justify-center disabled:opacity-50"
              aria-label="Editar renegociação"
              title="Editar renegociação"
            >
              <FiEdit2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setConfirmarExclusao(true)}
              disabled={excluindo}
              className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 text-white font-bold flex items-center justify-center disabled:opacity-50"
              aria-label="Excluir renegociação"
              title="Excluir renegociação"
            >
              <FiTrash2 className="w-5 h-5" />
            </button>
          </>
          }
        />
        <ResumoContrato
          titulo="Resumo da renegociação"
          hierarquico
          itens={[
          { titulo: "Produtos renegociados", valor: produtos.map((produto) => produto.titulo) },
          { titulo: "Saldo renegociado", valor: formatarMoeda(renegociacao.valor_renegociado), principal: true },
          { titulo: "Saldo devedor", valor: formatarMoeda(renegociacao.saldo_devedor), destaque: true, principal: true },
          { titulo: "Parcelas", valor: `${Math.max(numeroParcelas - Number(renegociacao.parcelas_pagas || 0), 0)} de ${numeroParcelas} restantes`, principal: true },
          { titulo: "Valor da parcela", valor: formatarMoeda(proximaParcela?.valorAtualizado ?? valorParcelas ?? renegociacao.valor_renegociado), principal: true },
          { titulo: "Data do acordo", valor: formatarDataBR(renegociacao.data_renegociacao) },
          { titulo: "Forma de pagamento", valor: textoFormaPagamento(renegociacao.forma_pagamento) },
          { titulo: "Tipo do acordo", valor: textoTipoAcordo(tipoAcordo) },
        ]}
        />
        <ParcelasContrato parcelas={renegociacao.parcelas || []} onSelecionar={onSelecionarParcela} />
      </div>

      {modalEdicaoAberto && (
        <EditarRenegociacaoModal
          renegociacao={renegociacao}
          fechar={() => setModalEdicaoAberto(false)}
          onSalvo={async (renegociacaoAtualizada) => {
            setModalEdicaoAberto(false);
            await onAtualizado?.(renegociacaoAtualizada);
          }}
        />
      )}

      <ConfirmacaoModal
        aberto={confirmarExclusao}
        tipo="perigo"
        titulo="Excluir renegociação?"
        mensagem="Isso vai remover o acordo novo, apagar as parcelas geradas pela renegociação e restaurar as dívidas originais."
        textoCancelar="Cancelar"
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir"}
        carregando={excluindo}
        onCancelar={() => setConfirmarExclusao(false)}
        onConfirmar={confirmarExcluirRenegociacao}
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

function EditarRenegociacaoModal({ renegociacao, fechar, onSalvo }) {
  const tipoInicial = definirTipoAcordoRenegociacao(renegociacao);
  const valorEntradaInicial = Number(renegociacao.valor_entrada || 0);
  const numeroParcelasInicial = Math.max(Number(renegociacao.numero_parcelas || 1), 1);
  const valorParcelaInicial = ["parcelado", "entrada_parcelado"].includes(tipoInicial)
    ? Math.max(Number(renegociacao.valor_renegociado || 0) - valorEntradaInicial, 0) / numeroParcelasInicial
    : 0;

  const [contas, setContas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [modalFormaPagamento, setModalFormaPagamento] = useState(false);
  const [modalTipoAcordo, setModalTipoAcordo] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalCartao, setModalCartao] = useState(false);
  const [modalParcelas, setModalParcelas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const { form, setField, isDirty } = useDirtyForm({
    ...FORM_INICIAL,
    dataRenegociacao: renegociacao.data_renegociacao || "",
    formaPagamento: renegociacao.forma_pagamento || "",
    tipoAcordo: tipoInicial,
    contaDebitoId: renegociacao.conta_debito_id ? String(renegociacao.conta_debito_id) : "",
    cartaoPagamentoId: renegociacao.cartao_pagamento_id ? String(renegociacao.cartao_pagamento_id) : "",
    valorRenegociado: numeroParaMoedaInput(renegociacao.valor_renegociado || 0),
    valorEntrada: valorEntradaInicial > 0 ? numeroParaMoedaInput(valorEntradaInicial) : "",
    valorParcela: valorParcelaInicial > 0 ? numeroParaMoedaInput(valorParcelaInicial) : "",
    numeroParcelas: String(numeroParcelasInicial),
    primeiroVencimento: renegociacao.primeiro_vencimento || "",
  });

  useEffect(() => {
    async function carregarBaseEdicao() {
      try {
        const dados = await carregarDividasDisponiveis();
        setContas(dados.contas || []);
        setCartoes(dados.cartoes || []);
      } catch (error) {
        console.error(error);
        abrirFeedback("erro", "Erro ao carregar", error.message || "Não foi possível carregar contas e cartões.");
      }
    }

    carregarBaseEdicao();
  }, []);

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
  const exigeContaPagamento = ["debito_conta", "pix", "transferencia"].includes(form.formaPagamento);
  const exigeCartaoPagamento = form.formaPagamento === "credito";
  const temEntrada = ["entrada_avista", "entrada_parcelado"].includes(form.tipoAcordo);
  const temParcelas = ["parcelado", "entrada_parcelado"].includes(form.tipoAcordo);
  const valorRenegociado = moedaParaNumero(form.valorRenegociado);
  const valorEntrada = moedaParaNumero(form.valorEntrada);
  const numeroParcelas = temParcelas ? Math.max(Number(form.numeroParcelas || 1), 1) : 1;

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  }

  function selecionarTipoAcordo(tipo) {
    setField("tipoAcordo", tipo);

    if (tipo === "avista") {
      setField("valorEntrada", "");
      setField("valorParcela", "");
      setField("numeroParcelas", "1");
    }

    if (tipo === "entrada_avista") {
      setField("numeroParcelas", "1");
      setField("valorParcela", "");
    }

    if (tipo === "parcelado") {
      setField("valorEntrada", "");
      if (!form.numeroParcelas) setField("numeroParcelas", "2");
    }

    if (tipo === "entrada_parcelado" && !form.numeroParcelas) {
      setField("numeroParcelas", "2");
    }
  }

  function atualizarValorTotalRenegociado(valor) {
    setField("valorRenegociado", valor);
    if (!temParcelas || !numeroParcelas) return;

    const total = moedaParaNumero(valor);
    setField("valorParcela", numeroParaMoedaInput(Math.max(total - valorEntrada, 0) / numeroParcelas));
  }

  function atualizarValorParcelaRenegociada(valor) {
    setField("valorParcela", valor);
    if (!temParcelas || !numeroParcelas) return;

    const parcela = moedaParaNumero(valor);
    setField("valorRenegociado", numeroParaMoedaInput(valorEntrada + parcela * numeroParcelas));
  }

  function atualizarValorEntrada(valor) {
    setField("valorEntrada", valor);
    if (!temParcelas || !numeroParcelas) return;

    const entrada = moedaParaNumero(valor);
    const parcelaAtual = moedaParaNumero(form.valorParcela);
    const totalAtual = moedaParaNumero(form.valorRenegociado);

    if (parcelaAtual > 0) {
      setField("valorRenegociado", numeroParaMoedaInput(entrada + parcelaAtual * numeroParcelas));
      return;
    }

    if (totalAtual > 0) {
      setField("valorParcela", numeroParaMoedaInput(Math.max(totalAtual - entrada, 0) / numeroParcelas));
    }
  }

  function atualizarQuantidadeParcelas(numero) {
    setField("numeroParcelas", numero);

    const parcelas = Math.max(Number(numero || 1), 1);
    const parcelaAtual = moedaParaNumero(form.valorParcela);
    const totalAtual = moedaParaNumero(form.valorRenegociado);

    if (parcelaAtual > 0) {
      setField("valorRenegociado", numeroParaMoedaInput(valorEntrada + parcelaAtual * parcelas));
      return;
    }

    if (totalAtual > 0) {
      setField("valorParcela", numeroParaMoedaInput(Math.max(totalAtual - valorEntrada, 0) / parcelas));
    }
  }

  async function salvarEdicao() {
    const novos = {};
    if (!form.dataRenegociacao) novos.dataRenegociacao = "Informe a data do acordo.";
    if (!form.tipoAcordo) novos.tipoAcordo = "Selecione como esse acordo será pago.";
    if (!form.formaPagamento) novos.formaPagamento = "Selecione a forma de pagamento do acordo.";
    if (exigeContaPagamento && !form.contaDebitoId) novos.contaDebitoId = "Selecione a conta usada no pagamento.";
    if (exigeCartaoPagamento && !form.cartaoPagamentoId) novos.cartaoPagamentoId = "Selecione o cartão usado no pagamento.";
    if (valorRenegociado <= 0) novos.valorRenegociado = "Informe o valor da renegociação.";
    if (temEntrada && valorEntrada <= 0) novos.valorEntrada = "Informe o valor da entrada.";
    else if (temEntrada && valorEntrada >= valorRenegociado) novos.valorEntrada = "A entrada precisa ser menor que o valor total.";
    if (temParcelas && Number(form.numeroParcelas || 0) <= 0) novos.numeroParcelas = "Informe a quantidade de parcelas.";
    if (!form.primeiroVencimento && valorRenegociado > valorEntrada) novos.primeiroVencimento = temParcelas ? "Informe o primeiro vencimento." : "Informe a data de vencimento.";
    else if (form.primeiroVencimento && form.dataRenegociacao && form.primeiroVencimento < form.dataRenegociacao) novos.primeiroVencimento = "O vencimento não pode ser anterior à data do acordo.";
    setErros(novos);
    if (Object.keys(novos).length) {
      setShakeKey(Date.now());
      return;
    }

    setSalvando(true);

    try {
      const atualizado = await editarRenegociacao(renegociacao.id, {
        credor: renegociacao.credor,
        dataRenegociacao: form.dataRenegociacao,
        formaPagamento: form.formaPagamento,
        contaDebitoId: form.contaDebitoId,
        cartaoPagamentoId: form.cartaoPagamentoId,
        valorRenegociado,
        valorEntrada: temEntrada ? valorEntrada : 0,
        numeroParcelas,
        primeiroVencimento: form.primeiroVencimento,
      });

      await onSalvo?.(atualizado);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao editar", error.message || "Não foi possível editar a renegociação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo="Editar renegociação"
        descricao={renegociacao.credor}
        onClose={fechar}
        largura="max-w-3xl"
        confirmarAoFecharSeAlterado
        isDirty={isDirty}
        rodape={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarEdicao}
              disabled={salvando}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Data do acordo" erro={erros.dataRenegociacao} shakeKey={shakeKey}>
            <ButtonField erro={erros.dataRenegociacao} shakeKey={shakeKey} onClick={() => setModalData("dataRenegociacao")}>
              {form.dataRenegociacao ? formatarDataBR(form.dataRenegociacao) : "Selecionar data"}
            </ButtonField>
          </Campo>

          <Campo label="Tipo do acordo" erro={erros.tipoAcordo} shakeKey={shakeKey}>
            <ButtonField erro={erros.tipoAcordo} shakeKey={shakeKey} onClick={() => setModalTipoAcordo(true)}>
              {form.tipoAcordo ? textoTipoAcordo(form.tipoAcordo) : "Selecionar tipo do acordo"}
            </ButtonField>
          </Campo>

          <Campo label="Forma de pagamento" erro={erros.formaPagamento} shakeKey={shakeKey}>
            <ButtonField erro={erros.formaPagamento} shakeKey={shakeKey} onClick={() => setModalFormaPagamento(true)}>
              {form.formaPagamento ? textoFormaPagamento(form.formaPagamento) : "Selecionar forma de pagamento"}
            </ButtonField>
          </Campo>

          <Campo label={exigeCartaoPagamento ? "Cartão" : "Conta"} erro={exigeCartaoPagamento ? erros.cartaoPagamentoId : erros.contaDebitoId} shakeKey={shakeKey}>
            <ButtonField
              erro={exigeCartaoPagamento ? erros.cartaoPagamentoId : erros.contaDebitoId}
              shakeKey={shakeKey}
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

          {temEntrada && (
            <Campo label="Entrada" erro={erros.valorEntrada} shakeKey={shakeKey}>
              <InputMoeda erro={erros.valorEntrada} shakeKey={shakeKey} value={form.valorEntrada} onChange={(valor) => { limparErro("valorEntrada"); atualizarValorEntrada(valor); }} />
            </Campo>
          )}

          {temParcelas && (
            <Campo label="Quantidade de parcelas" erro={erros.numeroParcelas} shakeKey={shakeKey}>
              <ButtonField erro={erros.numeroParcelas} shakeKey={shakeKey} onClick={() => setModalParcelas(true)}>
                {form.numeroParcelas ? `${form.numeroParcelas}x` : "Selecionar parcelas"}
              </ButtonField>
            </Campo>
          )}

          {temParcelas && (
            <Campo label="Valor das parcelas">
              <InputMoeda value={form.valorParcela} onChange={atualizarValorParcelaRenegociada} />
            </Campo>
          )}

          <Campo label="Valor Total Renegociado" erro={erros.valorRenegociado} shakeKey={shakeKey}>
            <InputMoeda erro={erros.valorRenegociado} shakeKey={shakeKey} value={form.valorRenegociado} onChange={(valor) => { limparErro("valorRenegociado"); atualizarValorTotalRenegociado(valor); }} />
          </Campo>

          <Campo label={temParcelas ? "Primeiro vencimento" : "Data de vencimento"} erro={erros.primeiroVencimento} shakeKey={shakeKey}>
            <ButtonField erro={erros.primeiroVencimento} shakeKey={shakeKey} onClick={() => setModalData("primeiroVencimento")}>
              {form.primeiroVencimento ? formatarDataBR(form.primeiroVencimento) : "Selecionar data"}
            </ButtonField>
          </Campo>
        </div>
      </ModalBase>

      {modalData && (
        <DatePickerModal
          aberto={true}
          valor={form[modalData] || ""}
          minDate={modalData === "primeiroVencimento" ? form.dataRenegociacao || null : null}
          maxDate={modalData === "dataRenegociacao" ? hojeISO() : null}
          onChange={(data) => {
            limparErro(modalData);
            setField(modalData, data);
            if (modalData === "dataRenegociacao" && form.primeiroVencimento && form.primeiroVencimento < data) {
              setField("primeiroVencimento", "");
            }
            setModalData(null);
          }}
          onClose={() => setModalData(null)}
        />
      )}

      <SelecionarTipoAcordoModal
        aberto={modalTipoAcordo}
        tipoAcordo={form.tipoAcordo}
        onSelecionar={(valor) => { limparErro("tipoAcordo"); selecionarTipoAcordo(valor); }}
        onClose={() => setModalTipoAcordo(false)}
      />

      <SelecionarFormaPagamentoModal
        aberto={modalFormaPagamento}
        formasPagamento={formasPagamentoAcordo}
        formaPagamento={form.formaPagamento}
        onSelecionar={(valor) => {
          limparErro("formaPagamento");
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
        onSelecionar={(id) => { limparErro("contaDebitoId"); setField("contaDebitoId", id); }}
        onClose={() => setModalConta(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarCartaoModal
        aberto={modalCartao}
        cartoes={cartoesAtivos}
        cartaoId={form.cartaoPagamentoId}
        onSelecionar={(id) => { limparErro("cartaoPagamentoId"); setField("cartaoPagamentoId", id); }}
        onClose={() => setModalCartao(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarParcelasModal
        aberto={modalParcelas}
        numeroParcelas={form.numeroParcelas}
        onSelecionar={(valor) => { limparErro("numeroParcelas"); atualizarQuantidadeParcelas(valor); }}
        onClose={() => setModalParcelas(false)}
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


function definirTipoAcordoRenegociacao(renegociacao) {
  const entrada = Number(renegociacao?.valor_entrada || 0);
  const parcelas = Math.max(Number(renegociacao?.numero_parcelas || 1), 1);

  if (entrada > 0 && parcelas > 1) return "entrada_parcelado";
  if (entrada > 0) return "entrada_avista";
  if (parcelas > 1) return "parcelado";
  return "avista";
}

function ResumoAcordoInicial({ itens }) {
  const itensAgrupados = agruparItensResumoAcordo(itens);
  const totalEmAcordo = itensAgrupados.reduce((total, item) => total + Number(item.totalRenegociado || 0), 0);

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 space-y-3">
      <p className="text-xs text-gray-500 font-black uppercase tracking-wide">Itens em acordo</p>

      <div className="divide-y divide-gray-800">
        {itensAgrupados.map((item) => (
          <div key={item.chave} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{item.titulo}</p>
                <p className="text-sm text-gray-500 truncate">{item.detalhe}</p>
              </div>

              <p className="font-black shrink-0 text-right">{formatarMoeda(item.totalRenegociado)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 font-black uppercase tracking-wide">Total</p>
        <p className="font-black text-right">{formatarMoeda(totalEmAcordo)}</p>
      </div>
    </div>
  );
}

function agruparItensContrato(itens) {
  const mapa = new Map();

  (itens || []).forEach((item) => {
    const original = item.original || {};
    const cartao = original.cartoes || original.cartao || {};
    const conta = original.contas || original.conta || {};
    const tipo = item.tipo === "fatura" ? "cartao" : item.tipo === "conta_negativa" ? "conta_negativa" : "conta";
    const id = tipo === "cartao"
      ? original.cartao_id || cartao.id || item.origem_id
      : original.conta_id || conta.id || original.id || item.origem_id;
    const chave = `${tipo}-${id || item.titulo}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        tipo,
        titulo: tipo === "cartao" ? cartao.nome || item.titulo || "Cartão" : conta.nome || item.titulo || "Conta",
        detalhe: tipo === "cartao" ? "Cartão de crédito" : tipo === "conta_negativa" ? "Conta negativa" : "Conta em acordo",
        totalOriginal: 0,
        limiteAnterior: tipo === "cartao" ? Number(cartao.limite_total || 0) : null,
        itens: [],
      });
    }

    const grupo = mapa.get(chave);
    grupo.totalOriginal += Number(item.valor_aberto || 0);
    grupo.itens.push(item);
  });

  return Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
}

function ResumoResultadoAcordo({
  grupos,
  dadosItens,
  numeroParcelas,
  temParcelas,
  totalAcordo,
  parcelaTotal,
  totalConsideradoBanco,
  custoEstimado,
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-green-300">Valor total do acordo</p>
          <p className="text-2xl font-black text-green-400 mt-1">{formatarMoeda(totalAcordo)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-green-300">Nova obrigação</p>
          <p className="font-black mt-1">{temParcelas ? `${numeroParcelas}x de ${formatarMoeda(parcelaTotal)}` : "Pagamento à vista"}</p>
        </div>
      </div>

      <div className="space-y-4">
        {grupos.map((grupo) => {
          const dados = dadosItens[grupo.chave] || {};
          const valorBanco = moedaParaNumero(dados.valorBanco);
          const valorParcela = moedaParaNumero(dados.valorParcela);
          const valorTotal = moedaParaNumero(dados.valorTotal);
          const saldoApos = moedaParaNumero(dados.saldoApos);

          return (
            <div key={grupo.chave} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-lg">{grupo.titulo}</p>
                  <p className="text-sm text-gray-500">{grupo.detalhe}</p>
                </div>
                <p className="font-black">{temParcelas ? `${numeroParcelas}x ${formatarMoeda(valorParcela)}` : formatarMoeda(valorTotal)}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MiniInfo titulo="Antes no ControlDriver" valor={formatarMoeda(grupo.tipo === "conta_negativa" ? -grupo.totalOriginal : grupo.totalOriginal)} />
                <MiniInfo titulo="Banco considerou" valor={valorBanco > 0 ? formatarMoeda(valorBanco) : "Não informado"} />
                <MiniInfo titulo="Total desta operação" valor={formatarMoeda(valorTotal)} />
                {grupo.tipo === "conta_negativa" && <MiniInfo titulo="Saldo após o acordo" valor={formatarMoeda(saldoApos)} />}
                {grupo.tipo === "cartao" && (
                  <MiniInfo
                    titulo="Limite após o acordo"
                    valor={dados.ajustarLimite ? formatarMoeda(moedaParaNumero(dados.novoLimite)) : `Mantém ${formatarMoeda(grupo.limiteAnterior)}`}
                  />
                )}
              </div>

              <p className="text-sm text-gray-400 leading-relaxed">
                {grupo.tipo === "conta_negativa"
                  ? "O saldo negativo será encerrado pelo acordo e a conta será ajustada para o saldo informado acima."
                  : "As faturas selecionadas serão marcadas como renegociadas e deixarão de aparecer como dívida aberta do cartão."}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
        <p className="font-black text-yellow-400">Custo estimado do acordo</p>
        {totalConsideradoBanco > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <MiniInfo titulo="Banco considerou" valor={formatarMoeda(totalConsideradoBanco)} />
              <MiniInfo titulo="Total a pagar" valor={formatarMoeda(totalAcordo)} />
              <MiniInfo titulo="Diferença estimada" valor={formatarMoeda(custoEstimado)} />
            </div>
            <p className="text-sm text-gray-400 mt-4">A diferença pode incluir juros, IOF, multas e outros encargos definidos pela instituição.</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-2">O custo exato não pode ser calculado porque o valor considerado pelo banco não foi informado.</p>
        )}
      </div>
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

function agruparItensResumoAcordo(itens) {
  const mapa = new Map();

  (itens || []).forEach((item) => {
    const original = item.original || {};
    const cartao = original.cartoes || original.cartao || {};
    const conta = original.contas || original.conta || {};
    const cartaoId = original.cartao_id || cartao.id || item.cartao_id || item.origem_id;
    const contaId = original.conta_id || conta.id || original.id || item.conta_id || item.origem_id;

    const tipo = item.tipo === "fatura" ? "cartao" : item.tipo === "conta_negativa" ? "conta_negativa" : "conta";
    const chave = tipo === "cartao" ? `cartao-${cartaoId || item.titulo}` : `${tipo}-${contaId || item.titulo}`;
    const titulo = tipo === "cartao"
      ? cartao.nome || item.nome_cartao || item.cartao_nome || item.detalhe || item.titulo || "Cartão"
      : conta.nome || item.nome_conta || item.titulo || "Conta";
    const detalhe = tipo === "cartao"
      ? "Cartão de crédito"
      : tipo === "conta_negativa"
      ? "Conta negativa"
      : "Conta em acordo";

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        tipo,
        titulo,
        detalhe,
        totalOriginal: 0,
        totalRenegociado: 0,
      });
    }

    const grupo = mapa.get(chave);
    grupo.totalOriginal += Number(item.valor_aberto || 0);
    grupo.totalRenegociado += Number(item.valor_renegociado || 0);
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const ordem = { cartao: 1, conta_negativa: 2, conta: 3 };
    return (ordem[a.tipo] || 9) - (ordem[b.tipo] || 9) || a.titulo.localeCompare(b.titulo);
  });
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
    parcelado: "Parcelado",
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

function InputMoeda({ value, onChange, disabled = false, erro, shakeKey }) {
  return (
    <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden ${disabled ? "opacity-60" : ""}`}>
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
