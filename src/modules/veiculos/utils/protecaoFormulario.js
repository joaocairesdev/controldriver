export function resolverInicioControleFinanceiroMensal({
  protecaoEmAndamento,
  agenda = [],
  dataInicioControleFinanceiro,
}) {
  if (protecaoEmAndamento === "nao") return agenda[0]?.vencimento || "";
  if (protecaoEmAndamento !== "sim") return "";
  return agenda.some((parcela) => parcela.vencimento === dataInicioControleFinanceiro)
    ? dataInicioControleFinanceiro
    : "";
}

export function atualizarFormaContratacaoProtecao(formulario, formaContratacao) {
  if (formaContratacao === "mensal") return { ...formulario, formaContratacao };
  return {
    ...formulario,
    formaContratacao,
    mensal: {
      ...formulario.mensal,
      protecaoEmAndamento: "",
      dataInicioControleFinanceiro: "",
    },
  };
}
