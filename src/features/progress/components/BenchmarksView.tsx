import { useAuth } from "@/features/auth/context/useAuth";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock3, LockKeyhole, Loader2 } from "lucide-react";
import { listBenchmarks } from "@/features/progress/services/progressApi";
import { formatCode } from "@/features/progress/services/progressDisplay";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

function renderPrescription(prescription: Record<string, unknown> | undefined) {
  if (!prescription || !Object.keys(prescription).length) return <span className="muted-copy">No structured prescription supplied.</span>;
  const duration = typeof prescription.duration_seconds === "number" ? prescription.duration_seconds : null;
  const movements = Array.isArray(prescription.movements) ? prescription.movements : null;
  if (duration || movements) {
    return <div className="benchmark-prescription">{duration && <span><Clock3 size={14} />{Math.round(duration / 60)} minutes</span>}{movements?.map((movement, index) => { const item = movement && typeof movement === "object" ? movement as Record<string, unknown> : {}; return <div key={index}><strong>{typeof item.reps === "number" ? `${item.reps} × ` : ""}{formatCode(typeof item.exercise === "string" ? item.exercise : "movement")}</strong></div>; })}</div>;
  }
  return <dl className="benchmark-prescription-raw">{Object.entries(prescription).map(([key, value]) => <div key={key}><dt>{formatCode(key)}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}

export function BenchmarksView() {
  const { session } = useAuth();
  const uid = session?.profile?.user_id;
  const query = useQuery({
    queryKey: [...queryKeys.progress.benchmarks, uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await listBenchmarks();
      if (result.error) throwApiResponseError(result, "Could not load benchmark catalog.");
      return result.data;
    },
  });
  if (query.isLoading) return <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading benchmark catalog</div>;
  if (query.error) return <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{query.error.message}</div>;
  return <div className="benchmarks-view"><p className="progress-context">Benchmark variants are immutable. Results are compared only with the exact same variant and completion standard.</p><div className="benchmark-grid">{query.data?.map((benchmark, index) => <article className="benchmark-card" key={benchmark.id || index}><div className="benchmark-heading"><div><span>{benchmark.owner_user_id ? "Personal" : "System"} · v{benchmark.version || 1}</span><h2>{benchmark.name || formatCode(benchmark.code)}</h2><p>{benchmark.description}</p></div><LockKeyhole size={18} aria-label="Immutable variants" /></div>{benchmark.variants?.map((variant, variantIndex) => <section key={variant.id || variantIndex}><div><strong>{variant.name || formatCode(variant.code)}</strong><span>{formatCode(variant.score_type)} · {formatCode(variant.score_direction)} wins</span></div>{renderPrescription(variant.prescription)}</section>)}</article>)}</div>{!query.data?.length && <p className="empty-copy">No benchmark definitions are available.</p>}</div>;
}
