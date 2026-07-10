export default function ToggleSwitch({
  ativo = false,
  onChange,
  disabled = false,
  ariaLabel = "Alternar opção",
  className = "",
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(ativo)}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!ativo)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-green-400/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        ativo
          ? "border-green-400 bg-green-500"
          : "border-gray-600 bg-gray-800"
      } ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          ativo ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
