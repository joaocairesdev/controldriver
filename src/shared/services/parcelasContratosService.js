import {
  criarAtualizacaoItemParcela,
  parcelaPodeSerEditada,
} from "../utils/parcelasContratos.js";

export async function atualizarCobrancaParcela(
  supabase,
  parcela,
  itemId,
  ajuste,
  itensBase = [],
  nomePadrao = "Contrato financeiro"
) {
  if (!parcela?.cobranca?.id) throw new Error("Conta a pagar vinculada não encontrada.");
  if (!parcelaPodeSerEditada(parcela)) {
    throw new Error("Somente parcelas abertas e sem pagamento podem ser alteradas.");
  }

  const resultado = criarAtualizacaoItemParcela(
    parcela,
    itemId,
    ajuste,
    itensBase,
    nomePadrao
  );
  const { error } = await supabase
    .from("saidas")
    .update(resultado.atualizacao)
    .eq("id", parcela.cobranca.id);

  if (error) throw error;
  return resultado;
}
