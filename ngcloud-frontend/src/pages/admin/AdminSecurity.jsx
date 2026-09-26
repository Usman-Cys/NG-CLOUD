import { useEffect, useState } from "react";
import { adminApi } from "../../api/adminApi";
import GlassCard from "../../components/common/GlassCard";
import Loader from "../../components/common/Loader";
import { ShieldCheck, Info } from "lucide-react";

export default function AdminSecurity() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await adminApi.getSecurity();
        setChecks(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-white">Security Center</h1>
        <p className="text-slate-400 text-sm mt-1">
          Verification of NGCloud zero-knowledge protections and server-side access-control barriers.
        </p>
      </div>

      <GlassCard className="border-cyan-500/20" hover={false}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-cyan-300 mt-0.5" />
          <p className="text-sm text-slate-300">
            Administrators are prevented from performing file decryptions. Plaintext key recovery and decryption remains mathematically isolated within the client sandbox.
          </p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checks.map((check) => (
          <GlassCard
            key={check.name}
            className="border-white/5 flex flex-col justify-between"
            hover={true}
          >
            <div>
              <div className="flex justify-between items-start">
                <h2 className="font-semibold font-display text-white text-md flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-cyan-400" />
                  {check.name}
                </h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${
                  check.status === "active" || check.status === "client-only" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}>
                  {check.status}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">{check.description}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
