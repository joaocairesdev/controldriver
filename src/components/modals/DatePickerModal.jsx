import { useEffect, useState } from "react";
import ModalBase from "./ModalBase";

export default function DatePickerModal({
  aberto,
  valor,
  onChange,
  onClose,
  titulo = "Selecionar data",
  descricao = "Escolha a data do lançamento.",
}) {
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dataInicial = valor ? new Date(`${valor}T00:00:00`) : new Date();

  const [mes, setMes] = useState(dataInicial.getMonth());
  const [ano, setAno] = useState(dataInicial.getFullYear());
  const [modo, setModo] = useState("calendario");
  const [etapa, setEtapa] = useState("ano");

  useEffect(() => {
    if (!aberto) return;
    const data = valor ? new Date(`${valor}T00:00:00`) : new Date();
    setMes(data.getMonth());
    setAno(data.getFullYear());
    setModo("calendario");
    setEtapa("ano");
  }, [aberto, valor]);

  if (!aberto) return null;

  function dataISO(date) {
    return date.toISOString().split("T")[0];
  }

  function alterarMes(delta) {
    let novoMes = mes + delta;
    let novoAno = ano;

    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    }

    if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }

    setMes(novoMes);
    setAno(novoAno);
  }

  function diasDoMesCalendario() {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const totalDias = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();
    const dias = [];

    for (let i = 0; i < diaSemanaInicio; i++) dias.push(null);
    for (let dia = 1; dia <= totalDias; dia++) dias.push(dia);
    while (dias.length < 42) dias.push(null);

    return dias;
  }

  function selecionarDia(dia) {
    const data = new Date(ano, mes, dia);
    onChange(dataISO(data));
    onClose();
  }

  function selecionarHoje() {
    const hoje = new Date();
    onChange(dataISO(hoje));
    onClose();
  }

  function anosDisponiveis() {
    const anoAtual = new Date().getFullYear();
    return Array.from({ length: 13 }, (_, i) => anoAtual - 6 + i);
  }

  return (
    <ModalBase aberto={aberto} titulo={titulo} descricao={descricao} onClose={onClose} largura="max-w-md">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => alterarMes(-1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">‹</button>

        <button
          type="button"
          onClick={() => {
            setModo("mesAno");
            setEtapa("ano");
          }}
          className="flex-1 text-center py-2 rounded-xl hover:bg-white/5 transition"
        >
          <span className="text-2xl font-bold">{meses[mes]}</span>
          <span className="text-2xl font-bold mx-2 text-gray-500">/</span>
          <span className="text-2xl font-bold">{ano}</span>
        </button>

        <button type="button" onClick={() => alterarMes(1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">›</button>
      </div>

      {modo === "calendario" && (
        <>
          <button type="button" onClick={selecionarHoje} className="mt-3 text-sm text-green-400 hover:text-green-300 font-semibold">Hoje</button>

          <div className="grid grid-cols-7 gap-1.5 mt-4 min-h-[292px]">
            {diasSemana.map((dia) => (
              <div key={dia} className="text-center text-[11px] text-gray-500 font-bold h-5">{dia}</div>
            ))}

            {diasDoMesCalendario().map((dia, index) => {
              if (!dia) return <div key={`vazio-${index}`} className="h-10" />;
              const dataDia = dataISO(new Date(ano, mes, dia));
              const ativo = valor === dataDia;

              return (
                <button
                  key={dataDia}
                  type="button"
                  onClick={() => selecionarDia(dia)}
                  className={`h-10 rounded-lg border text-xs font-bold transition ${
                    ativo
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>
        </>
      )}

      {modo === "mesAno" && etapa === "ano" && (
        <div>
          <p className="text-sm text-gray-400 mb-4">Escolha o ano</p>
          <div className="grid grid-cols-3 gap-3">
            {anosDisponiveis().map((itemAno) => (
              <button
                key={itemAno}
                type="button"
                onClick={() => {
                  setAno(itemAno);
                  setEtapa("mes");
                }}
                className={`rounded-xl border p-3 font-semibold ${
                  ano === itemAno
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {itemAno}
              </button>
            ))}
          </div>
        </div>
      )}

      {modo === "mesAno" && etapa === "mes" && (
        <div>
          <button type="button" onClick={() => setEtapa("ano")} className="mb-4 text-sm text-gray-400 hover:text-white">← Voltar para anos</button>
          <div className="grid grid-cols-3 gap-3">
            {meses.map((nomeMes, index) => (
              <button
                key={nomeMes}
                type="button"
                onClick={() => {
                  setMes(index);
                  setModo("calendario");
                }}
                className={`rounded-xl border p-3 font-semibold ${
                  mes === index
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                }`}
              >
                {nomeMes}
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalBase>
  );
}
