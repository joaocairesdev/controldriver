import { useCallback, useEffect, useState } from "react";
import { FiArrowDown, FiArrowUp, FiTag, FiX } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import ModalBase from "../../../shared/components/modals/ModalBase";
import SelecionarCartaoModal from "../../../shared/components/modals/SelecionarCartaoModal";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarFormaPagamentoModal from "../../../shared/components/modals/SelecionarFormaPagamentoModal";
import { nomeCartaoComFinal } from "../../cartoes/utils/cartoesUtils";
import TagModal from "./TagModal";

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
  const [modalRecargaAberto, setModalRecargaAberto] = useState(false);
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

  return (
    <>
      <TagVidroCard
        tag={tag}
        formatarMoeda={formatarMoeda}
        onClick={() => setModalDetalhesAberto(true)}
      />

      {modalDetalhesAberto && (
        <ModalDetalhesTag
          tag={tag}
          formatarMoeda={formatarMoeda}
          fechar={() => setModalDetalhesAberto(false)}
          configurar={() => setModalConfigAberto(true)}
          recarregar={() => {
            setModalDetalhesAberto(false);
            setModalRecargaAberto(true);
          }}
        />
      )}

      <TagModal
        aberto={modalRecargaAberto}
        onClose={async () => {
          setModalRecargaAberto(false);
          await onAtualizar?.();
        }}
        etapaInicial="recarga"
        tagInicialId={String(tag.id)}
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
              <FiTag className="w-3 h-3" /> TAG no vidro •{" "}
              {prePaga ? "Pré-paga" : "Pós-paga"}
            </span>

            {precisaRecarga && (
              <span className="rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold px-3 py-1">
                Recarga necessária
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xl font-black text-white truncate">
              {tag.nome}
            </span>
            <span className="text-xs text-gray-500">
              Toque para mais informações.
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right border-l border-blue-500/20 pl-5">
          <p className="text-xs text-gray-400">Saldo da TAG</p>
          <strong
            className={`text-3xl font-black leading-tight ${
              saldoNegativo ? "text-red-400" : "text-white"
            }`}
          >
            {formatarMoeda(saldo)}
          </strong>
        </div>
      </div>
    </button>
  );
}

function ModalDetalhesTag({
  tag,
  formatarMoeda,
  fechar,
  configurar,
  recarregar,
}) {
  const saldo = Number(tag.saldo_atual || 0);
  const prePaga = (tag.tipo_tag || "pre_paga") === "pre_paga";
  const valorRecarga = Number(tag.valor_recarga_automatica || 0);
  const percentual = Number(tag.percentual_alerta_recarga || 30);
  const gatilho = valorRecarga > 0 ? valorRecarga * (percentual / 100) : 0;
  const precisaRecarga = prePaga && valorRecarga > 0 && saldo <= gatilho;
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregandoMovimentacoes, setCarregandoMovimentacoes] = useState(false);

  function formatarDataBR(dataISO) {
    if (!dataISO) return "-";
    const [ano, mes, dia] = String(dataISO).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function textoFormaRecarga() {
    if (tag.tag_forma_recarga === "credito_avista") {
      return "Cartão de crédito";
    }
    if (tag.tag_forma_recarga === "debito") return "Débito em conta";
    if (tag.tag_forma_recarga === "pix") return "Pix";
    return "Não definida";
  }

  const carregarMovimentacoesTag = useCallback(async () => {
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
  }, [tag.id]);

  useEffect(() => {
    // A abertura do extrato inicia a mesma carga imediata usada antes da extração.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarMovimentacoesTag();
  }, [carregarMovimentacoesTag]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">TAG do veículo</h2>
            <p className="text-gray-400 mt-2">
              Resumo, saldo e últimas movimentações da TAG.
            </p>
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
                <FiTag className="w-3 h-3" /> TAG no vidro •{" "}
                {prePaga ? "Pré-paga" : "Pós-paga"}
              </span>
              <h3 className="text-xl font-black text-white mt-3">{tag.nome}</h3>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400">Saldo da TAG</p>
              <strong
                className={`text-3xl font-black ${
                  saldo < 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {formatarMoeda(saldo)}
              </strong>
            </div>
          </div>

          {prePaga && tag.recarga_automatica && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-800 pt-4">
              <MiniInfoTag
                titulo="Recarga"
                valor={formatarMoeda(valorRecarga)}
              />
              <MiniInfoTag
                titulo="Ao atingir"
                valor={formatarMoeda(gatilho)}
              />
              <MiniInfoTag
                titulo="Recarga automática em:"
                valor={textoFormaRecarga()}
              />
            </div>
          )}
        </div>

        {precisaRecarga && (
          <button
            type="button"
            onClick={recarregar}
            className="mt-4 w-full text-left bg-red-500/10 border border-red-500/40 hover:bg-red-500/15 rounded-2xl p-4 transition"
          >
            <p className="font-bold text-red-400">Recarga necessária</p>
            <p className="text-sm text-gray-300 mt-1">
              O saldo está em {formatarMoeda(saldo)}. Toque para registrar uma
              recarga agora.
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

            {!carregandoMovimentacoes &&
              movimentacoes.map((movimento) => {
                const recarga = movimento.tipo === "recarga";

                return (
                  <div
                    key={movimento.id}
                    className="bg-[#0B1120] border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        {formatarDataBR(movimento.data)}
                      </p>
                      <p className="font-bold text-white truncate">
                        {recarga ? (
                          <FiArrowUp className="inline w-3 h-3 mr-1" />
                        ) : (
                          <FiArrowDown className="inline w-3 h-3 mr-1" />
                        )}
                        {movimento.titulo}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {movimento.descricao}
                      </p>
                    </div>

                    <p
                      className={`font-black shrink-0 ${
                        recarga ? "text-green-400" : "text-red-400"
                      }`}
                    >
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
            onClick={configurar}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            Configurar TAG
          </button>
        </div>
      </div>
    </div>
  );
}

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

function MiniInfoTag({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-sm font-bold text-white mt-1">{valor}</p>
    </div>
  );
}
