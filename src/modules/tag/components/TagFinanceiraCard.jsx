import { useState } from "react";
import { supabase } from "../../../services/supabase";
import ModalBase from "../../../shared/components/modals/ModalBase";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import { nomeCartaoComFinal } from "../../cartoes/utils/cartoesUtils";
import ContaFinanceiraCard from "../../contas/components/ContaFinanceiraCard";
import ModalExtratoConta from "../../contas/components/ModalExtratoConta";
import { formatarDataBR } from "../../../shared/utils/data";

export default function TagFinanceiraCard({
  tag,
  contasBanco,
  cartoes,
  formatarMoeda,
  formatarMoedaDigitada,
  numeroParaMoedaInput,
  onAtualizar,
  onErro,
}) {
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", "."));
  }

  async function salvarConfiguracao(dadosTag) {
    const payload = {
      nome: dadosTag.nome.trim(),
      tipo_tag: dadosTag.tipo_tag,
      recarga_automatica:
        dadosTag.tipo_tag === "pre_paga"
          ? dadosTag.recarga_automatica
          : false,
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
      .eq("id", tag.id);

    if (error) {
      console.error(error);
      onErro?.("Erro", "Erro ao configurar TAG.", "erro");
      return;
    }

    setModalConfigAberto(false);
    await onAtualizar?.();
  }

  if (!tag) return null;

  const prePaga = (tag.tipo_tag || "pre_paga") === "pre_paga";
  const valorRecarga = Number(tag.valor_recarga_automatica || 0);
  const percentualAlerta = Number(tag.percentual_alerta_recarga || 30);
  const gatilhoRecarga = valorRecarga * (percentualAlerta / 100);
  const precisaRecarga = prePaga
    && valorRecarga > 0
    && Number(tag.saldo_atual || 0) <= gatilhoRecarga;

  return (
    <>
      <TagVidroCard
        nome={tag.nome}
        tipo={prePaga ? "TAG pré-paga" : "TAG pós-paga"}
        saldo={tag.saldo_atual}
        formatarMoeda={formatarMoeda}
        badges={[
          ...(tag.recarga_automatica ? [{
            texto: "Recarga automática",
            classe: "border-blue-500/20 bg-blue-500/15 text-blue-300",
          }] : []),
          ...(precisaRecarga ? [{
            texto: "Recarga necessária",
            classe: "border-red-500/20 bg-red-500/15 text-red-300",
          }] : []),
        ]}
        alerta={precisaRecarga}
        onClick={() => setModalDetalhesAberto(true)}
      />

      <ModalExtratoConta
        aberto={modalDetalhesAberto}
        conta={tag}
        onClose={() => setModalDetalhesAberto(false)}
        onEditarConta={() => setModalConfigAberto(true)}
        formatarMoeda={formatarMoeda}
        formatarData={formatarDataBR}
      />

      {modalConfigAberto && (
        <ConfigurarTagModal
          tag={tag}
          contasBanco={contasBanco}
          cartoes={cartoes}
          formatarMoedaDigitada={formatarMoedaDigitada}
          numeroParaMoedaInput={numeroParaMoedaInput}
          onClose={() => setModalConfigAberto(false)}
          onSalvar={salvarConfiguracao}
        />
      )}
    </>
  );
}

const TagVidroCard = ContaFinanceiraCard;

