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

export default function EntradaAvulsaModal({ aberto, onClose, edicao = null, onSalvo = null }) {
  const hoje = hojeBrasil();

  const [contas, setContas] = useState([]);
  const [data, setData] = useState(hoje);
  const [contaId, setContaId] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [finalidade, setFinalidade] = useState("trabalho");

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  useEffect(() => {
    if (aberto) carregarContas();
  }, [aberto]);

  useEffect(() => {
    if (!aberto || !edicao) return;

    setData(edicao.data || hoje);
    setContaId(edicao.conta_id ? String(edicao.conta_id) : "");
    setValor(numeroParaMoedaInput(edicao.valor));
    setDescricao(edicao.descricao || "");
    setFinalidade(edicao.finalidade || "trabalho");
  }, [aberto, edicao]);

  const contaSelecionada = useMemo(
    () => contas.find((conta) => String(conta.id) === String(contaId)),
    [contas, contaId]
  );

  const ehRecargaTag = useMemo(() => {
    const textoDescricao = String(descricao || edicao?.descricao || "").toLowerCase();
    const contaEhTag = (contaSelecionada?.tipo_conta || "") === "tag";

    return (
      contaEhTag ||
      textoDescricao.includes("recarga tag") ||
      textoDescricao.includes("recarga da tag") ||
      textoDescricao.includes("veloe") ||
      textoDescricao.includes("sem parar") ||
      textoDescricao.includes("conectcar")
    );
  }, [descricao, edicao?.descricao, contaSelecionada?.tipo_conta]);

  const contasDestinoDisponiveis = useMemo(
    () => contas.filter((conta) => (conta.tipo_conta || "banco") !== "tag"),
    [contas]
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

    const contasSemTag = contasComSaldo.filter((conta) => (conta.tipo_conta || "banco") !== "tag");
    const contaPrincipal = contasSemTag.find((conta) => conta.principal) || contasSemTag[0];
    if (contaPrincipal && !contaId) setContaId(String(contaPrincipal.id));
  }

  function limparFormulario() {
    setData(hoje);
    setValor("");
    setDescricao("");
    setFinalidade("trabalho");
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
      onSalvo?.();
      onClose?.();
    }
  }

  function cancelar() {
    limparFormulario();
    onClose?.();
  }

  function validar() {
    if (!data) {
      abrirFeedback("erro", "Data obrigatória", "Selecione a data.");
      return false;
    }

    if (!contaId) {
      abrirFeedback("erro", "Conta obrigatória", "Selecione a conta de destino.");
      return false;
    }

    if (moedaParaNumero(valor) <= 0) {
      abrirFeedback("erro", "Valor obrigatório", "Informe um valor maior que zero.");
      return false;
    }

    if (!descricao.trim()) {
      abrirFeedback("erro", "Descrição obrigatória", "Informe a descrição da entrada.");
      return false;
    }

    return true;
  }

  async function salvarEntrada() {
    if (!validar()) return;

    setSalvando(true);

    try {
      const dados = {
        data,
        conta_id: Number(contaId),
        valor: moedaParaNumero(valor),
        descricao: descricao.trim(),
        finalidade: ehRecargaTag ? null : finalidade,
      };

      const { error } = edicao?.id
        ? await supabase.from("entradas_avulsas").update(dados).eq("id", edicao.id)
        : await supabase.from("entradas_avulsas").insert(dados);

      if (error) throw error;

      abrirFeedback(
        "sucesso",
        edicao?.id ? "Entrada atualizada" : "Entrada salva",
        edicao?.id
          ? "A entrada avulsa foi atualizada com sucesso."
          : "A entrada avulsa foi registrada com sucesso.",
        true
      );
    } catch (error) {
      console.error(error);
      abrirFeedback(
        "erro",
        "Erro ao salvar",
        error.message || "Erro ao salvar entrada avulsa."
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
        titulo={edicao?.id ? "Editar Entrada Avulsa" : "Entrada Avulsa"}
        descricao={edicao?.id ? "Altere os dados da entrada selecionada." : "Registre dinheiro recebido fora das plataformas."}
        onClose={cancelar}
        largura="max-w-xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Data">
            <ButtonField onClick={() => setModalDataAberto(true)}>
              {formatarDataBR(data)}
            </ButtonField>
          </Campo>

          <Campo label="Conta destino">
            <ButtonField onClick={() => setModalContaAberto(true)}>
              {contaSelecionada?.nome || "Selecionar conta"}
            </ButtonField>
          </Campo>
        </div>

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

        <Campo label="Descrição">
          <input
            type="text"
            value={descricao}
            placeholder="Ex: Pix da mãe, depósito, reembolso..."
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none"
          />
        </Campo>

        {!ehRecargaTag && (
          <Campo label="Finalidade da entrada">
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setFinalidade("trabalho")}
                className={`rounded-xl border p-3 text-left transition ${
                  finalidade === "trabalho"
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
                }`}
              >
                <span className="block font-black">Trabalho</span>
                <span className="block text-xs opacity-70 mt-1">Operação</span>
              </button>

              <button
                type="button"
                onClick={() => setFinalidade("pessoal")}
                className={`rounded-xl border p-3 text-left transition ${
                  finalidade === "pessoal"
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
                }`}
              >
                <span className="block font-black">Pessoal</span>
                <span className="block text-xs opacity-70 mt-1">Vida pessoal</span>
              </button>
            </div>
          </Campo>
        )}

        {contaSelecionada && valor && descricao && (
          <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Confirmação</p>

            <p className="text-sm text-gray-300 mt-2">
              Registrar{" "}
              <span className="font-bold text-green-400">
                {formatarMoeda(moedaParaNumero(valor))}
              </span>{" "}
              em <span className="font-bold text-white">{contaSelecionada.nome}</span>{" "}
              como <span className="font-bold text-white">{descricao}</span>
              {!ehRecargaTag ? (
                <>
                  {" "}na finalidade <span className="font-bold text-white">{finalidade === "trabalho" ? "Trabalho" : "Pessoal"}</span>
                </>
              ) : null}.
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
            onClick={salvarEntrada}
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
        titulo="Data da entrada"
        descricao="Escolha a data do recebimento."
      />

      <SelecionarContaModal
        aberto={modalContaAberto}
        contas={contasDestinoDisponiveis}
        contaId={contaId}
        onSelecionar={setContaId}
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
      className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
    >
      {children}
    </button>
  );
}