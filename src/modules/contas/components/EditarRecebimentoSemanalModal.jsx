import { useState } from "react";

import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import ModalBase from "../../../shared/components/modals/ModalBase";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import { formatarDataBR } from "../../../shared/utils/data";
import { formatarMoeda } from "../../../shared/utils/moeda";
import { editarRecebimentoSemanalPlataforma } from "../services/plataformasFinanceiroService";
import { normalizarDescricaoRecebimentoSemanal } from "../utils/plataformasFinanceiro";

export default function EditarRecebimentoSemanalModal({
  movimentacao,
  plataforma,
  contas,
  onClose,
  onSalvo,
}) {
  const dados = movimentacao.dadosOriginais || {};
  const [data, setData] = useState(dados.data || movimentacao.data || "");
  const [contaDestinoId, setContaDestinoId] = useState(
    dados.conta_destino_id ? String(dados.conta_destino_id) : "",
  );
  const [descricao, setDescricao] = useState(() =>
    normalizarDescricaoRecebimentoSemanal(dados.descricao, plataforma?.nome),
  );
  const [modalData, setModalData] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [erroGeral, setErroGeral] = useState("");
  const contaDestino = contas.find(
    (conta) => String(conta.id) === String(contaDestinoId),
  );

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setErroGeral("");
  }

  async function salvar() {
    const novosErros = {};
    if (!data) novosErros.data = "Selecione a data do recebimento.";
    if (!contaDestinoId) novosErros.contaDestinoId = "Selecione a conta de destino.";
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      setShakeKey((atual) => atual + 1);
      return;
    }

    setSalvando(true);
    setErroGeral("");

    try {
      await editarRecebimentoSemanalPlataforma({
        transferenciaId: dados.id,
        contaDestinoId,
        data,
        descricao,
      });
      await onSalvo?.();
    } catch (error) {
      console.error("Erro ao editar recebimento semanal automático:", error);
      setErroGeral(
        error.message || "Não foi possível editar o recebimento semanal automático.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo="Editar recebimento semanal automático"
        descricao="O valor é definido pelo histórico da carteira e não pode ser alterado."
        onClose={onClose}
        largura="max-w-xl"
        confirmarAoFecharSeAlterado
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Data" erro={erros.data} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.data}
              shakeKey={shakeKey}
              onClick={() => setModalData(true)}
            >
              {data ? formatarDataBR(data) : "Selecionar data"}
            </ButtonField>
          </Campo>

          <Campo label="Conta destino" erro={erros.contaDestinoId} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.contaDestinoId}
              shakeKey={shakeKey}
              onClick={() => setModalConta(true)}
            >
              {contaDestino?.nome || "Selecionar conta bancária"}
            </ButtonField>
          </Campo>

          <Campo label="Descrição">
            <input
              type="text"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-700 bg-[#0B1120] p-3 outline-none focus:border-green-400"
            />
          </Campo>

          <Campo label="Valor">
            <div className="mt-2 rounded-xl border border-gray-800 bg-[#0B1120] p-3 font-black text-gray-300">
              {formatarMoeda(movimentacao.valor)}
            </div>
          </Campo>
        </div>

        {erroGeral ? (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            {erroGeral}
          </p>
        ) : null}

        <div className="sticky bottom-0 z-10 mt-6 grid grid-cols-2 gap-3 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl bg-green-500 p-3 font-black text-black hover:bg-green-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalData}
        valor={data}
        titulo="Data do recebimento"
        descricao="Escolha a data em que o recebimento semanal foi creditado."
        onChange={(novaData) => {
          limparErro("data");
          setData(novaData);
        }}
        onClose={() => setModalData(false)}
      />

      <SelecionarContaModal
        aberto={modalConta}
        contas={contas}
        contaId={contaDestinoId}
        onSelecionar={(contaId) => {
          limparErro("contaDestinoId");
          setContaDestinoId(contaId);
        }}
        onClose={() => setModalConta(false)}
      />
    </>
  );
}