function ConfigurarTagModal({
  tag,
  contasBanco,
  cartoes,
  formatarMoedaDigitada,
  numeroParaMoedaInput,
  onClose,
  onSalvar,
}) {
  const [nome, setNome] = useState(tag.nome || "");
  const [tipoTag, setTipoTag] = useState(tag.tipo_tag || "pre_paga");
  const [recargaAutomatica, setRecargaAutomatica] = useState(
    Boolean(tag.recarga_automatica),
  );
  const [valorRecarga, setValorRecarga] = useState(
    tag.valor_recarga_automatica
      ? numeroParaMoedaInput(tag.valor_recarga_automatica)
      : "",
  );
  const [percentualGatilho, setPercentualGatilho] = useState(
    String(tag.percentual_alerta_recarga || 30),
  );
  const [formaRecarga, setFormaRecarga] = useState(
    tag.tag_forma_recarga || "credito_avista",
  );
  const [contaRecargaId, setContaRecargaId] = useState(
    tag.tag_conta_recarga_id ? String(tag.tag_conta_recarga_id) : "",
  );
  const [cartaoRecargaId, setCartaoRecargaId] = useState(
    tag.tag_cartao_recarga_id ? String(tag.tag_cartao_recarga_id) : "",
  );
  const [modalFormaAberto, setModalFormaAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const formasRecarga = [
    {
      valor: "credito_avista",
      titulo: "Crédito à vista",
      descricao: "Recarga lançada no cartão de crédito",
    },
    {
      valor: "debito",
      titulo: "Débito",
      descricao: "Recarga debitada de uma conta bancária",
    },
    {
      valor: "pix",
      titulo: "Pix",
      descricao: "Recarga paga via Pix por uma conta bancária",
    },
  ];

  function textoForma(valor) {
    return (
      formasRecarga.find((item) => item.valor === valor)?.titulo ||
      "Selecionar forma"
    );
  }

  function textoConta(id) {
    return (
      contasBanco.find((conta) => String(conta.id) === String(id))?.nome ||
      "Selecionar conta"
    );
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
      if (moedaParaNumeroLocal(valorRecarga) <= 0) {
        novos.valorRecarga = "Informe o valor da recarga automática.";
      }
      if (formaRecarga === "credito_avista" && !cartaoRecargaId) {
        novos.cartaoRecargaId = "Escolha o cartão usado na recarga.";
      }
      if (["debito", "pix"].includes(formaRecarga) && !contaRecargaId) {
        novos.contaRecargaId = "Escolha a conta usada na recarga.";
      }
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

  return (
    <>
      <ModalBase
        aberto
        titulo="Configurar TAG"
        descricao="Altere apenas a TAG vinculada ao veículo."
        onClose={onClose}
        largura="max-w-lg"
        z="z-[70]"
      >
        <div
          key={erros.nome ? shakeKey : "ok"}
          className={`mt-6 ${erros.nome ? "animate-shake" : ""}`}
        >
          <label
            className={
              erros.nome ? "text-sm text-red-400" : "text-sm text-gray-300"
            }
          >
            Nome da TAG
          </label>
          <input
            type="text"
            value={nome}
            placeholder="Ex: Veloe"
            onChange={(event) => {
              limparErro("nome");
              setNome(event.target.value);
            }}
            className={`w-full mt-2 bg-[#0B1120] border ${
              erros.nome
                ? "border-red-500"
                : "border-gray-700 focus:border-green-400"
            } rounded-xl p-3 outline-none`}
          />
          {erros.nome && (
            <p className="mt-1 text-xs text-red-400">{erros.nome}</p>
          )}
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
                  <div
                    key={erros.valorRecarga ? shakeKey : "ok"}
                    className={erros.valorRecarga ? "animate-shake" : ""}
                  >
                    <label
                      className={
                        erros.valorRecarga
                          ? "text-sm text-red-400"
                          : "text-sm text-gray-300"
                      }
                    >
                      Valor da recarga
                    </label>
                    <div
                      className={`flex items-center mt-2 bg-[#111827] border ${
                        erros.valorRecarga
                          ? "border-red-500"
                          : "border-gray-700"
                      } rounded-xl overflow-hidden`}
                    >
                      <span className="px-3 text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorRecarga}
                        placeholder="30,00"
                        onChange={(event) => {
                          limparErro("valorRecarga");
                          setValorRecarga(
                            formatarMoedaDigitada(event.target.value),
                          );
                        }}
                        className="w-full bg-transparent p-3 outline-none"
                      />
                    </div>
                    {erros.valorRecarga && (
                      <p className="mt-1 text-xs text-red-400">
                        {erros.valorRecarga}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-300">Gatilho (%)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={percentualGatilho}
                      placeholder="30"
                      onChange={(event) =>
                        setPercentualGatilho(
                          String(event.target.value)
                            .replace(/\D/g, "")
                            .slice(0, 3),
                        )
                      }
                      className="w-full mt-2 bg-[#111827] border border-gray-700 rounded-xl p-3 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-300">
                    Recarga automática em:
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalFormaAberto(true)}
                    className="w-full mt-2 bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
                  >
                    {textoForma(formaRecarga)}
                  </button>
                </div>

                {formaRecarga === "credito_avista" ? (
                  <div
                    key={erros.cartaoRecargaId ? shakeKey : "ok"}
                    className={erros.cartaoRecargaId ? "animate-shake" : ""}
                  >
                    <label
                      className={
                        erros.cartaoRecargaId
                          ? "text-sm text-red-400"
                          : "text-sm text-gray-300"
                      }
                    >
                      Cartão vinculado
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalCartaoAberto(true)}
                      className={`w-full mt-2 bg-[#111827] border ${
                        erros.cartaoRecargaId
                          ? "border-red-500"
                          : "border-gray-700 hover:border-green-400"
                      } rounded-xl p-3 text-left font-semibold`}
                    >
                      {textoCartao(cartaoRecargaId)}
                    </button>
                    {erros.cartaoRecargaId && (
                      <p className="mt-1 text-xs text-red-400">
                        {erros.cartaoRecargaId}
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    key={erros.contaRecargaId ? shakeKey : "ok"}
                    className={erros.contaRecargaId ? "animate-shake" : ""}
                  >
                    <label
                      className={
                        erros.contaRecargaId
                          ? "text-sm text-red-400"
                          : "text-sm text-gray-300"
                      }
                    >
                      Conta vinculada
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalContaAberto(true)}
                      className={`w-full mt-2 bg-[#111827] border ${
                        erros.contaRecargaId
                          ? "border-red-500"
                          : "border-gray-700 hover:border-green-400"
                      } rounded-xl p-3 text-left font-semibold`}
                    >
                      {textoConta(contaRecargaId)}
                    </button>
                    {erros.contaRecargaId && (
                      <p className="mt-1 text-xs text-red-400">
                        {erros.contaRecargaId}
                      </p>
                    )}
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
        onSelecionar={(valor) => {
          limparErro("contaRecargaId");
          setContaRecargaId(valor);
        }}
        onClose={() => setModalContaAberto(false)}
        formatarMoeda={formatarMoedaLocal}
      />

      <SelecionarCartaoModal
        aberto={modalCartaoAberto}
        cartoes={cartoes}
        cartaoId={cartaoRecargaId}
        onSelecionar={(valor) => {
          limparErro("cartaoRecargaId");
          setCartaoRecargaId(valor);
        }}
        onClose={() => setModalCartaoAberto(false)}
        formatarMoeda={formatarMoedaLocal}
      />
    </>
  );
}
