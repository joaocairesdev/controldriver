function dataLocal(dataISO) {
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function adicionarMesesSeguro(dataTexto, quantidade) {
  const origem = dataLocal(dataTexto);
  const dia = origem.getDate();
  const destino = new Date(origem.getFullYear(), origem.getMonth() + quantidade, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimoDia));
  return dataISO(destino);
}

export function adicionarFrequencia(dataTexto, frequencia) {
  if (frequencia === "mensal") return adicionarMesesSeguro(dataTexto, 1);
  if (frequencia === "anual") return adicionarMesesSeguro(dataTexto, 12);

  const dias = { diaria: 1, semanal: 7, quinzenal: 15 }[frequencia];
  if (!dias) throw new Error("Periodicidade inválida.");
  const data = dataLocal(dataTexto);
  data.setDate(data.getDate() + dias);
  return dataISO(data);
}
