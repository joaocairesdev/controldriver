export default function BarraEtapas({ etapa = 1, total = 1 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }, (_, index) => {
        const ativo = index + 1 <= etapa;
        return <div key={index} className={`h-2 rounded-full ${ativo ? "bg-green-500" : "bg-gray-800"}`} />;
      })}
    </div>
  );
}
