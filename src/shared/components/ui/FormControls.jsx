export function Campo({ label, children, erro, shakeKey }) {
  return (
    <div>
      <label className="text-sm text-gray-300">{label}</label>
      {children}
      {erro ? <p key={shakeKey} className="animate-shake text-xs text-red-400 font-semibold mt-2">{erro}</p> : null}
    </div>
  );
}

export function ButtonField({ children, onClick, erro, shakeKey }) {
  return (
    <button
      key={erro ? shakeKey : "ok"}
      type="button"
      onClick={onClick}
      className={`w-full mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} hover:border-green-400 rounded-xl p-3 text-left font-semibold`}
    >
      {children}
    </button>
  );
}
