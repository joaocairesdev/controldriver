import { useEffect, useMemo, useState } from "react";

import ModalBase from "../../../shared/components/modals/ModalBase";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";

import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  somenteNumeros,
} from "../../../shared/utils/moeda";

export default function PlataformaEntradaModal({
  aberto,
  plataforma,
  dadosIniciais,
  lancamentoAnterior = null,
  onClose,
  onSalvar,
}) {
  const [faturamento, setFaturamento] = useState("");
  const [numeroCorridas, setNumeroCorridas] = useState("");
  const [faturamentoTotal, setFaturamentoTotal] = useState("");
  const [numeroCorridasTotal, setNumeroCorridasTotal] = useState("");
  const [houvePedagio, setHouvePedagio] = useState(false);
  const [valorReembolso, setValorReembolso] = useState("");

  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const resumoAnterior = useMemo(() => {
    return {
      faturamento: Number(lancamentoAnterior?.faturamento || 0),
      corridas: Number(lancamentoAnterior?.corridas || 0),
      reembolso: Number(lancamentoAnterior?.reembolso || 0),
    };
  }, [lancamentoAnterior]);

  const temLancamentoAnterior =
    resumoAnterior.faturamento > 0 || resumoAnterior.corridas > 0 || resumoAnterior.reembolso > 0;

  useEffect(() => {
    if (!aberto) return;

    const faturamentoInicial = dadosIniciais?.faturamento || "";
    const corridasIniciais = dadosIniciais?.numero_corridas || "";

    setFaturamento(faturamentoInicial);
    setNumeroCorridas(corridasIniciais);

    if (temLancamentoAnterior) {
      setFaturamentoTotal(
        faturamentoInicial
          ? numeroParaMoedaInput(resumoAnterior.faturamento + moedaParaNumero(faturamentoInicial))
          : ""
      );
      setNumeroCorridasTotal(
        corridasIniciais !== "" ? String(resumoAnterior.corridas + Number(corridasIniciais || 0)) : ""
      );
    } else {
      setFaturamentoTotal("");
      setNumeroCorridasTotal("");
    }

    setHouvePedagio(dadosIniciais?.houve_pedagio || false);
    setValorReembolso(dadosIniciais?.valor_reembolso || "");
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
    setErros({});
  }, [aberto, dadosIniciais, temLancamentoAnterior, resumoAnterior.faturamento, resumoAnterior.corridas]);

  if (!aberto || !plataforma) return null;

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function limparErro(campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function numeroParaMoedaInput(numero) {
    return Number(numero || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function alterarFaturamentoDiferenca(valorDigitado) {
    limparErro("faturamento");
    const valorFormatado = formatarMoedaDigitada(valorDigitado);
    setFaturamento(valorFormatado);

    if (temLancamentoAnterior) {
      if (!valorFormatado) {
        setFaturamentoTotal("");
        return;
      }

      setFaturamentoTotal(
        numeroParaMoedaInput(resumoAnterior.faturamento + moedaParaNumero(valorFormatado))
      );
    }
  }

  function alterarFaturamentoTotal(valorDigitado) {
    limparErro("faturamento");
    const valorFormatado = formatarMoedaDigitada(valorDigitado);
    setFaturamentoTotal(valorFormatado);

    if (!valorFormatado) {
      setFaturamento("");
      return;
    }

    const totalInformado = moedaParaNumero(valorFormatado);
    const diferenca = totalInformado - resumoAnterior.faturamento;

    if (diferenca < 0) {
      setFaturamento("");
      return;
    }

    setFaturamento(numeroParaMoedaInput(diferenca));
  }

  function alterarCorridasDiferenca(valorDigitado) {
    limparErro("numeroCorridas");
    const valorNumerico = somenteNumeros(valorDigitado);
    setNumeroCorridas(valorNumerico);

    if (temLancamentoAnterior) {
      if (valorNumerico === "") {
        setNumeroCorridasTotal("");
        return;
      }

      setNumeroCorridasTotal(String(resumoAnterior.corridas + Number(valorNumerico || 0)));
    }
  }

  function alterarCorridasTotal(valorDigitado) {
    limparErro("numeroCorridas");
    const valorNumerico = somenteNumeros(valorDigitado);
    setNumeroCorridasTotal(valorNumerico);

    if (valorNumerico === "") {
      setNumeroCorridas("");
      return;
    }

    const diferenca = Number(valorNumerico || 0) - resumoAnterior.corridas;

    if (diferenca < 0) {
      setNumeroCorridas("");
      return;
    }

    setNumeroCorridas(String(diferenca));
  }

  function salvar() {
    if (temLancamentoAnterior && faturamentoTotal && moedaParaNumero(faturamentoTotal) < resumoAnterior.faturamento) {
      abrirFeedback(
        "erro",
        "Total menor que o já lançado",
        "O faturamento total informado é menor que o valor já lançado hoje nesta plataforma."
      );
      return;
    }

    if (temLancamentoAnterior && numeroCorridasTotal !== "" && Number(numeroCorridasTotal || 0) < resumoAnterior.corridas) {
      abrirFeedback(
        "erro",
        "Corridas menores que o já lançado",
        "O total de corridas informado é menor que a quantidade já lançada hoje nesta plataforma."
      );
      return;
    }

    const novos = {};
    if (moedaParaNumero(faturamento) <= 0) novos.faturamento = "Informe o faturamento da plataforma.";
    if (numeroCorridas === "") novos.numeroCorridas = "Informe o número de corridas; use 0 para ajuste.";
    if (houvePedagio && moedaParaNumero(valorReembolso) <= 0) novos.valorReembolso = "Informe o reembolso de pedágio.";
    setErros(novos);
    if (Object.keys(novos).length) {
      setShakeKey(Date.now());
      return;
    }

    if (Number(numeroCorridas || 0) < 0) {
      abrirFeedback("erro", "Corridas inválidas", "O número de corridas não pode ser negativo.");
      return;
    }

    onSalvar({
      id: plataforma.id,
      nome: plataforma.nome,
      faturamento,
      numero_corridas: numeroCorridas,
      houve_pedagio: houvePedagio,
      valor_reembolso: houvePedagio ? valorReembolso : "",
      modo_lancamento: temLancamentoAnterior ? "diferenca_calculada" : "normal",
      total_acumulado_informado: temLancamentoAnterior ? faturamentoTotal : "",
      corridas_acumuladas_informadas: temLancamentoAnterior ? numeroCorridasTotal : "",
    });

    onClose?.();
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={plataforma.nome}
        descricao={
          temLancamentoAnterior
            ? "Informe a diferença do turno ou o total acumulado do aplicativo. O sistema calcula automaticamente."
            : "Informe os ganhos e corridas desta plataforma."
        }
        onClose={onClose}
        largura={temLancamentoAnterior ? "max-w-3xl" : "max-w-lg"}
        z="z-[120]"
      >
        {temLancamentoAnterior ? (
          <div className="space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
              <p className="text-sm font-bold text-blue-300">Já lançado hoje nesta plataforma</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <ResumoItem titulo="Faturamento" valor={formatarMoeda(resumoAnterior.faturamento)} />
                <ResumoItem titulo="Corridas" valor={`${resumoAnterior.corridas} corrida(s)`} />
                <ResumoItem titulo="Reembolso" valor={formatarMoeda(resumoAnterior.reembolso)} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                <h3 className="font-bold text-green-400">Diferença deste turno</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Use quando você já sabe quanto fez somente neste turno.
                </p>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Campo label="Faturamento deste turno" erro={erros.faturamento} shakeKey={shakeKey}>
                    <CampoMoeda
                      erro={erros.faturamento}
                      shakeKey={shakeKey}
                      value={faturamento}
                      onChange={alterarFaturamentoDiferenca}
                    />
                  </Campo>

                  <Campo label="Corridas deste turno" erro={erros.numeroCorridas} shakeKey={shakeKey}>
                    <CampoCorridas
                      erro={erros.numeroCorridas}
                      shakeKey={shakeKey}
                      value={numeroCorridas}
                      onChange={alterarCorridasDiferenca}
                    />
                  </Campo>
                </div>
              </div>

              <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
                <h3 className="font-bold text-white">Total acumulado no aplicativo</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Use quando Uber/99 mostra o total do dia inteiro.
                </p>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Campo label="Faturamento total do dia">
                    <CampoMoeda
                      value={faturamentoTotal}
                      onChange={alterarFaturamentoTotal}
                    />
                  </Campo>

                  <Campo label="Corridas totais do dia">
                    <CampoCorridas
                      value={numeroCorridasTotal}
                      onChange={alterarCorridasTotal}
                    />
                  </Campo>
                </div>
              </div>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-xs text-gray-400">Será salvo neste lançamento</p>
              <p className="text-xl font-black text-green-400 mt-1">
                {formatarMoeda(moedaParaNumero(faturamento))} • {numeroCorridas || 0} corrida(s)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                O app sempre salva apenas a diferença do turno para não duplicar os ganhos.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Faturamento" erro={erros.faturamento} shakeKey={shakeKey}>
              <CampoMoeda
                erro={erros.faturamento}
                shakeKey={shakeKey}
                value={faturamento}
                onChange={(valor) => { limparErro("faturamento"); setFaturamento(formatarMoedaDigitada(valor)); }}
              />
            </Campo>

            <Campo label="Número de Corridas" erro={erros.numeroCorridas} shakeKey={shakeKey}>
              <CampoCorridas
                erro={erros.numeroCorridas}
                shakeKey={shakeKey}
                value={numeroCorridas}
                onChange={(valor) => { limparErro("numeroCorridas"); setNumeroCorridas(somenteNumeros(valor)); }}
              />
            </Campo>
          </div>
        )}

        <div className="mt-5">
          <label className="text-sm text-gray-300">Houve reembolso de pedágio?</label>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <Toggle ativo={houvePedagio} onClick={() => setHouvePedagio(true)}>
              Sim
            </Toggle>

            <Toggle
              ativo={!houvePedagio}
              onClick={() => {
                setHouvePedagio(false);
                setValorReembolso("");
              }}
            >
              Não
            </Toggle>
          </div>
        </div>

        {houvePedagio && (
          <Campo label="Valor do reembolso de pedágio" erro={erros.valorReembolso} shakeKey={shakeKey}>
            <CampoMoeda
              erro={erros.valorReembolso}
              shakeKey={shakeKey}
              value={valorReembolso}
              onChange={(valor) => { limparErro("valorReembolso"); setValorReembolso(formatarMoedaDigitada(valor)); }}
            />
          </Campo>
        )}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
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
            Salvar
          </button>
        </div>
      </ModalBase>

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

function Campo({ label, children, erro, shakeKey }) {
  return (
    <div key={erro ? shakeKey : "ok"} className={`mt-4 first:mt-0 ${erro ? "animate-shake" : ""}`}>
      <label className={erro ? "text-sm text-red-400" : "text-sm text-gray-300"}>{label}</label>
      {children}
      {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
    </div>
  );
}

function CampoMoeda({ value, onChange, erro }) {
  return (
    <div className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500" : "border-gray-700 focus-within:border-green-400"} rounded-xl overflow-hidden`}>
      <span className="px-3 text-gray-400">R$</span>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder=""
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />
    </div>
  );
}

function CampoCorridas({ value, onChange, erro }) {
  return (
    <div className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500" : "border-gray-700 focus-within:border-green-400"} rounded-xl overflow-hidden`}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder=""
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent p-3 outline-none"
      />

      <span className="px-3 text-gray-400">corridas</span>
    </div>
  );
}

function ResumoItem({ titulo, valor }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="font-bold text-white mt-1">{valor}</p>
    </div>
  );
}

function Toggle({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-3 font-bold border ${
        ativo
          ? "border-green-400 bg-green-500/10 text-green-400"
          : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
