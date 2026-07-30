import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import { ButtonField, Campo } from "../ui/FormControls";
import ToggleSwitch from "../ui/ToggleSwitch";
import ConfirmacaoModal from "../modals/ConfirmacaoModal";
import DatePickerModal from "../modals/DatePickerModal";
import SelecionarCartaoModal from "../modals/SelecionarCartaoModal";
import SelecionarContaModal from "../modals/SelecionarContaModal";
import SelecionarFormaPagamentoModal from "../modals/SelecionarFormaPagamentoModal";
import SelecionarParcelasModal from "../modals/SelecionarParcelasModal";
import {
  calcularValorRestantePagamento,
  criarPagamentoVazio,
  formaPagamentoEhCredito,
  removerPagamento,
  validarCamposPagamento,
} from "../../utils/pagamentosMultiplos";
import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
} from "../../utils/moeda";
import { formatarDataBR } from "../../utils/data";
import { nomeCartaoComFinal } from "../../../modules/cartoes/utils/cartoesUtils";

export default function PagamentosMultiplos({
  pagamentos,
  valorTotal,
  onChange,
  formasPagamento,
  contas,
  cartoes,
  dataVencimentoPadrao,
  erros = {},
  erroTotal = "",
  shakeKey,
  onLimparErro,
}) {
  const [seletor, setSeletor] = useState(null);
  const [modoMultiploManual, setModoMultiploManual] = useState(false);
  const [confirmarDesativacao, setConfirmarDesativacao] = useState(false);
  const [errosAdicao, setErrosAdicao] = useState({});
  const [shakeAdicao, setShakeAdicao] = useState(0);
  const cardsRef = useRef(new Map());
  const pagamentoNovoRef = useRef(null);
  const modoMultiplo = modoMultiploManual || pagamentos.length > 1;
  const pagamentoAtivo = pagamentos.find(
    (pagamento) => pagamento.chave === seletor?.chave
  );
  const carteira = contas.find((conta) => conta.tipo_conta === "carteira");
  const contasBancarias = contas.filter(
    (conta) => (conta.tipo_conta || "banco") === "banco"
  );

  useEffect(() => {
    const chave = pagamentoNovoRef.current;
    if (!chave) return undefined;

    const frame = requestAnimationFrame(() => {
      const card = cardsRef.current.get(chave);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      card.querySelector("[data-campo-forma-pagamento] button")?.focus();
      pagamentoNovoRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [pagamentos]);

  function atualizar(chave, alteracoes) {
    onChange(
      pagamentos.map((pagamento) =>
        pagamento.chave === chave ? { ...pagamento, ...alteracoes } : pagamento
      )
    );
  }

  function limparErro(chave, campo) {
    setErrosAdicao((atuais) => {
      if (!atuais[chave]?.[campo]) return atuais;
      const campos = { ...atuais[chave] };
      delete campos[campo];
      const proximos = { ...atuais };
      if (Object.keys(campos).length) proximos[chave] = campos;
      else delete proximos[chave];
      return proximos;
    });
    onLimparErro?.(chave, campo);
  }

  function selecionarForma(chave, formaPagamento) {
    const credito = formaPagamentoEhCredito(formaPagamento);
    const parcelado = formaPagamento === "credito_parcelado";
    const dinheiro = formaPagamento === "dinheiro";
    const boleto = formaPagamento === "boleto";
    const pagamento = pagamentos.find((item) => item.chave === chave);
    const parcelas = parcelado
      ? Math.max(Number(pagamento?.numeroParcelas || 2), 2)
      : 1;
    const valor = moedaParaNumero(pagamento?.valor);
    const contaId = dinheiro && carteira
      ? String(carteira.id)
      : credito || boleto
        ? ""
        : contasBancarias.length === 1
          ? String(contasBancarias[0].id)
          : pagamento?.contaId || "";
    const cartaoId = credito
      ? pagamento?.cartaoId || (cartoes.length === 1 ? String(cartoes[0].id) : "")
      : "";

    limparErro(chave, "formaPagamento");
    if (contaId) limparErro(chave, "contaId");
    if (cartaoId) limparErro(chave, "cartaoId");
    atualizar(chave, {
      formaPagamento,
      contaId,
      cartaoId,
      numeroParcelas: String(parcelas),
      valorParcela: valor > 0 ? numeroParaMoedaInput(valor / parcelas) : "",
    });
  }

  function validarPagamentoParaAdicionar(pagamento) {
    const novosErros = validarCamposPagamento(pagamento, {
      carteiraDisponivel: Boolean(carteira),
    });

    if (!Object.keys(novosErros).length) return true;

    setErrosAdicao((atuais) => ({
      ...atuais,
      [pagamento.chave]: novosErros,
    }));
    setShakeAdicao(Date.now());
    return false;
  }

  function adicionarPagamento() {
    const ultimoPagamento = pagamentos.at(-1);
    if (!ultimoPagamento || !validarPagamentoParaAdicionar(ultimoPagamento)) return;

    const restante = calcularValorRestantePagamento(valorTotal, pagamentos);
    const novo = {
      ...criarPagamentoVazio(dataVencimentoPadrao),
      valor: restante > 0 ? numeroParaMoedaInput(restante) : "",
      valorParcela: restante > 0 ? numeroParaMoedaInput(restante) : "",
    };
    pagamentoNovoRef.current = novo.chave;
    setModoMultiploManual(true);
    onChange([...pagamentos, novo]);
  }

  function alterarModoMultiplo(ativo) {
    if (ativo) {
      setModoMultiploManual(true);
      return;
    }

    if (pagamentos.length > 1) {
      setConfirmarDesativacao(true);
      return;
    }

    onChange([sincronizarPrimeiroPagamentoComTotal()]);
    setModoMultiploManual(false);
  }

  function confirmarModoSimples() {
    onChange([sincronizarPrimeiroPagamentoComTotal()]);
    setErrosAdicao({});
    setModoMultiploManual(false);
    setConfirmarDesativacao(false);
  }

  function sincronizarPrimeiroPagamentoComTotal() {
    const primeiroPagamento = pagamentos[0];
    const valorIntegral = numeroParaMoedaInput(moedaParaNumero(valorTotal));
    const parcelas = Math.max(Number(primeiroPagamento?.numeroParcelas || 1), 1);

    return {
      ...primeiroPagamento,
      valor: valorIntegral,
      valorParcela:
        primeiroPagamento?.formaPagamento === "credito_parcelado"
          ? numeroParaMoedaInput(moedaParaNumero(valorTotal) / parcelas)
          : valorIntegral,
    };
  }

  function excluirPagamento(chave) {
    setErrosAdicao((atuais) => {
      if (!atuais[chave]) return atuais;
      const proximos = { ...atuais };
      delete proximos[chave];
      return proximos;
    });
    setModoMultiploManual(true);
    onChange(removerPagamento(pagamentos, chave));
  }

  function alterarValor(pagamento, valorDigitado) {
    const valor = formatarMoedaDigitada(valorDigitado);
    const parcelas = Math.max(Number(pagamento.numeroParcelas || 1), 1);
    limparErro(pagamento.chave, "valor");
    onLimparErro?.(null, "total");
    atualizar(pagamento.chave, {
      valor,
      valorParcela:
        pagamento.formaPagamento === "credito_parcelado" && moedaParaNumero(valor) > 0
          ? numeroParaMoedaInput(moedaParaNumero(valor) / parcelas)
          : valor,
    });
  }

  function alterarParcelas(pagamento, numeroParcelas) {
    const parcelas = Math.max(Number(numeroParcelas || 2), 2);
    limparErro(pagamento.chave, "numeroParcelas");
    atualizar(pagamento.chave, {
      numeroParcelas: String(parcelas),
      valorParcela:
        moedaParaNumero(pagamento.valor) > 0
          ? numeroParaMoedaInput(moedaParaNumero(pagamento.valor) / parcelas)
          : "",
    });
  }

  return (
    <div className="space-y-4">
      {pagamentos.map((pagamento, index) => {
        const credito = formaPagamentoEhCredito(pagamento.formaPagamento);
        const parcelado = pagamento.formaPagamento === "credito_parcelado";
        const boleto = pagamento.formaPagamento === "boleto";
        const dinheiro = pagamento.formaPagamento === "dinheiro";
        const conta = contas.find(
          (item) => String(item.id) === String(pagamento.contaId)
        );
        const cartao = cartoes.find(
          (item) => String(item.id) === String(pagamento.cartaoId)
        );
        const errosPagamento = {
          ...(erros[pagamento.chave] || {}),
          ...(errosAdicao[pagamento.chave] || {}),
        };
        const shakePagamento = errosAdicao[pagamento.chave]
          ? shakeAdicao
          : shakeKey;
        const ultimoPagamento = index === pagamentos.length - 1;

        return (
          <div
            key={pagamento.chave}
            ref={(elemento) => {
              if (elemento) cardsRef.current.set(pagamento.chave, elemento);
              else cardsRef.current.delete(pagamento.chave);
            }}
            className={modoMultiplo
              ? "rounded-2xl border border-gray-800 bg-[#0B1120] p-4"
              : ""}
          >
            {modoMultiplo && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-black text-white">
                  Pagamento {index + 1}
                </p>
                <div className="flex shrink-0 gap-2">
                  {ultimoPagamento && (
                    <button
                      type="button"
                      onClick={adicionarPagamento}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10"
                      aria-label="Adicionar outra forma de pagamento"
                      title="Adicionar outra forma de pagamento"
                    >
                      <FiPlus />
                    </button>
                  )}
                  {pagamentos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => excluirPagamento(pagamento.chave)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10"
                      aria-label={`Remover pagamento ${index + 1}`}
                      title={`Remover pagamento ${index + 1}`}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className={`grid grid-cols-1 gap-4 ${modoMultiplo ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              <div data-campo-forma-pagamento>
                <Campo
                  label="Forma de pagamento"
                  erro={errosPagamento.formaPagamento}
                  shakeKey={shakePagamento}
                >
                  <ButtonField
                    erro={errosPagamento.formaPagamento}
                    shakeKey={shakePagamento}
                    onClick={() => setSeletor({ tipo: "forma", chave: pagamento.chave })}
                  >
                    {formasPagamento.find(
                      (forma) => forma.valor === pagamento.formaPagamento
                    )?.titulo || "Selecionar"}
                  </ButtonField>
                </Campo>
              </div>

              {!boleto && (
                <Campo
                  label={credito ? "Cartão" : dinheiro ? "Carteira" : "Conta"}
                  erro={credito ? errosPagamento.cartaoId : errosPagamento.contaId}
                  shakeKey={shakePagamento}
                >
                  <ButtonField
                    erro={credito ? errosPagamento.cartaoId : errosPagamento.contaId}
                    shakeKey={shakePagamento}
                    onClick={() => {
                      if (dinheiro) return;
                      setSeletor({
                        tipo: credito ? "cartao" : "conta",
                        chave: pagamento.chave,
                      });
                    }}
                  >
                    {credito
                      ? cartao
                        ? nomeCartaoComFinal(cartao)
                        : "Selecionar cartão"
                      : dinheiro
                        ? carteira?.nome || "Carteira"
                        : conta?.nome || "Selecionar conta"}
                  </ButtonField>
                </Campo>
              )}

              {boleto && (
                <Campo
                  label="Vencimento do boleto"
                  erro={errosPagamento.dataVencimento}
                  shakeKey={shakePagamento}
                >
                  <ButtonField
                    erro={errosPagamento.dataVencimento}
                    shakeKey={shakePagamento}
                    onClick={() =>
                      setSeletor({ tipo: "vencimento", chave: pagamento.chave })
                    }
                  >
                    {formatarDataBR(pagamento.dataVencimento)}
                  </ButtonField>
                </Campo>
              )}

              {modoMultiplo && (
                <Campo
                  label="Valor pago"
                  erro={errosPagamento.valor}
                  shakeKey={shakePagamento}
                >
                  <MoneyInput
                    erro={errosPagamento.valor}
                    shakeKey={shakePagamento}
                    value={pagamento.valor}
                    onChange={(valor) => alterarValor(pagamento, valor)}
                  />
                </Campo>
              )}

              {modoMultiplo && parcelado && (
                <>
                  <Campo
                    label="Quantidade de parcelas"
                    erro={errosPagamento.numeroParcelas}
                    shakeKey={shakePagamento}
                  >
                    <ButtonField
                      erro={errosPagamento.numeroParcelas}
                      shakeKey={shakePagamento}
                      onClick={() =>
                        setSeletor({ tipo: "parcelas", chave: pagamento.chave })
                      }
                    >
                      {pagamento.numeroParcelas}x
                    </ButtonField>
                  </Campo>
                  <Campo label="Valor da parcela">
                    <div className="mt-2 rounded-xl border border-gray-700 bg-[#0B1120] p-3 text-gray-300">
                      {formatarMoeda(moedaParaNumero(pagamento.valorParcela))}
                    </div>
                  </Campo>
                </>
              )}
            </div>

          </div>
        );
      })}

      {erroTotal && (
        <p
          key={shakeKey}
          className="animate-shake rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-400"
        >
          {erroTotal}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-gray-800 pt-4">
        <span className="text-sm font-bold text-gray-300">
          Mais de uma forma de pagamento?
        </span>
        <ToggleSwitch
          ativo={modoMultiplo}
          onChange={alterarModoMultiplo}
          ariaLabel="Mais de uma forma de pagamento"
        />
      </div>

      <ConfirmacaoModal
        aberto={confirmarDesativacao}
        tipo="aviso"
        titulo="Usar apenas uma forma de pagamento?"
        mensagem="Os pagamentos adicionais serão removidos e somente o primeiro será mantido."
        textoConfirmar="Manter somente o primeiro"
        onCancelar={() => setConfirmarDesativacao(false)}
        onConfirmar={confirmarModoSimples}
      />

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <SelecionarFormaPagamentoModal
                aberto={seletor?.tipo === "forma"}
                formasPagamento={formasPagamento}
                formaPagamento={pagamentoAtivo?.formaPagamento || ""}
                onSelecionar={(valor) => selecionarForma(pagamentoAtivo.chave, valor)}
                onClose={() => setSeletor(null)}
              />
              <SelecionarContaModal
                aberto={seletor?.tipo === "conta"}
                contas={contasBancarias}
                contaId={pagamentoAtivo?.contaId || ""}
                onSelecionar={(valor) => {
                  limparErro(pagamentoAtivo.chave, "contaId");
                  atualizar(pagamentoAtivo.chave, { contaId: valor });
                }}
                onClose={() => setSeletor(null)}
                formatarMoeda={formatarMoeda}
              />
              <SelecionarCartaoModal
                aberto={seletor?.tipo === "cartao"}
                cartoes={cartoes}
                cartaoId={pagamentoAtivo?.cartaoId || ""}
                onSelecionar={(valor) => {
                  limparErro(pagamentoAtivo.chave, "cartaoId");
                  atualizar(pagamentoAtivo.chave, { cartaoId: valor });
                }}
                onClose={() => setSeletor(null)}
                formatarMoeda={formatarMoeda}
              />
              <DatePickerModal
                aberto={seletor?.tipo === "vencimento"}
                valor={pagamentoAtivo?.dataVencimento || dataVencimentoPadrao}
                onChange={(valor) => {
                  limparErro(pagamentoAtivo.chave, "dataVencimento");
                  atualizar(pagamentoAtivo.chave, { dataVencimento: valor });
                }}
                onClose={() => setSeletor(null)}
                titulo="Vencimento do boleto"
                descricao="Escolha a data em que esta conta precisa ser paga."
              />
              <SelecionarParcelasModal
                aberto={seletor?.tipo === "parcelas"}
                numeroParcelas={pagamentoAtivo?.numeroParcelas || "2"}
                onSelecionar={(valor) => alterarParcelas(pagamentoAtivo, valor)}
                onClose={() => setSeletor(null)}
              />
            </>,
            document.body
          )
        : null}
    </div>
  );
}

function MoneyInput({ value, onChange, erro, shakeKey }) {
  return (
    <div
      key={erro ? shakeKey : "ok"}
      className={`mt-2 flex items-center overflow-hidden rounded-xl border bg-[#0B1120] ${
        erro ? "animate-shake border-red-500" : "border-gray-700"
      }`}
    >
      <span className="px-3 text-gray-400">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />
    </div>
  );
}
