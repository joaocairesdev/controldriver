import { useMemo, useState } from "react";
import { FiDollarSign, FiEdit2 } from "react-icons/fi";
import ModalBase from "../modals/ModalBase";
import { Campo } from "../ui/FormControls";
import { formatarDataBR } from "../../utils/data";
import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
} from "../../utils/moeda";
import {
  criarItensParcela,
  obterSaldoParcela,
  parcelaPodeSerEditada,
  parcelaPodeSerPaga,
} from "../../utils/parcelasContratos";

export default function TelaParcelaContrato({
  parcela,
  itensBase,
  nomePadrao,
  onVoltar,
  onSalvarItem,
  onPagar,
}) {
  const [itemEdicao, setItemEdicao] = useState(null);
  const itens = useMemo(
    () => criarItensParcela(parcela, itensBase, nomePadrao),
    [parcela, itensBase, nomePadrao]
  );
  const valorParcela = itens.reduce(
    (total, item) => total + Number(item.valorAtualizado || 0),
    0
  );

  return (
    <div>
      <CabecalhoVoltar
        voltar={onVoltar}
        titulo={`Parcela ${String(parcela.numero).padStart(2, "0")}`}
        descricao={`Vencimento em ${formatarDataBR(parcela.dataVencimento)}`}
      />

      <div className="mt-8 rounded-2xl border border-gray-800 bg-[#111827] p-5">
        <p className="text-sm text-gray-400">Valor da parcela</p>
        <p className="mt-1 text-3xl font-black">{formatarMoeda(valorParcela)}</p>
        <p className="mt-2 text-sm text-gray-500">Calculado automaticamente pela soma dos itens.</p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-black">Composição da parcela</h2>
        <div className="mt-4 space-y-3">
          {itens.map((item) => {
            const diferenca = Math.round((item.valorAtualizado - item.valorPrevisto) * 100) / 100;
            const alterado = diferenca !== 0;
            return (
              <article key={item.id} className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">{item.nome}</h3>
                  {parcelaPodeSerEditada(parcela) && (
                    <button
                      type="button"
                      onClick={() => setItemEdicao(item)}
                      className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-sm font-bold hover:bg-white/5"
                    >
                      <FiEdit2 /> Editar
                    </button>
                  )}
                </div>
                {alterado ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Info label="Valor previsto" valor={formatarMoeda(item.valorPrevisto)} />
                    <Info label="Valor atualizado" valor={formatarMoeda(item.valorAtualizado)} />
                    <Info
                      label="Diferença"
                      valor={`${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)}`}
                      destaque={diferenca > 0 ? "yellow" : "green"}
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Valor</p>
                    <p className="mt-1 text-2xl font-black">{formatarMoeda(item.valorAtualizado)}</p>
                  </div>
                )}
                {alterado && item.observacao && (
                  <div className="mt-4 rounded-xl border border-gray-800 bg-[#0B1120] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Observação</p>
                    <p className="mt-1 text-sm text-gray-300">{item.observacao}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {parcelaPodeSerPaga(parcela) && (
        <button
          type="button"
          onClick={() => onPagar(parcela)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 p-3 font-black text-black hover:bg-green-600 sm:w-auto sm:px-6"
        >
          <FiDollarSign /> Pagar {formatarMoeda(obterSaldoParcela(parcela))}
        </button>
      )}

      {itemEdicao && (
        <EditarItemParcela
          item={itemEdicao}
          onClose={() => setItemEdicao(null)}
          onSalvar={async (ajuste) => {
            await onSalvarItem(parcela, itemEdicao.id, ajuste);
            setItemEdicao(null);
          }}
        />
      )}
    </div>
  );
}

export function CabecalhoVoltar({ voltar, titulo, descricao, acoes }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={voltar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-700 hover:bg-white/5"
          aria-label="Voltar"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{titulo}</h1>
          {descricao && <p className="mt-1 text-gray-400">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex shrink-0 gap-2">{acoes}</div>}
    </div>
  );
}

function EditarItemParcela({ item, onClose, onSalvar }) {
  const [valor, setValor] = useState(numeroParaMoedaInput(item.valorAtualizado));
  const [observacao, setObservacao] = useState(item.observacao || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const valorNumerico = moedaParaNumero(valor);
    if (valorNumerico <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      await onSalvar({ valorAtualizado: valorNumerico, observacao });
    } catch (error) {
      setErro(error.message || "Não foi possível atualizar o item.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase
      aberto
      titulo={item.nome}
      descricao="Edite somente o valor atual desta origem."
      onClose={onClose}
      largura="max-w-lg"
      confirmarAoFecharSeAlterado
      rodape={(
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={salvando} className="rounded-xl border border-gray-700 p-3 font-bold">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-green-500 p-3 font-black text-black">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Campo label="Valor atualizado" erro={erro}>
          <div className={`mt-2 flex overflow-hidden rounded-xl border bg-[#0B1120] ${erro ? "border-red-500 animate-shake" : "border-gray-700"}`}>
            <span className="px-3 py-3 text-gray-400">R$</span>
            <input
              inputMode="numeric"
              value={valor}
              onChange={(event) => {
                setErro("");
                setValor(formatarMoedaDigitada(event.target.value));
              }}
              className="w-full bg-transparent p-3 pl-0 outline-none"
            />
          </div>
        </Campo>
        <Campo label="Observação (opcional)">
          <textarea
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-gray-700 bg-[#0B1120] p-3 outline-none focus:border-green-400"
          />
        </Campo>
      </div>
    </ModalBase>
  );
}

function Info({ label, valor, destaque }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-black ${destaque === "yellow" ? "text-yellow-400" : destaque === "green" ? "text-green-400" : "text-white"}`}>
        {valor}
      </p>
    </div>
  );
}
