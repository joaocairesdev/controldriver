import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

import ModalBase from "./ModalBase";
import DatePickerModal from "./DatePickerModal";
import SelecionarContaModal from "./SelecionarContaModal";
import FeedbackModal from "./FeedbackModal";

import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
} from "../../utils/moeda";

import {
  hojeBrasil,
  formatarDataBR,
} from "../../utils/data";

export default function TransferenciaModal({ aberto, onClose }) {
  const hoje = hojeBrasil();

  const [contas, setContas] = useState([]);
  const [data, setData] = useState(hoje);
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalOrigemAberto, setModalOrigemAberto] = useState(false);
  const [modalDestinoAberto, setModalDestinoAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });

  useEffect(() => {
    if (aberto) carregarContas();
  }, [aberto]);

  const contaOrigem = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaOrigemId)),
    [contas, contaOrigemId]
  );

  const contaDestino = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaDestinoId)),
    [contas, contaDestinoId]
  );

  const contasTransferiveis = useMemo(
    () => contas.filter((conta) => (conta.tipo_conta || "banco") !== "tag"),
    [contas]
  );

  const contasOrigemDisponiveis = useMemo(
    () => contasTransferiveis.filter((conta) => String(conta.id) !== String(contaDestinoId)),
    [contasTransferiveis, contaDestinoId]
  );

  const contasDestinoDisponiveis = useMemo(
    () => contasTransferiveis.filter((conta) => String(conta.id) !== String(contaOrigemId)),
    [contasTransferiveis, contaOrigemId]
  );

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
          .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

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

  async function carregarContas() {
    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    const contasComSaldo = await carregarContasComSaldo(contasData || []);
    setContas(contasComSaldo);
  }

  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois });
  }

  function fecharFeedback() {
    const deveFechar = feedback.fecharDepois;

    setFeedback({
      aberto: false,
      tipo: "sucesso",
      titulo: "",
      mensagem: "",
      fecharDepois: false,
    });

    if (deveFechar) {
      limparFormulario();
      onClose?.();
    }
  }

  function limparFormulario() {
    setData(hoje);
    setContaOrigemId("");
    setContaDestinoId("");
    setValor("");
    setDescricao("");
  }

  function cancelar() {
    limparFormulario();
    onClose?.();
  }

  function validar() {
    const valorNumero = moedaParaNumero(valor);

    if (!data) {
      abrirFeedback("erro", "Data obrigatória", "Selecione a data da transferência.");
      return false;
    }

    if (!contaOrigemId) {
      abrirFeedback("erro", "Origem obrigatória", "Selecione a conta de origem.");
      return false;
    }

    if (!contaDestinoId) {
      abrirFeedback("erro", "Destino obrigatório", "Selecione a conta de destino.");
      return false;
    }

    if (String(contaOrigemId) === String(contaDestinoId)) {
      abrirFeedback("erro", "Contas iguais", "A conta de origem e destino não podem ser a mesma.");
      return false;
    }

    if (valorNumero <= 0) {
      abrirFeedback("erro", "Valor obrigatório", "Informe um valor maior que zero.");
      return false;
    }

    return true;
  }

  async function salvarTransferencia() {
    if (!validar()) return;

    setSalvando(true);

    try {
      const valorNumero = moedaParaNumero(valor);

      const { error } = await supabase.from("transferencias").insert({
        data,
        conta_origem_id: Number(contaOrigemId),
        conta_destino_id: Number(contaDestinoId),
        valor: valorNumero,
        descricao: descricao.trim() || null,
        tipo: "transferencia",
      });

      if (error) throw error;

      abrirFeedback(
        "sucesso",
        "Transferência salva",
        "A transferência foi registrada com sucesso.",
        true
      );
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao salvar",
        error.message || "Erro ao salvar transferência."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Transferência"
        descricao="Movimente valores entre contas e carteira."
        onClose={cancelar}
        largura="max-w-xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Data">
            <ButtonField onClick={() => setModalDataAberto(true)}>
              {formatarDataBR(data)}
            </ButtonField>
          </Campo>

          <Campo label="Valor">
            <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 rounded-xl overflow-hidden">
              <span className="px-3 text-gray-400">R$</span>

              <input
                type="text"
                inputMode="numeric"
                value={valor}
                placeholder=""
                onChange={(e) => setValor(formatarMoedaDigitada(e.target.value))}
                className="w-full bg-transparent p-3 outline-none"
              />
            </div>
          </Campo>

          <Campo label="Conta de origem">
            <ButtonField onClick={() => setModalOrigemAberto(true)}>
              <span className="truncate">
                {contaOrigem?.nome || "Selecionar conta de origem"}
              </span>

              {contaOrigemId && (
                <button
                  type="button"
                  onClick={(e) => {
  e.stopPropagation();
  setContaOrigemId("");
  setContaDestinoId("");
}}
                  className="ml-3 w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center shrink-0"
                  aria-label="Limpar conta de origem"
                >
                  ×
                </button>
              )}
            </ButtonField>
          </Campo>

          <Campo label="Conta de destino">
            <ButtonField onClick={() => setModalDestinoAberto(true)}>
              <span className="truncate">
                {contaDestino?.nome || "Selecionar conta de destino"}
              </span>

              {contaDestinoId && (
                <button
                  type="button"
                  onClick={(e) => {
  e.stopPropagation();
  setContaOrigemId("");
  setContaDestinoId("");
}}
                  className="ml-3 w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center shrink-0"
                  aria-label="Limpar conta de destino"
                >
                  ×
                </button>
              )}
            </ButtonField>
          </Campo>
        </div>

        <Campo label="Descrição (opcional)">
          <input
            type="text"
            value={descricao}
            placeholder="Ex: Pix para conta, Saque em dinheiro..."
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
          />
        </Campo>

        {contaOrigem && contaDestino && valor && (
          <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Resumo</p>

            <p className="text-sm text-gray-300 mt-2">
              Transferir{" "}
              <span className="font-bold text-green-400">
                {formatarMoeda(moedaParaNumero(valor))}
              </span>{" "}
              de <span className="font-bold text-white">{contaOrigem.nome}</span>{" "}
              para <span className="font-bold text-white">{contaDestino.nome}</span>.
            </p>
          </div>
        )}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={cancelar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarTransferencia}
            disabled={salvando}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={data}
        onChange={setData}
        onClose={() => setModalDataAberto(false)}
        titulo="Data da transferência"
        descricao="Escolha a data da movimentação."
      />

      <SelecionarContaModal
        aberto={modalOrigemAberto}
        contas={contasOrigemDisponiveis}
        contaId={contaOrigemId}
        onSelecionar={setContaOrigemId}
        onClose={() => setModalOrigemAberto(false)}
        formatarMoeda={formatarMoeda}
      />

      <SelecionarContaModal
        aberto={modalDestinoAberto}
        contas={contasDestinoDisponiveis}
        contaId={contaDestinoId}
        onSelecionar={setContaDestinoId}
        onClose={() => setModalDestinoAberto(false)}
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

function Campo({ label, children }) {
  return (
    <div className="mt-4">
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
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold flex items-center justify-between gap-2"
    >
      {children}
    </button>
  );
}