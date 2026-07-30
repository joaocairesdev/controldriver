export function agruparSaidasDeAbastecimentos(saidas, abastecimentos) {
  const idsPrincipais = new Set(
    (abastecimentos || []).map((item) => Number(item.saida_id)).filter(Boolean)
  );
  const adicionaisPorOrigem = new Map();

  for (const saida of saidas || []) {
    const origemId = Number(saida.saida_origem_id || 0);
    if (!origemId || !idsPrincipais.has(origemId)) continue;
    const atuais = adicionaisPorOrigem.get(origemId) || [];
    atuais.push(saida);
    adicionaisPorOrigem.set(origemId, atuais);
  }

  const idsAdicionais = new Set(
    [...adicionaisPorOrigem.values()].flat().map((saida) => Number(saida.id))
  );

  return (saidas || [])
    .filter((saida) => !idsAdicionais.has(Number(saida.id)))
    .map((saida) => {
      if (!idsPrincipais.has(Number(saida.id))) return saida;
      const pagamentos = [
        saida,
        ...(adicionaisPorOrigem.get(Number(saida.id)) || []).sort(
          (a, b) => Number(a.id || 0) - Number(b.id || 0)
        ),
      ];

      if (pagamentos.length === 1) {
        return { ...saida, pagamentos };
      }

      return {
        ...saida,
        forma_pagamento: "multiplo",
        tipo_movimentacao: pagamentos.every(
          (pagamento) => pagamento.tipo_movimentacao === "conta_pagar"
        )
          ? "conta_pagar"
          : "saida",
        status: "multiplo",
        conta_id: null,
        cartao_id: null,
        contas: null,
        cartoes: null,
        valor_total: pagamentos.reduce(
          (total, pagamento) => total + Number(pagamento.valor_total || 0),
          0
        ),
        pagamentos,
      };
    });
}

export function somarPagamentosDoAbastecimento(saidaPrincipal, saidasAdicionais) {
  return [saidaPrincipal, ...(saidasAdicionais || [])].reduce(
    (total, saida) => total + Number(saida?.valor_total || 0),
    0
  );
}

function resumirLista(valores, limite = 2) {
  const unicos = [...new Set(valores.filter(Boolean))];
  if (unicos.length <= limite) return unicos.join(" | ");
  return `${unicos.slice(0, limite).join(" | ")} | +${unicos.length - limite}`;
}

function abreviarNome(nome, limite = 22) {
  const texto = String(nome || "").trim();
  if (texto.length <= limite) return texto;
  const trecho = texto.slice(0, limite - 1);
  const ultimoEspaco = trecho.lastIndexOf(" ");
  return `${trecho.slice(0, ultimoEspaco > 10 ? ultimoEspaco : limite - 1)}…`;
}

export function resumirFormasPagamento(pagamentos) {
  const rotulos = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    debito: "Débito",
    debito_conta: "Débito",
    credito: "Crédito",
    credito_avista: "Crédito",
    credito_parcelado: "Crédito",
    boleto: "Boleto",
  };

  return resumirLista(
    (pagamentos || []).map(
      (pagamento) => rotulos[pagamento.forma_pagamento] || pagamento.forma_pagamento
    )
  );
}

export function resumirOrigensPagamento(pagamentos) {
  return resumirLista(
    (pagamentos || []).map((pagamento) => {
      if (pagamento.cartoes?.nome) return abreviarNome(pagamento.cartoes.nome);
      if (pagamento.contas?.nome) return abreviarNome(pagamento.contas.nome);
      if (pagamento.forma_pagamento === "dinheiro") return "Carteira";
      if (pagamento.forma_pagamento === "boleto") return "Conta a pagar";
      return "Conta";
    })
  );
}
