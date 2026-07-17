import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../services/supabase";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";

import ModalBase from "../../../shared/components/modals/ModalBase";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import { FORMA_PAGAMENTO_DEBITO_CONTA } from "../../../shared/constants/formasPagamento";
import {
  gerarParcelasEFaturasPadrao,
  nomeCartaoComFinal,
} from "../../cartoes/utils/cartoesUtils";
import { adicionarFrequencia } from "../../veiculos/utils/veiculosFinanceiro";

const HOJE = new Date().toISOString().split("T")[0];

export default function RegistrarPagamentoModal({
  aberto,
  contaPagar,
  contas = [],
  saldoContaPagar,
  onClose,
  onSalvo,
}) {
  const [dataPagamento, setDataPagamento] = useState(HOJE);
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [cartoes, setCartoes] = useState([]);
  const [valorPago, setValorPago] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [numeroParcelas, setNumeroParcelas] = useState("1");
  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [confirmarParcial, setConfirmarParcial] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const saldo = useMemo(() => saldoContaPagar(contaPagar), [contaPagar, saldoContaPagar]);
  const valor = moedaParaNumero(valorPago);
  const isCredito = formaPagamento === "credito_avista" || formaPagamento === "credito_parcelado";
  const isParcelado = formaPagamento === "credito_parcelado";
  const pagamentoParcial = valor > 0 && valor < saldo;
  const pagoAnterior = Number(contaPagar?.valor_pago || 0);
  const contaSelecionada = contas.find((conta) => String(conta.id) === String(contaId));
  const cartaoSelecionado = cartoes.find((cartao) => String(cartao.id) === String(cartaoId));

  useEffect(() => {
    if (!aberto) return;

    setDataPagamento(HOJE);
    setValorPago(numeroParaMoedaInput(saldoContaPagar(contaPagar)));
    setFormaPagamento("");
    setNumeroParcelas("1");
    setConfirmarParcial(false);
    setErros({});

    setContaId(contas.length === 1 ? String(contas[0].id) : "");

    carregarCartoes();
  }, [aberto, contaPagar?.id]);

  useEffect(() => {
    if (!isCredito) return;
    if (cartoes.length === 1 && !cartaoId) setCartaoId(String(cartoes[0].id));
  }, [isCredito, cartoes, cartaoId]);

  async function carregarCartoes() {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error(error);
      setCartoes([]);
      return;
    }

    setCartoes(data || []);
  }

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

  function validar() {
    const novos = {};
    if (!dataPagamento) novos.dataPagamento = "Informe a data do pagamento.";
    if (!formaPagamento) novos.formaPagamento = "Escolha a forma de pagamento.";
    if (!isCredito && !contaId) novos.contaId = "Selecione a conta usada para pagar.";
    if (isCredito && !cartaoId) novos.cartaoId = "Selecione o cartão usado para pagar esta conta.";
    if (isParcelado && Number(numeroParcelas || 0) < 2) novos.numeroParcelas = "Informe 2 parcelas ou mais.";
    if (valor <= 0) novos.valorPago = "Informe um valor maior que zero.";

    setErros(novos);
    if (Object.keys(novos).length) {
      setShakeKey((valor) => valor + 1);
      return false;
    }

    if (valor > saldo) {
      abrirFeedback(
        "erro",
        "Valor maior que a conta",
        `O valor pago não pode ser maior que o saldo em aberto de ${formatarMoeda(saldo)}.`
      );
      setValorPago(numeroParaMoedaInput(saldo));
      return false;
    }

    return true;
  }

  async function confirmarPagamento() {
    if (salvando) return;
    if (!validar()) return;

    if (pagamentoParcial && !confirmarParcial) {
      setConfirmarParcial(true);
      return;
    }

    setSalvando(true);

    try {
      const valorArredondado = Math.round(valor * 100) / 100;
      const novoValorPago = Math.round((pagoAnterior + valorArredondado) * 100) / 100;
      const novoSaldo = Math.max(Math.round((Number(contaPagar.valor_total || 0) - novoValorPago) * 100) / 100, 0);
      const novoStatus = novoSaldo <= 0 ? "pago" : "parcial";
      const parcelas = isParcelado ? Number(numeroParcelas || 2) : 1;
      const valorParcela = Math.round((valorArredondado / parcelas) * 100) / 100;
      const descricaoPagamento = `Pagamento de ${contaPagar.descricao || contaPagar.categoria || "conta a pagar"}`;

      const payloadSaida = {
        data_compra: dataPagamento,
        forma_pagamento: formaPagamento,
        tipo_movimentacao: "saida",
        conta_id: isCredito ? null : Number(contaId),
        cartao_id: isCredito ? Number(cartaoId) : null,
        tipo_credito: formaPagamento === "credito_avista" ? "avista" : formaPagamento === "credito_parcelado" ? "parcelado" : null,
        numero_parcelas: parcelas,
        valor_total: valorArredondado,
        valor_parcela: valorParcela,
        data_efetivacao: isCredito ? null : dataPagamento,
        data_vencimento: null,
        categoria: contaPagar.categoria || "Conta",
        categoria_id: contaPagar.categoria_id || null,
        finalidade: contaPagar.finalidade || null,
        descricao: descricaoPagamento,
        status: isCredito ? "fatura" : "pago",
        conta_pagar_origem_id: contaPagar.id,
        veiculo_id: contaPagar.veiculo_id || null,
        financiamento_id: contaPagar.financiamento_id || null,
        aluguel_id: contaPagar.aluguel_id || null,
        caucao_id: contaPagar.caucao_id || null,
        referencia_contrato: contaPagar.referencia_contrato || null,
      };

      const { data: saidaCriada, error: erroSaida } = await supabase
        .from("saidas")
        .insert(payloadSaida)
        .select()
        .single();

      if (erroSaida) throw erroSaida;

      if (isCredito) {
        await gerarParcelasCartao({
          saidaId: saidaCriada.id,
          cartao: cartaoSelecionado,
          dataBase: dataPagamento,
          parcelas,
          valorParcela,
        });
      }

      const { error: erroConta } = await supabase
        .from("saidas")
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
          data_efetivacao: novoStatus === "pago" ? dataPagamento : contaPagar.data_efetivacao || null,
        })
        .eq("id", contaPagar.id);

      if (erroConta) throw erroConta;

      if (novoStatus === "pago" && contaPagar.aluguel_id && contaPagar.data_vencimento) {
        const { data: contrato, error: erroContrato } = await supabase
          .from("veiculos_alugueis")
          .select("id, frequencia, proximo_vencimento")
          .eq("id", contaPagar.aluguel_id)
          .maybeSingle();
        if (erroContrato) throw erroContrato;
        if (contrato && contrato.proximo_vencimento <= contaPagar.data_vencimento) {
          const { error: erroAvanco } = await supabase.from("veiculos_alugueis").update({
            proximo_vencimento: adicionarFrequencia(contaPagar.data_vencimento, contrato.frequencia),
            updated_at: new Date().toISOString(),
          }).eq("id", contrato.id);
          if (erroAvanco) throw erroAvanco;
        }
      }

      await onSalvo?.();
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao pagar",
        error.message || "Erro ao registrar pagamento. Confira se o SQL de Contas a Pagar foi executado."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function gerarParcelasCartao({ saidaId, cartao, dataBase, parcelas, valorParcela }) {
    if (!cartao?.id) throw new Error("Cartão não encontrado.");

    return gerarParcelasEFaturasPadrao(supabase, {
      saidaId,
      cartao,
      cartaoId: cartao.id,
      dataBase,
      quantidadeParcelas: parcelas,
      valorParcela,
    });
  }

  if (!aberto || !contaPagar) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Registrar pagamento"
        descricao={contaPagar.descricao || contaPagar.categoria || "Conta a pagar"}
        onClose={onClose}
        largura="max-w-xl"
      
        confirmarAoFecharSeAlterado>
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#0B1120] border border-gray-800 p-5">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Saldo em aberto</p>
            <p className="text-3xl font-black mt-2 text-white">{formatarMoeda(saldo)}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-400">
              <p>Total: <span className="font-bold text-white">{formatarMoeda(contaPagar.valor_total)}</span></p>
              <p>Pago: <span className="font-bold text-white">{formatarMoeda(pagoAnterior)}</span></p>
              <p className="sm:col-span-2">Vencimento: <span className="font-bold text-white">{formatarDataBR(contaPagar.data_vencimento)}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Data do pagamento" erro={erros.dataPagamento} shakeKey={shakeKey}>
              <ButtonField erro={erros.dataPagamento} shakeKey={shakeKey} onClick={() => setModalDataAberto(true)}>{formatarDataBR(dataPagamento)}</ButtonField>
            </Campo>

            {!isCredito ? (
              <Campo label="Conta utilizada" erro={erros.contaId} shakeKey={shakeKey}>
                <ButtonField erro={erros.contaId} shakeKey={shakeKey} onClick={() => setModalContaAberto(true)}>{contaSelecionada?.nome || "Selecionar conta"}</ButtonField>
              </Campo>
            ) : (
              <Campo label="Cartão utilizado" erro={erros.cartaoId} shakeKey={shakeKey}>
                <ButtonField erro={erros.cartaoId} shakeKey={shakeKey} onClick={() => setModalCartaoAberto(true)}>
                  {cartaoSelecionado ? nomeCartaoComFinal(cartaoSelecionado) : "Selecionar cartão"}
                </ButtonField>
              </Campo>
            )}
          </div>

          <Campo label="Forma do pagamento" erro={erros.formaPagamento} shakeKey={shakeKey}>
            <div key={erros.formaPagamento ? shakeKey : "ok"} className={`grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 ${erros.formaPagamento ? "animate-shake rounded-xl ring-1 ring-red-500" : ""}`}>
              {[
                { valor: "pix", titulo: "Pix" },
                { valor: "debito", titulo: "Débito" },
                FORMA_PAGAMENTO_DEBITO_CONTA,
                { valor: "dinheiro", titulo: "Dinheiro" },
                { valor: "credito_avista", titulo: "Crédito" },
                { valor: "credito_parcelado", titulo: "Crédito parcelado" },
              ].map((forma) => (
                <button
                  key={forma.valor}
                  type="button"
                  onClick={() => {
                    limparErro("formaPagamento");
                    setFormaPagamento(forma.valor);
                    setConfirmarParcial(false);
                    if (forma.valor !== "credito_parcelado") setNumeroParcelas("1");
                  }}
                  className={`rounded-xl border p-3 text-sm font-black transition ${
                    formaPagamento === forma.valor
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {forma.titulo}
                </button>
              ))}
            </div>
          </Campo>

          {isParcelado && (
            <Campo label="Quantidade de parcelas" erro={erros.numeroParcelas} shakeKey={shakeKey}>
              <input
                type="number"
                min="2"
                value={numeroParcelas}
                onChange={(event) => { limparErro("numeroParcelas"); setNumeroParcelas(event.target.value.replace(/\D/g, "") || ""); }}
                className={`w-full mt-2 bg-[#0B1120] border ${erros.numeroParcelas ? "border-red-500 animate-shake" : "border-gray-700 focus:border-green-400"} rounded-xl p-3 outline-none`}
              />
            </Campo>
          )}

          <Campo label="Valor pago" erro={erros.valorPago} shakeKey={shakeKey}>
            <div key={erros.valorPago ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erros.valorPago ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden`}>
              <span className="px-3 text-gray-400">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={valorPago}
                onChange={(event) => {
                  limparErro("valorPago");
                  setConfirmarParcial(false);
                  setValorPago(formatarMoedaDigitada(event.target.value));
                }}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </Campo>

          {isCredito && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-sm text-yellow-300">
              Pagando no crédito, essa conta será marcada como paga/parcial agora e o valor irá para a fatura do cartão selecionado.
            </div>
          )}

          {pagamentoParcial && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-sm text-yellow-300">
              Este será um pagamento parcial. O saldo restante continuará pendente em Contas a Pagar.
            </div>
          )}

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 pt-4 pb-1 bg-[#111827]">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={confirmarPagamento}
              disabled={salvando}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : confirmarParcial ? "Confirmar parcial" : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataPagamento}
        onChange={(valor) => { limparErro("dataPagamento"); setDataPagamento(valor); }}
        onClose={() => setModalDataAberto(false)}
        titulo="Data do pagamento"
        descricao="Escolha quando a conta foi paga."
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contas}
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

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

function numeroParaMoedaInput(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarMoedaDigitada(valor) {
  const somenteDigitos = String(valor ?? "").replace(/\D/g, "");
  if (!somenteDigitos) return "";

  const centavos = Number(somenteDigitos.replace(/^0+/, "") || "0");
  if (!centavos) return "";

  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moedaParaNumero(valor) {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
}
