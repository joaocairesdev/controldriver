export default function ResumoContrato({
  itens,
  titulo = "Resumo do contrato",
  hierarquico = false,
}) {
  const itemProdutos = hierarquico
    ? itens.find((item) => Array.isArray(item.valor))
    : null;
  const indicadores = hierarquico
    ? itens.filter((item) => !Array.isArray(item.valor))
    : [];
  const produtosVisiveis = itemProdutos?.valor.slice(0, 4) || [];
  const produtosOcultos = Math.max((itemProdutos?.valor.length || 0) - produtosVisiveis.length, 0);

  return (
    <section className="mt-6">
      <h2 className="text-lg font-black">{titulo}</h2>
      {hierarquico ? (
        <div className="mt-3 rounded-3xl border border-gray-800 bg-[#111827] p-4 sm:p-5">
          {itemProdutos && (
            <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-[#0B1120] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                {itemProdutos.titulo}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {produtosVisiveis.map((produto, indice) => (
                  <span
                    key={`${produto}-${indice}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-[#111827] px-3 py-2 text-sm font-bold text-white"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
                    {produto}
                  </span>
                ))}
                {produtosOcultos > 0 && (
                  <span className="inline-flex items-center rounded-xl border border-gray-700 px-3 py-2 text-sm font-bold text-gray-300">
                    +{produtosOcultos} {produtosOcultos === 1 ? "produto" : "produtos"}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {indicadores.map((item) => (
              <div
                key={item.titulo}
                className={`min-w-0 rounded-2xl border p-4 ${
                  item.destaque
                    ? "border-yellow-500/30 bg-yellow-500/10"
                    : "border-gray-800 bg-[#0B1120]"
                }`}
              >
                <p className="text-xs text-gray-400">{item.titulo}</p>
                <p
                  className={`mt-1 break-words font-black ${
                    item.principal ? "text-xl sm:text-2xl" : "text-sm sm:text-base"
                  } ${item.destaque ? "text-yellow-400" : "text-white"}`}
                >
                  {item.valor}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {itens.map((item) => (
            <div key={item.titulo} className="rounded-xl border border-gray-800 bg-[#0B1120] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{item.titulo}</p>
              <p className={`mt-1 break-words text-lg font-black ${item.destaque ? "text-yellow-400" : "text-white"}`}>
                {item.valor}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
