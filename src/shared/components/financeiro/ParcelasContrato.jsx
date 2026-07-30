import { useState } from "react";
import { FiAlertTriangle, FiChevronDown, FiChevronRight, FiChevronUp } from "react-icons/fi";
import { formatarDataBR } from "../../utils/data";
import { formatarMoeda } from "../../utils/moeda";
import {
  parcelaEstaAtrasada,
  parcelaEstaPaga,
} from "../../utils/parcelasContratos";

const ROTULOS_STATUS = {
  aberta: "Aberta",
  aberto: "Aberta",
  pendente: "Pendente",
  parcial: "Parcial",
  paga: "Paga",
  pago: "Paga",
  cancelada: "Cancelada",
  cancelado: "Cancelada",
};

function classeStatus(status, atrasada) {
  const valor = String(status || "").toLowerCase();
  if (atrasada) return "bg-red-500/10 text-red-400";
  if (["paga", "pago"].includes(valor)) return "bg-green-500/10 text-green-400";
  if (valor === "parcial") return "bg-yellow-500/10 text-yellow-400";
  if (["cancelada", "cancelado"].includes(valor)) return "bg-gray-700 text-gray-300";
  return "bg-blue-500/10 text-blue-400";
}

export default function ParcelasContrato({ parcelas = [], onSelecionar }) {
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const abertas = parcelas.filter((parcela) => !parcelaEstaPaga(parcela));
  const pagas = parcelas.filter(parcelaEstaPaga);

  return (
    <section className="mt-8">
      <h2 className="text-sm font-black uppercase tracking-wide text-gray-400">
        Parcelas em aberto
      </h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {abertas.map((parcela) => (
          <CardParcela key={parcela.id} parcela={parcela} onClick={() => onSelecionar(parcela)} />
        ))}
      </div>
      {!abertas.length && (
        <div className="mt-4 rounded-2xl border border-gray-800 bg-[#111827] p-5 text-gray-400">
          Nenhuma parcela em aberto.
        </div>
      )}

      {pagas.length > 0 && (
        <div className="mt-7">
          <button
            type="button"
            onClick={() => setMostrarPagas((valor) => !valor)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-[#111827] px-4 py-3 text-left font-bold text-gray-300 hover:border-green-400/50"
            aria-expanded={mostrarPagas}
          >
            <span>{mostrarPagas ? "Ocultar parcelas pagas" : "Ver parcelas pagas"}</span>
            {mostrarPagas ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          {mostrarPagas && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {pagas.map((parcela) => (
                <CardParcela key={parcela.id} parcela={parcela} onClick={() => onSelecionar(parcela)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CardParcela({ parcela, onClick }) {
  const atrasada = parcelaEstaAtrasada(parcela);
  const status = atrasada
    ? "Em atraso"
    : ROTULOS_STATUS[String(parcela.status || "").toLowerCase()] || parcela.status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-gray-800 bg-[#111827] p-5 text-left transition hover:border-green-400/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">Parcela {String(parcela.numero).padStart(2, "0")}</p>
          <p className="mt-1 text-sm text-gray-400">
            Vencimento {formatarDataBR(parcela.dataVencimento)}
          </p>
        </div>
        <FiChevronRight className="mt-1 shrink-0 text-gray-500" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Valor atual</p>
          <p className="mt-1 text-xl font-black">{formatarMoeda(parcela.valorAtualizado)}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${classeStatus(parcela.status, atrasada)}`}>
          {atrasada && <FiAlertTriangle />}
          {status}
        </span>
      </div>
    </button>
  );
}
