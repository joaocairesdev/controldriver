import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import DetalheFaturaModal from "./components/DetalheFaturaModal";
import {
  TIPOS_CARTAO,
  calcularSaldoAbertoFatura,
  corBarra,
  corDisponivel,
  formatarDataBR,
  labelTipoCartao,
  textoFinalCartao,
} from "./cartoesUtils";

export default function TelaFaturasCartao({
  cartao,
  contas,
  voltar,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
  abrirAviso,
  recarregarCartoes,
}) {
  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [faturaSelecionada, setFaturaSelecionada] = useState(null);
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const isTerceiro = (cartao?.tipo_cartao || TIPOS_CARTAO.PROPRIO) === TIPOS_CARTAO.TERCEIRO;

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  useEffect(() => {
    carregarFaturas();
  }, [cartao.id]);

  async function carregarFaturas() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("faturas_cartao")
      .select("*")
      .eq("cartao_id", cartao.id)
      .order("data_vencimento", { ascending: true });

    if (error) {
      console.error(error);
      setCarregando(false);
      abrirAviso("Erro", "Erro ao carregar faturas do cartão.", "erro");
      return;
    }

    setFaturas(data || []);

    if (faturaSelecionada) {
      const atualizada = (data || []).find(
        (fatura) => String(fatura.id) === String(faturaSelecionada.id)
      );

      if (atualizada) setFaturaSelecionada(atualizada);
    }

    setCarregando(false);
  }

  function tituloFatura(fatura) {
    return `${meses[Number(fatura.mes || 1) - 1]} ${fatura.ano}`;
  }

  function obterStatusFatura(fatura) {
    const status = String(fatura.status || "").toLowerCase();

    if (status === "paga") {
      return { texto: "Paga", classe: "bg-green-500/10 text-green-400" };
    }

    if (status === "parcial") {
      return { texto: "Parcial", classe: "bg-yellow-500/10 text-yellow-400" };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(`${fatura.data_vencimento}T00:00:00`);
    vencimento.setHours(0, 0, 0, 0);

    if (vencimento < hoje) {
      return { texto: "Em atraso", classe: "bg-red-500/10 text-red-400" };
    }

    return { texto: "Aberta", classe: "bg-blue-500/10 text-blue-400" };
  }

  function resumoValorFatura(fatura) {
    const status = String(fatura.status || "aberta").toLowerCase();

    if (status === "paga") {
      return {
        label: "Valor pago",
        valor: Number(fatura.valor_pago || fatura.valor_total || 0),
        className: "text-green-400",
      };
    }

    if (status === "parcial") {
      return {
        label: "Em aberto",
        valor: calcularSaldoAbertoFatura(fatura),
        className: "text-red-400",
      };
    }

    return {
      label: "Valor total",
      valor: Number(fatura.valor_total || 0),
      className: "text-white",
    };
  }

  const faturasExibidas = mostrarPagas
    ? faturas
    : faturas.filter((fatura) => String(fatura.status).toLowerCase() !== "paga");

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={voltar}
          className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center"
        >
          ←
        </button>

        <div>
          <h1 className="text-3xl font-bold">{cartao.nome}</h1>
          <p className="text-gray-400 mt-1">
            {labelTipoCartao(cartao)}{!isTerceiro && ` • ${textoFinalCartao(cartao)}`}
          </p>
        </div>
      </div>

      <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        {isTerceiro ? (
          <div>
            <p className="text-gray-400">Usado neste cartão</p>
            <h2 className="text-4xl font-bold mt-2">
              {formatarMoeda(cartao.usado)}
            </h2>
            <p className="text-gray-500 text-sm mt-3">
              Cartão de terceiro sem limite controlado pelo app.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-gray-400">Limite Total</p>
                <h2 className="text-4xl font-bold mt-2">
                  {formatarMoeda(cartao.limite_total)}
                </h2>
              </div>

              <div className="text-right">
                <p className="text-gray-400">Disponível</p>
                <h2 className={`text-4xl font-bold mt-2 ${corDisponivel(cartao.disponivel)}`}>
                  {formatarMoeda(cartao.disponivel)}
                </h2>
              </div>
            </div>

            <div className="mt-6 h-3 bg-[#0B1120] border border-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${corBarra(cartao.percentual)} rounded-full`}
                style={{ width: `${cartao.percentualBarra}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Faturas</h2>

        <button
          type="button"
          onClick={() => setMostrarPagas((valor) => !valor)}
          className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
            mostrarPagas
              ? "border-green-400 bg-green-500/10 text-green-400"
              : "border-gray-700 text-gray-400 hover:bg-white/5"
          }`}
        >
          {mostrarPagas ? "Ocultar pagas" : "Mostrar pagas"}
        </button>
      </div>

      {carregando && (
        <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando faturas...</p>
        </div>
      )}

      {!carregando && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {faturasExibidas.map((fatura) => {
            const resumo = resumoValorFatura(fatura);
            const statusVisual = obterStatusFatura(fatura);

            return (
              <button
                type="button"
                key={fatura.id}
                onClick={() => setFaturaSelecionada(fatura)}
                className="text-left bg-[#111827] border border-gray-800 hover:border-green-400/60 rounded-2xl p-6 transition disabled:hover:border-gray-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{tituloFatura(fatura)}</h3>

                  <span className={`text-xs rounded-full px-3 py-1 font-bold ${statusVisual.classe}`}>
                    {statusVisual.texto}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs text-gray-500">{resumo.label}</p>
                  <p className={`text-3xl font-black mt-1 ${resumo.className}`}>
                    {formatarMoeda(resumo.valor)}
                  </p>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Vencimento</p>
                    <p className="text-lg font-bold text-white mt-1">
                      {formatarDataBR(fatura.data_vencimento)}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">Clique para detalhes</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {faturas.length === 0 && !carregando && (
        <div className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold">Nenhuma fatura ainda</h3>
          <p className="text-gray-400 mt-2">
            Quando uma saída for lançada no crédito, a fatura será criada automaticamente aqui.
          </p>
        </div>
      )}

      {faturaSelecionada && (
        <DetalheFaturaModal
          fatura={faturaSelecionada}
          cartao={cartao}
          contas={contas}
          fechar={() => setFaturaSelecionada(null)}
          tituloFatura={tituloFatura}
          saldoFatura={calcularSaldoAbertoFatura}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          moedaParaNumero={moedaParaNumero}
          numeroParaMoedaInput={numeroParaMoedaInput}
          formatarDataBR={formatarDataBR}
          abrirAviso={abrirAviso}
          recarregar={async () => {
            await carregarFaturas();
            await recarregarCartoes();
          }}
        />
      )}
    </div>
  );
}
