export function distribuirSaldoMensalRestante(saldo, quantidade) {
  const totalCentavos = Math.max(Math.round(Number(saldo || 0) * 100), 0);
  const totalItens = Math.max(Math.trunc(Number(quantidade || 0)), 0);
  if (!totalItens) return [];

  const base = Math.floor(totalCentavos / totalItens);
  const diferenca = totalCentavos - base * totalItens;

  return Array.from({ length: totalItens }, (_, indice) =>
    (base + (indice === totalItens - 1 ? diferenca : 0)) / 100
  );
}
