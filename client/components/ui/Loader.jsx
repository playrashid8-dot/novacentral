export default function Loader({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`}>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-400" />
      {label ? <p className="text-sm text-gray-400">{label}</p> : null}
    </div>
  );
}
