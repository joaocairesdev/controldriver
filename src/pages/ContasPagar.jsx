import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function ContasPagar() {
  const [contas, setContas] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function estaAtrasada(fatura) {
    if (String(fatura.status).toLowerCase() === "paga") return false;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(fatura.data_vencimento);
    vencimento.setHours(0, 0, 0, 0);

    return vencimento < hoje;
  }

  function saldoFatura(fatura) {
    return Math.max(
      Number(fatura.valor_total || 0) - Number(fatura.valor_pago || 0),
      0
    );
  }

  async function carregarDados() {
    setCarregando(true);

    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const contasComSaldo = await Promise.all(
      (contasData || []).map(async (conta) => {
        const { data: entradas } = await supabase
          .from("entradas")
          .select(`
            entrada_plataformas (
              faturamento,
              valor_reembolso
            )
          `)
          .eq("conta_id", conta.id);

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
          .eq("conta_id", conta.id);

        const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
          (total, entrada) => total + Number(entrada.valor || 0),
          0
        );

        const { data: transferenciasRecebidas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_destino_id", conta.id);

        const totalTransferenciasRecebidas = (
          transferenciasRecebidas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", conta.id);

        const totalTransferenciasEnviadas = (
          transferenciasEnviadas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", conta.id);

        const totalSaidas = (saidas || [])
          .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
          .reduce(
            (total, saida) => total + Number(saida.valor_total || 0),
            0
          );

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

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select(`
        *,
        cartoes (
          nome,
          final_cartao
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .order("data_vencimento", { ascending: true });

    setContas(contasComSaldo);
    setFaturas(faturasData || []);
    setCarregando(false);
  }

  const contasNegativas = contas.filter((conta) => {
    const isTagPrePaga =
      conta.tipo_conta === "tag" && (conta.tipo_tag || "pre_paga") === "pre_paga";

    return !isTagPrePaga && Number(conta.saldo_atual || 0) < 0;
  });

  const totalChequeEspecial = contasNegativas.reduce(
    (total, conta) => total + Math.abs(Number(conta.saldo_atual || 0)),
    0
  );

  const totalFaturas = faturas.reduce(
    (total, fatura) => total + saldoFatura(fatura),
    0
  );

  const faturasAtrasadas = faturas.filter((fatura) => estaAtrasada(fatura));

  const totalAtrasado = faturasAtrasadas.reduce(
    (total, fatura) => total + saldoFatura(fatura),
    0
  );

  const totalGeral = totalChequeEspecial + totalFaturas;

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Contas a Pagar</h1>
        <p className="text-gray-400 mt-2">
          Visão geral das dívidas, faturas e saldos negativos
        </p>
      </div>

      {carregando && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando contas a pagar...</p>
        </div>
      )}

      {!carregando && (
        <>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ResumoCard
              titulo="Total a Pagar"
              valor={formatarMoeda(totalGeral)}
              destaque="red"
            />

            <ResumoCard
              titulo="Faturas em aberto"
              valor={formatarMoeda(totalFaturas)}
              destaque="yellow"
            />

            <ResumoCard
              titulo="Faturas atrasadas"
              valor={formatarMoeda(totalAtrasado)}
              destaque={totalAtrasado > 0 ? "red" : "green"}
            />

            <ResumoCard
              titulo="Cheque especial usado"
              valor={formatarMoeda(totalChequeEspecial)}
              destaque={totalChequeEspecial > 0 ? "red" : "green"}
            />
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-bold">Faturas</h2>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {faturas.map((fatura) => {
                const atrasada = estaAtrasada(fatura);
                const saldo = saldoFatura(fatura);

                return (
                  <div
                    key={fatura.id}
                    className={`bg-[#111827] border rounded-2xl p-5 ${
                      atrasada
                        ? "border-red-500/40"
                        : "border-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">
                          {fatura.cartoes?.nome || "Cartão"}
                        </h3>

                        <p className="text-sm text-gray-400 mt-1">
                          Final {fatura.cartoes?.final_cartao || "-"}
                        </p>
                      </div>

                      <span
                        className={`text-xs rounded-full px-3 py-1 font-bold ${
                          atrasada
                            ? "bg-red-500/10 text-red-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {atrasada ? "⚠ Em atraso" : "Aberta"}
                      </span>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs text-gray-500">Valor em aberto</p>
                      <p
                        className={`text-2xl font-black mt-1 ${
                          atrasada ? "text-red-400" : "text-white"
                        }`}
                      >
                        {formatarMoeda(saldo)}
                      </p>
                    </div>

                    <p className="text-sm text-gray-400 mt-4">
                      Vencimento:{" "}
                      <span className="font-bold text-white">
                        {formatarDataBR(fatura.data_vencimento)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>

            {faturas.length === 0 && (
              <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-6">
                <p className="text-gray-400">Nenhuma fatura em aberto.</p>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-bold">Contas negativas</h2>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {contasNegativas.map((conta) => (
                <div
                  key={conta.id}
                  className="bg-red-500/10 border border-red-500/40 rounded-2xl p-5"
                >
                  <h3 className="font-bold">{conta.nome}</h3>

                  <p className="text-xs text-gray-400 mt-5">
                    Saldo negativo
                  </p>

                  <p className="text-2xl font-black text-red-400 mt-1">
                    {formatarMoeda(conta.saldo_atual)}
                  </p>

                  <p className="text-xs text-yellow-400 mt-4">
                    Pode haver cobrança de juros se estiver usando cheque especial.
                  </p>
                </div>
              ))}
            </div>

            {contasNegativas.length === 0 && (
              <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-6">
                <p className="text-gray-400">Nenhuma conta negativa.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

function ResumoCard({ titulo, valor, destaque }) {
  const cores = {
    red: "text-red-400 border-red-500/40 bg-red-500/10",
    yellow: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
    green: "text-green-400 border-green-500/40 bg-green-500/10",
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${
        cores[destaque] || "border-gray-800 bg-[#111827] text-white"
      }`}
    >
      <p className="text-sm text-gray-300">{titulo}</p>
      <p className="text-2xl font-black mt-2">{valor}</p>
    </div>
  );
}