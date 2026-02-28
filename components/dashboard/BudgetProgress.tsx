export default function BudgetProgress({
  label,
  rate,
}: {
  label: string;
  rate: number;
}) {
  const color = rate < 80 ? "bg-emerald-500" : rate <= 100 ? "bg-amber-500" : "bg-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="tabular-nums">{rate.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(rate, 130)}%` }} />
      </div>
    </div>
  );
}
