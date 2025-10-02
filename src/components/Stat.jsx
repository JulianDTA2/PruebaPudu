export default function Stat({label, value, hint}){
    return (
        <div className="neu-lg rounded-3xl p-6">
            <div className="text-slate-500 text-sm">{label}</div>
            <div className="text-3xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-slate-500 text-xs mt-2">{hint}</div>}
        </div>
    )
}