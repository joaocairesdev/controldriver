import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCreditCard, FiEdit2, FiPlus, FiTrash2, FiUser } from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import CartaoCadastroModal from "../components/CartaoCadastroModal";
import PainelFaturasCartao from "../components/PainelFaturasCartao";
import {
  corBarra,
  corDisponivel,
  formatarMoeda,
  formatarMoedaDigitada,
  labelTipoCartao,
  moedaParaNumero,
  numeroParaMoedaInput,
  textoFinalCartao,
} from "../utils/cartoesUtils";

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [cartaoSelecionado, setCartaoSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);
  const [modalAviso, setModalAviso] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    tipo: "info",
  });

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    await Promise.all([carregarCartoes(), carregarContas()]);
  }

  async function carregarContas() {
    const { data, error } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar contas.", "erro");
      return;
    }

    const contasComSaldo = await Promise.all(
      (data || []).map(async (conta) => {
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

        const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaId);

        const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
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

        return {
          ...conta,
          tipo_conta: conta.tipo_conta || "banco",
          saldo_atual:
            Number(conta.saldo_inicial || 0) +
            totalEntradas +
            totalEntradasAvulsas +
            totalTransferenciasRecebidas -
            totalSaidas -
            totalTransferenciasEnviadas,
        };
      })
    );

    setContas(contasComSaldo);
  }

  async function carregarCartoes() {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar cartões.", "erro");
      return;
    }

    const idsCartoes = (data || []).map((cartao) => cartao.id);

    const { data: faturasData, error: erroFaturas } =
      idsCartoes.length > 0
        ? await supabase
            .from("faturas_cartao")
            .select("*")
            .in("cartao_id", idsCartoes)
            .in("status", ["aberta", "fechada", "parcial"])
        : { data: [], error: null };

    if (erroFaturas) {
      console.error(erroFaturas);
      abrirAviso("Erro", "Erro ao carregar faturas dos cartões.", "erro");
      return;
    }

    const idsFaturas = (faturasData || []).map((fatura) => fatura.id);

    const { data: parcelasData, error: erroParcelas } =
      idsFaturas.length > 0
        ? await supabase
            .from("saidas_parcelas")
            .select("fatura_id, valor_parcela")
            .in("fatura_id", idsFaturas)
        : { data: [], error: null };

    if (erroParcelas) {
      console.error(erroParcelas);
      abrirAviso("Erro", "Erro ao carregar parcelas dos cartões.", "erro");
      return;
    }

    const totalParcelasPorFatura = (parcelasData || []).reduce((acc, parcela) => {
      const id = String(parcela.fatura_id);
      acc[id] = (acc[id] || 0) + Number(parcela.valor_parcela || 0);
      return acc;
    }, {});

    const cartoesComResumo = (data || []).map((cartao) => {
      const faturasAtivasDoCartao = (faturasData || []).filter(
        (fatura) => String(fatura.cartao_id) === String(cartao.id)
      );
      const usado = faturasAtivasDoCartao
        .reduce((soma, fatura) => {
          const totalFatura = Math.max(
            Number(fatura.valor_total || 0),
            Number(totalParcelasPorFatura[String(fatura.id)] || 0)
          );

          return soma + Math.max(totalFatura - Number(fatura.valor_pago || 0), 0);
        }, 0);

      const limite = Number(cartao.limite_total || 0);
      const disponivel = limite - usado;
      const percentual = limite > 0 ? (usado / limite) * 100 : usado > 0 ? 100 : 0;
      const percentualBarra = Math.min(percentual, 100);
      const limiteEstourado = limite > 0 && usado > limite;

      return {
        ...cartao,
        tipo_cartao: cartao.tipo_cartao || "proprio",
        usado,
        disponivel,
        percentual,
        percentualBarra,
        limiteEstourado,
        temFaturasAtivas: faturasAtivasDoCartao.length > 0,
      };
    });

    setCartoes(cartoesComResumo);

    if (cartaoSelecionado) {
      const atualizado = cartoesComResumo.find(
        (cartao) => String(cartao.id) === String(cartaoSelecionado.id)
      );

      if (atualizado) setCartaoSelecionado(atualizado);
    }
  }

  function abrirAviso(titulo, mensagem, tipo = "info") {
    setModalAviso({ aberto: true, titulo, mensagem, tipo });
  }

  function fecharAviso() {
    setModalAviso({ aberto: false, titulo: "", mensagem: "", tipo: "info" });
  }

  function abrirNovoCartao() {
    setCartaoEditando(null);
    setModalAberto(true);
  }

  function abrirEditarCartao(cartao) {
    setCartaoEditando(cartao);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setCartaoEditando(null);
  }

  function solicitarExclusaoCartao(cartao) {
    setCartaoParaExcluir(cartao);
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoCartao() {
    if (!cartaoParaExcluir) return;

    const { error } = await supabase
      .from("cartoes")
      .update({ ativo: false })
      .eq("id", cartaoParaExcluir.id);

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao excluir cartão.", "erro");
      return;
    }

    setModalExcluirAberto(false);
    setCartaoParaExcluir(null);
    carregarCartoes();
  }

  if (cartaoSelecionado) {
    return (
      <PainelFaturasCartao
        cartao={cartaoSelecionado}
        contas={contas}
        voltar={() => setCartaoSelecionado(null)}
        formatarMoeda={formatarMoeda}
        formatarMoedaDigitada={formatarMoedaDigitada}
        moedaParaNumero={moedaParaNumero}
        numeroParaMoedaInput={numeroParaMoedaInput}
        abrirAviso={abrirAviso}
        recarregarCartoes={carregarCartoes}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cartões</h1>
          <p className="text-gray-400 mt-2">
            Gerencie cartões próprios, cartões de terceiros, limites e faturas.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNovoCartao}
          className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-4 sm:px-5 py-3 flex items-center justify-center gap-2 shrink-0"
        >
          <FiPlus />
          <span>Novo Cartão</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {cartoes.map((cartao) => {
          const isTerceiro = cartao.tipo_cartao === "terceiro";

          return (
          <div
            key={cartao.id}
            onClick={() => {
              if (!cartao.temFaturasAtivas) {
                abrirAviso("Sem faturas em aberto", "Esse cartão ainda não possui faturas em aberto.", "info");
                return;
              }

              setCartaoSelecionado(cartao);
            }}
            className={`relative rounded-2xl border border-gray-800 bg-[#111827] p-6 overflow-hidden transition ${
              cartao.temFaturasAtivas
                ? "cursor-pointer hover:border-green-400/60"
                : "cursor-not-allowed opacity-80"
            }`}
          >
            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  abrirEditarCartao(cartao);
                }}
                className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:text-white hover:border-green-400 flex items-center justify-center"
                title="Editar cartão"
                aria-label="Editar cartão"
              >
                <FiEdit2 />
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  solicitarExclusaoCartao(cartao);
                }}
                className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:text-red-400 hover:border-red-500/60 flex items-center justify-center"
                title="Excluir cartão"
                aria-label="Excluir cartão"
              >
                <FiTrash2 />
              </button>
            </div>

            <div className="flex items-start gap-3 pr-20">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
                {cartao.tipo_cartao === "terceiro" ? (
                  <FiUser className="w-5 h-5" />
                ) : (
                  <FiCreditCard className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black truncate">{cartao.nome}</h2>
                {!isTerceiro && (
                  <p className="text-gray-400 text-sm mt-1">{textoFinalCartao(cartao)}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs rounded-full px-3 py-1 bg-green-500/10 text-green-400 font-bold">
                {labelTipoCartao(cartao)}
              </span>


            </div>

            <div className="mt-8">
              {isTerceiro ? (
                <div>
                  <p className="text-xs text-gray-400">Usado</p>
                  <p className="text-xl font-bold mt-1">{formatarMoeda(cartao.usado)}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Usado</p>
                      <p className="text-xl font-bold mt-1">{formatarMoeda(cartao.usado)}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-400">Disponível</p>
                      <p className={`text-xl font-bold mt-1 ${corDisponivel(cartao.disponivel)}`}>
                        {formatarMoeda(cartao.disponivel)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-3 bg-[#0B1120] border border-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${corBarra(cartao.percentual)} rounded-full transition-all`}
                      style={{ width: `${cartao.percentualBarra}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{Math.round(cartao.percentual)}% usado</span>
                    <span>Limite {formatarMoeda(cartao.limite_total)}</span>
                  </div>

                  {cartao.limiteEstourado && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-400 font-bold text-sm flex items-center gap-2">
                        <FiAlertTriangle />
                        <span>Limite excedido</span>
                      </p>

                      <p className="text-xs text-gray-300 mt-1">
                        Excedido em {formatarMoeda(Number(cartao.usado || 0) - Number(cartao.limite_total || 0))}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
              {isTerceiro ? (
                <span>Vence dia {cartao.dia_vencimento}</span>
              ) : (
                <>
                  <span>Fecha dia {cartao.dia_fechamento}</span>
                  <span>Vence dia {cartao.dia_vencimento}</span>
                </>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-4">Clique para visualizar as faturas</p>
          </div>
          );
        })}
      </div>

      {cartoes.length === 0 && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400">Nenhum cartão cadastrado ainda.</p>
        </div>
      )}

      <CartaoCadastroModal
        aberto={modalAberto}
        cartaoEditando={cartaoEditando}
        onClose={fecharModal}
        abrirAviso={abrirAviso}
        recarregarCartoes={carregarCartoes}
        formatarMoeda={formatarMoeda}
        formatarMoedaDigitada={formatarMoedaDigitada}
        moedaParaNumero={moedaParaNumero}
        numeroParaMoedaInput={numeroParaMoedaInput}
      />

      {modalExcluirAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-red-400">Excluir Cartão</h2>

            <p className="text-gray-300 mt-4">
              Deseja realmente excluir o cartão <span className="font-bold text-white">{cartaoParaExcluir?.nome}</span>?
            </p>

            <p className="text-gray-500 text-sm mt-2">
              Ele deixará de aparecer para novos lançamentos.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setModalExcluirAberto(false);
                  setCartaoParaExcluir(null);
                }}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarExclusaoCartao}
                className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl p-3"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAviso.aberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className={`text-2xl font-bold ${modalAviso.tipo === "erro" ? "text-red-400" : "text-green-400"}`}>
              {modalAviso.titulo}
            </h2>

            <p className="text-gray-300 mt-4">{modalAviso.mensagem}</p>

            <button
              type="button"
              onClick={fecharAviso}
              className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
