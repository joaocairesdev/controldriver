import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiSettings,
} from "react-icons/fi";
import { supabase } from "../services/supabase";

import ModalBase from "../components/modals/ModalBase";
import DatePickerModal from "../components/modals/DatePickerModal";
import SelecionarContaModal from "../components/modals/SelecionarContaModal";
import FeedbackModal from "../components/modals/FeedbackModal";
import ConfirmacaoModal from "../components/modals/ConfirmacaoModal";
import DetalheFaturaModal from "../cartoes/components/DetalheFaturaModal";
import RegistrarPagamentoModal from "../contas/components/RegistrarPagamentoModal";
import {
  calcularSaldoAbertoFatura,
  detalheCartao,
} from "../cartoes/cartoesUtils";

const HOJE = new Date().toISOString().split("T")[0];
const PROXIMOS_DIAS = 7;

export default function ContasPagar() {
  const [contas, setContas] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [pagamentoConta, setPagamentoConta] = useState(null);
  const [regularizacaoConta, setRegularizacaoConta] = useState(null);
  const [configAberto, setConfigAberto] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  const [config, setConfig] = useState({
    mostrarAtrasadas: true,
    mostrarNegativas: true,
    mostrarHoje: true,
    mostrarProximas: true,
    mostrarFuturas: true,
    mostrarFaturas: true,
    mostrarContas: true,
  });

  useEffect(() => {
    carregarDados();
  }, []);

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
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

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "-";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function diferencaDias(dataISO) {
    if (!dataISO) return 9999;

    const hoje = new Date(`${HOJE}T00:00:00`);
    const data = new Date(`${dataISO}T00:00:00`);

    return Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  }

  function estaAtrasadaPorData(dataISO, status) {
    if (String(status || "").toLowerCase() === "paga") return false;
    return diferencaDias(dataISO) < 0;
  }

  function saldoContaPagar(conta) {
    return Math.max(
      Number(conta?.valor_total || 0) - Number(conta?.valor_pago || 0),
      0
    );
  }

  function textoFormaPagamento(valor) {
    const nomes = {
      boleto: "Boleto",
      boleto_parcelado: "Boleto Parcelado",
      pix: "Pix",
      debito: "Débito",
      dinheiro: "Dinheiro",
    };

    return nomes[valor] || valor || "Conta a pagar";
  }

  async function carregarDados() {
    setCarregando(true);

    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const contasComSaldo = await carregarContasComSaldo(contasData || []);

    const { data: faturasData } = await supabase
      .from("faturas_cartao")
      .select(`
        *,
        cartoes (
          id,
          nome,
          final_cartao,
          tipo_cartao
        )
      `)
      .in("status", ["aberta", "fechada", "parcial"])
      .order("data_vencimento", { ascending: true });

    const { data: contasPagarData } = await supabase
      .from("saidas")
      .select("*")
      .eq("tipo_movimentacao", "conta_pagar")
      .in("status", ["aberto", "pendente", "parcial"])
      .order("data_vencimento", { ascending: true });

    setContas(contasComSaldo);
    setFaturas(faturasData || []);
    setContasPagar(contasPagarData || []);
    setCarregando(false);
  }

  async function carregarContasComSaldo(contasBase) {
    return Promise.all(
      (contasBase || []).map(async (conta) => {
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

        const totalTransferenciasRecebidas = (
          transferenciasRecebidas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: transferenciasEnviadas } = await supabase
          .from("transferencias")
          .select("valor")
          .eq("conta_origem_id", contaId);

        const totalTransferenciasEnviadas = (
          transferenciasEnviadas || []
        ).reduce(
          (total, transferencia) => total + Number(transferencia.valor || 0),
          0
        );

        const { data: saidas } = await supabase
          .from("saidas")
          .select("valor_total, tipo_movimentacao")
          .eq("conta_id", contaId);

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
    (total, fatura) => total + calcularSaldoAbertoFatura(fatura),
    0
  );

  const totalContasPagar = contasPagar.reduce(
    (total, conta) => total + saldoContaPagar(conta),
    0
  );

  const faturasAtrasadas = faturas.filter((fatura) =>
    estaAtrasadaPorData(fatura.data_vencimento, fatura.status)
  );

  const contasAtrasadas = contasPagar.filter((conta) =>
    estaAtrasadaPorData(conta.data_vencimento, conta.status)
  );

  const totalAtrasado =
    faturasAtrasadas.reduce(
      (total, fatura) => total + calcularSaldoAbertoFatura(fatura),
      0
    ) +
    contasAtrasadas.reduce((total, conta) => total + saldoContaPagar(conta), 0);

  const totalGeral = totalChequeEspecial + totalFaturas + totalContasPagar;

  const itens = useMemo(() => {
    const lista = [];

    if (config.mostrarFaturas) {
      for (const fatura of faturas) {
        const saldo = calcularSaldoAbertoFatura(fatura);
        if (saldo <= 0) continue;

        const dias = diferencaDias(fatura.data_vencimento);
        const atrasada = dias < 0;

        lista.push({
          id: `fatura-${fatura.id}`,
          tipo: "fatura",
          titulo: fatura.cartoes?.nome || "Cartão",
          detalhe: detalheCartao(fatura.cartoes),
          valor: saldo,
          data: fatura.data_vencimento,
          dias,
          atrasada,
          status: fatura.status || "aberta",
          original: fatura,
          selo: atrasada ? "Fatura atrasada" : "Fatura",
        });
      }
    }

    if (config.mostrarContas) {
      for (const conta of contasPagar) {
        const saldo = saldoContaPagar(conta);
        if (saldo <= 0) continue;

        const dias = diferencaDias(conta.data_vencimento);
        const atrasada = dias < 0;

        lista.push({
          id: `conta-${conta.id}`,
          tipo: "conta",
          titulo: conta.descricao || conta.categoria || "Conta a pagar",
          detalhe: conta.categoria || textoFormaPagamento(conta.forma_pagamento),
          valor: saldo,
          data: conta.data_vencimento,
          dias,
          atrasada,
          status: conta.status || "pendente",
          original: conta,
          selo: atrasada ? "Conta atrasada" : textoFormaPagamento(conta.forma_pagamento),
        });
      }
    }

    if (config.mostrarNegativas) {
      for (const conta of contasNegativas) {
        lista.push({
          id: `negativa-${conta.id}`,
          tipo: "negativa",
          titulo: conta.nome,
          detalhe: "Saldo negativo",
          valor: Math.abs(Number(conta.saldo_atual || 0)),
          data: null,
          dias: -999,
          atrasada: true,
          status: "negativa",
          original: conta,
          selo: "Conta negativa",
        });
      }
    }

    return lista.sort((a, b) => {
      if (a.tipo === "negativa" && b.tipo !== "negativa") return -1;
      if (b.tipo === "negativa" && a.tipo !== "negativa") return 1;
      return a.dias - b.dias;
    });
  }, [faturas, contasPagar, contasNegativas, config]);

  const grupos = useMemo(() => {
    const prioridade = itens.filter(
      (item) =>
        ((item.atrasada && item.tipo !== "negativa" && config.mostrarAtrasadas) ||
          (item.tipo === "negativa" && config.mostrarNegativas))
    );

    const hoje = itens.filter(
      (item) => item.dias === 0 && item.tipo !== "negativa" && config.mostrarHoje
    );

    const proximos = itens.filter(
      (item) =>
        item.dias > 0 &&
        item.dias <= PROXIMOS_DIAS &&
        item.tipo !== "negativa" &&
        config.mostrarProximas
    );

    const futuras = itens.filter(
      (item) =>
        item.dias > PROXIMOS_DIAS &&
        item.tipo !== "negativa" &&
        config.mostrarFuturas
    );

    return [
      {
        id: "prioridade",
        titulo: "Prioridade",
        descricao: "Atrasadas e contas negativas aparecem primeiro.",
        icone: FiAlertTriangle,
        destaque: "red",
        itens: prioridade,
      },
      {
        id: "hoje",
        titulo: "Vence hoje",
        descricao: "Pagamentos que precisam de atenção hoje.",
        icone: FiCalendar,
        destaque: "yellow",
        itens: hoje,
      },
      {
        id: "proximos",
        titulo: "Próximos vencimentos",
        descricao: `Vencimentos dos próximos ${PROXIMOS_DIAS} dias.`,
        icone: FiCalendar,
        destaque: "blue",
        itens: proximos,
      },
      {
        id: "futuras",
        titulo: "Futuras",
        descricao: "Contas e faturas com vencimento mais para frente.",
        icone: FiFileText,
        destaque: "gray",
        itens: futuras,
      },
    ];
  }, [itens, config]);

  function abrirItem(item) {
    if (item.tipo === "fatura") {
      setItemSelecionado(item);
      return;
    }

    if (item.tipo === "negativa") {
      setRegularizacaoConta(item.original);
      return;
    }

    setItemSelecionado(item);
  }

  function contaDaFatura(item) {
    if (!item || item.tipo !== "fatura") return null;

    return {
      id: item.original.cartao_id,
      nome: item.original.cartoes?.nome || "Cartão",
      final_cartao: item.original.cartoes?.final_cartao,
      tipo_cartao: item.original.cartoes?.tipo_cartao,
    };
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas a Pagar</h1>
          <p className="text-gray-400 mt-2">
            Priorize atrasadas, contas negativas e os próximos vencimentos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfigAberto(true)}
          className="w-11 h-11 rounded-xl border border-gray-700 bg-[#111827] hover:bg-white/5 text-green-400 flex items-center justify-center shrink-0"
          title="Configurar visualização"
          aria-label="Configurar visualização"
        >
          <FiSettings className="w-5 h-5" />
        </button>
      </div>

      {carregando && (
        <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Carregando contas a pagar...</p>
        </div>
      )}

      {!carregando && (
        <>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <ResumoCard titulo="Total a pagar" valor={formatarMoeda(totalGeral)} destaque="red" />
            <ResumoCard titulo="Faturas" valor={formatarMoeda(totalFaturas)} destaque="yellow" />
            <ResumoCard titulo="Contas/boletos" valor={formatarMoeda(totalContasPagar)} destaque="blue" />
            <ResumoCard titulo="Atrasado" valor={formatarMoeda(totalAtrasado)} destaque={totalAtrasado > 0 ? "red" : "green"} />
            <ResumoCard titulo="Negativo" valor={formatarMoeda(totalChequeEspecial)} destaque={totalChequeEspecial > 0 ? "red" : "green"} />
          </div>

          <div className="mt-8 space-y-8">
            {grupos.map((grupo) => (
              <GrupoPrioridade
                key={grupo.id}
                grupo={grupo}
                abrirItem={abrirItem}
                formatarMoeda={formatarMoeda}
                formatarDataBR={formatarDataBR}
              />
            ))}
          </div>
        </>
      )}

      {configAberto && (
        <ConfiguracaoModal
          config={config}
          setConfig={setConfig}
          fechar={() => setConfigAberto(false)}
        />
      )}

      {itemSelecionado?.tipo === "conta" && (
        <DetalheContaPagarModal
          item={itemSelecionado}
          fechar={() => setItemSelecionado(null)}
          pagar={() => {
            setPagamentoConta(itemSelecionado.original);
            setItemSelecionado(null);
          }}
          formatarMoeda={formatarMoeda}
          formatarDataBR={formatarDataBR}
          textoFormaPagamento={textoFormaPagamento}
        />
      )}

      {itemSelecionado?.tipo === "fatura" && (
        <DetalheFaturaModal
          fatura={itemSelecionado.original}
          cartao={contaDaFatura(itemSelecionado)}
          contas={contas.filter((conta) => (conta.tipo_conta || "banco") !== "tag")}
          fechar={() => {
            setItemSelecionado(null);
            carregarDados();
          }}
          tituloFatura={(fatura) => `${String(fatura.mes || "").padStart(2, "0")}/${fatura.ano}`}
          saldoFatura={calcularSaldoAbertoFatura}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          moedaParaNumero={moedaParaNumero}
          numeroParaMoedaInput={numeroParaMoedaInput}
          formatarDataBR={formatarDataBR}
          abrirAviso={(titulo, mensagem, tipo = "aviso") => abrirFeedback(tipo, titulo, mensagem)}
          recarregar={carregarDados}
        />
      )}

      {pagamentoConta && (
        <RegistrarPagamentoModal
          aberto={true}
          contaPagar={pagamentoConta}
          contas={contas.filter((conta) => (conta.tipo_conta || "banco") !== "tag")}
          saldoContaPagar={saldoContaPagar}
          onClose={() => setPagamentoConta(null)}
          onSalvo={async () => {
            setPagamentoConta(null);
            await carregarDados();
            abrirFeedback("sucesso", "Pagamento registrado", "A baixa financeira foi registrada com sucesso.");
          }}
        />
      )}

      {regularizacaoConta && (
        <RegularizarContaModal
          contaNegativa={regularizacaoConta}
          contas={contas.filter(
            (conta) =>
              (conta.tipo_conta || "banco") !== "tag" &&
              String(conta.id) !== String(regularizacaoConta.id)
          )}
          formatarMoeda={formatarMoeda}
          formatarMoedaDigitada={formatarMoedaDigitada}
          moedaParaNumero={moedaParaNumero}
          numeroParaMoedaInput={numeroParaMoedaInput}
          formatarDataBR={formatarDataBR}
          fechar={() => setRegularizacaoConta(null)}
          onSalvo={async () => {
            setRegularizacaoConta(null);
            await carregarDados();
            abrirFeedback("sucesso", "Conta regularizada", "A transferência foi registrada com sucesso.");
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

function GrupoPrioridade({ grupo, abrirItem, formatarMoeda, formatarDataBR }) {
  const Icone = grupo.icone;
  const cores = {
    red: "text-red-400 bg-red-500/10 border-red-500/30",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    gray: "text-gray-300 bg-[#111827] border-gray-800",
  };

  return (
    <section>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cores[grupo.destaque] || cores.gray}`}>
          <Icone />
        </div>
        <div>
          <h2 className="text-xl font-black">{grupo.titulo}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{grupo.descricao}</p>
        </div>
      </div>

      {grupo.itens.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {grupo.itens.map((item) => (
            <ContaCard
              key={item.id}
              item={item}
              onClick={() => abrirItem(item)}
              formatarMoeda={formatarMoeda}
              formatarDataBR={formatarDataBR}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-5">
          <p className="text-sm text-gray-400">Nada por aqui.</p>
        </div>
      )}
    </section>
  );
}

function ContaCard({ item, onClick, formatarMoeda, formatarDataBR }) {
  const isNegativa = item.tipo === "negativa";
  const isFatura = item.tipo === "fatura";
  const atrasada = item.atrasada;

  const Icone = isNegativa ? FiAlertTriangle : isFatura ? FiCreditCard : FiFileText;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-[#111827] border rounded-2xl p-5 hover:border-green-400/70 transition ${
        isNegativa || atrasada ? "border-red-500/40" : "border-gray-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isNegativa || atrasada ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
            }`}
          >
            <Icone />
          </div>

          <div className="min-w-0">
            <h3 className="font-black truncate">{item.titulo}</h3>
            <p className="text-sm text-gray-400 mt-1 truncate">{item.detalhe}</p>
          </div>
        </div>

        <span
          className={`text-[11px] rounded-full px-2.5 py-1 font-black whitespace-nowrap ${
            isNegativa || atrasada
              ? "bg-red-500/10 text-red-400"
              : item.dias === 0
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-blue-500/10 text-blue-400"
          }`}
        >
          {isNegativa ? "Negativa" : atrasada ? "Em atraso" : item.selo}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs text-gray-500">{isNegativa ? "Valor para regularizar" : "Valor em aberto"}</p>
        <p
          className={`text-2xl font-black mt-1 ${
            isNegativa || atrasada ? "text-red-400" : "text-white"
          }`}
        >
          {formatarMoeda(item.valor)}
        </p>
      </div>

      <p className="text-sm text-gray-400 mt-4">
        {isNegativa ? (
          "Clique para regularizar o saldo."
        ) : (
          <>
            Vencimento: <span className="font-bold text-white">{formatarDataBR(item.data)}</span>
          </>
        )}
      </p>
    </button>
  );
}

function DetalheContaPagarModal({ item, fechar, pagar, formatarMoeda, formatarDataBR, textoFormaPagamento }) {
  const conta = item.original;

  return (
    <ModalBase
      aberto={true}
      titulo="Detalhes da conta"
      descricao={conta.descricao || conta.categoria || "Conta a pagar"}
      onClose={fechar}
      largura="max-w-xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Valor em aberto</p>
          <p className={`text-3xl font-black mt-2 ${item.atrasada ? "text-red-400" : "text-white"}`}>
            {formatarMoeda(item.valor)}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard titulo="Categoria" valor={conta.categoria || "-"} />
          <InfoCard titulo="Forma" valor={textoFormaPagamento(conta.forma_pagamento)} />
          <InfoCard titulo="Vencimento" valor={formatarDataBR(conta.data_vencimento)} />
          <InfoCard titulo="Status" valor={conta.status || "pendente"} />
          <InfoCard titulo="Descrição" valor={conta.descricao || conta.categoria || "-"} />
          <InfoCard titulo="Pago até agora" valor={formatarMoeda(conta.valor_pago || 0)} />
        </div>

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={fechar}
            className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={pagar}
            className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3"
          >
            Marcar pagamento
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

function RegularizarContaModal({
  contaNegativa,
  contas,
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
  formatarDataBR,
  fechar,
  onSalvo,
}) {
  const valorNecessario = Math.abs(Number(contaNegativa.saldo_atual || 0));
  const [data, setData] = useState(HOJE);
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [valor, setValor] = useState(numeroParaMoedaInput(valorNecessario));
  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  useEffect(() => {
    const principal = contas.find((conta) => conta.principal) || contas[0];
    if (principal) setContaOrigemId(String(principal.id));
  }, [contas]);

  const contaOrigem = contas.find((conta) => String(conta.id) === String(contaOrigemId));

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  async function salvar() {
    const valorNumero = moedaParaNumero(valor);

    if (!data) {
      setFeedback({ aberto: true, tipo: "erro", titulo: "Data obrigatória", mensagem: "Informe a data da regularização." });
      return;
    }

    if (!contaOrigemId) {
      setFeedback({ aberto: true, tipo: "erro", titulo: "Conta obrigatória", mensagem: "Selecione a conta de origem." });
      return;
    }

    if (valorNumero <= 0) {
      setFeedback({ aberto: true, tipo: "erro", titulo: "Valor inválido", mensagem: "Informe um valor maior que zero." });
      return;
    }

    setSalvando(true);

    try {
      const { error } = await supabase.from("transferencias").insert({
        data,
        conta_origem_id: Number(contaOrigemId),
        conta_destino_id: Number(contaNegativa.id),
        valor: valorNumero,
        descricao: `Regularização de saldo - ${contaNegativa.nome}`,
        tipo: "regularizacao_saldo",
      });

      if (error) throw error;

      onSalvo?.();
    } catch (error) {
      console.error(error);
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Erro ao regularizar",
        mensagem: error.message || "Erro ao registrar transferência.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo="Regularizar conta negativa"
        descricao={contaNegativa.nome}
        onClose={fechar}
        largura="max-w-xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-5">
            <p className="text-xs text-red-300 font-bold uppercase tracking-wide">Saldo negativo atual</p>
            <p className="text-3xl font-black text-red-400 mt-2">{formatarMoeda(contaNegativa.saldo_atual)}</p>
            <p className="text-sm text-yellow-300 mt-2">Pode haver cobrança de juros se estiver usando cheque especial.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Data">
              <ButtonField onClick={() => setModalDataAberto(true)}>{formatarDataBR(data)}</ButtonField>
            </Campo>

            <Campo label="Conta origem">
              <ButtonField onClick={() => setModalContaAberto(true)}>{contaOrigem?.nome || "Selecionar conta"}</ButtonField>
            </Campo>
          </div>

          <Campo label="Valor para transferir">
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={valor}
                onChange={(event) => setValor(formatarMoedaDigitada(event.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </Campo>

          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 pt-4 pb-1 bg-[#111827]">
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
              onClick={salvar}
              disabled={salvando}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Regularizar"}
            </button>
          </div>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={data}
        onChange={setData}
        onClose={() => setModalDataAberto(false)}
        titulo="Data da regularização"
        descricao="Escolha a data da transferência."
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contas}
        contaId={contaOrigemId}
        onSelecionar={setContaOrigemId}
        onClose={() => setModalContaAberto(false)}
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

function ConfiguracaoModal({ config, setConfig, fechar }) {
  const opcoes = [
    { chave: "mostrarAtrasadas", titulo: "Atrasadas", descricao: "Contas e faturas vencidas." },
    { chave: "mostrarNegativas", titulo: "Contas negativas", descricao: "Contas bancárias no negativo." },
    { chave: "mostrarHoje", titulo: "Vence hoje", descricao: "Itens com vencimento no dia atual." },
    { chave: "mostrarProximas", titulo: "Próximos vencimentos", descricao: "Itens dos próximos dias." },
    { chave: "mostrarFuturas", titulo: "Futuras", descricao: "Itens com vencimento mais distante." },
    { chave: "mostrarFaturas", titulo: "Faturas", descricao: "Faturas de cartão." },
    { chave: "mostrarContas", titulo: "Contas e boletos", descricao: "Contas cadastradas como conta a pagar." },
  ];

  return (
    <ModalBase
      aberto={true}
      titulo="Configurar visualização"
      descricao="Escolha o que deseja ver no Contas a Pagar."
      onClose={fechar}
      largura="max-w-lg"
    >
      <div className="space-y-3">
        {opcoes.map((opcao) => {
          const ativo = config[opcao.chave];

          return (
            <button
              key={opcao.chave}
              type="button"
              onClick={() => setConfig((atual) => ({ ...atual, [opcao.chave]: !ativo }))}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                ativo
                  ? "border-green-400 bg-green-500/10"
                  : "border-gray-700 bg-[#0B1120] hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`font-black ${ativo ? "text-green-400" : "text-white"}`}>{opcao.titulo}</p>
                  <p className="text-xs text-gray-500 mt-1">{opcao.descricao}</p>
                </div>

                <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black ${
                  ativo ? "bg-green-500 border-green-500 text-black" : "border-gray-600 text-transparent"
                }`}>
                  ✓
                </span>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={fechar}
          className="w-full mt-4 bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3"
        >
          Aplicar
        </button>
      </div>
    </ModalBase>
  );
}

function ResumoCard({ titulo, valor, destaque }) {
  const cores = {
    red: "text-red-400 border-red-500/40 bg-red-500/10",
    yellow: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
    green: "text-green-400 border-green-500/40 bg-green-500/10",
    blue: "text-blue-400 border-blue-500/40 bg-blue-500/10",
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

function InfoCard({ titulo, valor }) {
  return (
    <div className="rounded-2xl bg-[#0B1120] border border-gray-800 p-4">
      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{titulo}</p>
      <p className="font-black mt-1 break-words">{valor}</p>
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
