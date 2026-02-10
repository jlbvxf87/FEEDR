"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { Header } from "@/components/nav/Header";
import { StorageDashboard } from "@/components/StorageDashboard";
import { cn } from "@/lib/utils";
import { formatCost } from "@/lib/costs";
import { Package, Film, Trophy, XCircle } from "lucide-react";

interface UserCredits {
  balance_cents: number;
  lifetime_added_cents: number;
  lifetime_spent_cents: number;
}

interface CreditTransaction {
  id: string;
  created_at: string;
  amount_cents: number;
  balance_after_cents: number;
  transaction_type: "purchase" | "generation" | "refund" | "bonus" | "subscription" | "adjustment";
  description: string | null;
}

interface UserStats {
  totalBatches: number;
  totalClips: number;
  totalWinners: number;
  totalKilled: number;
}

export default function ProfilePage() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalBatches: 0,
    totalClips: 0,
    totalWinners: 0,
    totalKilled: 0,
  });
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        // Load stats
        const { data: batchesData } = await supabase
          .from("batches")
          .select("id", { count: "exact" });
        
        const { data: clipsData } = await supabase
          .from("clips")
          .select("id, winner, killed", { count: "exact" });

        const winners = clipsData?.filter(c => c.winner).length || 0;
        const killed = clipsData?.filter(c => c.killed).length || 0;

        setStats({
          totalBatches: batchesData?.length || 0,
          totalClips: clipsData?.length || 0,
          totalWinners: winners,
          totalKilled: killed,
        });

        // Load credits
        const { data: creditsData } = await supabase
          .from("user_credits")
          .select("balance_cents, lifetime_added_cents, lifetime_spent_cents")
          .single();

        if (creditsData) {
          setCredits(creditsData as UserCredits);
        }

        // Load recent transactions
        const { data: txData } = await supabase
          .from("credit_transactions")
          .select("id, created_at, amount_cents, balance_after_cents, transaction_type, description")
          .order("created_at", { ascending: false })
          .limit(10);

        if (txData) {
          setTransactions(txData as CreditTransaction[]);
        }

      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <Header title="Profile" />
      
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
          </div>
        ) : (
          <>
            {/* User Info */}
            <section className="bg-[#1C2230] rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2EE6C9] to-[#0095FF] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#0B0E11]">
                    {user?.email?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{user?.email}</p>
                  <p className="text-xs text-[#6B7280] mt-1">FEEDR Member</p>
                </div>
              </div>
            </section>

            {/* Credits & Billing */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Credits & Billing
              </h2>
              <div className="bg-[#1C2230] rounded-xl p-6">
                {/* Balance Display */}
                <div className="text-center mb-5">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
                    Current Balance
                  </p>
                  <p className="text-4xl font-bold text-white">
                    {credits ? formatCost(credits.balance_cents) : "--"}
                  </p>
                </div>

                {/* Lifetime Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0B0E11] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#6B7280] mb-1">Lifetime Added</p>
                    <p className="text-lg font-semibold text-[#2EE6C9]">
                      {credits ? formatCost(credits.lifetime_added_cents) : "--"}
                    </p>
                  </div>
                  <div className="bg-[#0B0E11] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#6B7280] mb-1">Lifetime Spent</p>
                    <p className="text-lg font-semibold text-white">
                      {credits ? formatCost(credits.lifetime_spent_cents) : "--"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              {transactions.length > 0 && (
                <div className="bg-[#1C2230] rounded-xl mt-3 divide-y divide-[#2D3748]">
                  <div className="px-4 py-3">
                    <p className="text-xs text-[#6B7280] uppercase tracking-wider">
                      Recent Transactions
                    </p>
                  </div>
                  {transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </section>

            {/* Stats Grid */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Your Stats
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard 
                  label="Batches" 
                  value={stats.totalBatches} 
                  icon={<Package className="w-5 h-5 text-[#9CA3AF]" />}
                />
                <StatCard 
                  label="Clips Generated" 
                  value={stats.totalClips} 
                  icon={<Film className="w-5 h-5 text-[#9CA3AF]" />}
                />
                <StatCard 
                  label="Winners" 
                  value={stats.totalWinners} 
                  icon={<Trophy className="w-5 h-5 text-[#2EE6C9]" />}
                  highlight 
                />
                <StatCard 
                  label="Killed" 
                  value={stats.totalKilled} 
                  icon={<XCircle className="w-5 h-5 text-[#EF4444]" />}
                />
              </div>
            </section>

            {/* Settings */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Settings
              </h2>
              <div className="bg-[#1C2230] rounded-xl divide-y divide-[#2D3748]">
                <SettingsRow 
                  label="Notifications" 
                  description="Get notified when clips are ready"
                  action={
                    <ToggleSwitch defaultChecked={false} onChange={() => {}} />
                  }
                />
                <SettingsRow 
                  label="Default Video Count" 
                  description="Videos per generation"
                  action={
                    <select 
                      className="bg-[#0B0E11] border border-[#2D3748] rounded px-2 py-1 text-sm text-white"
                      defaultValue="3"
                    >
                      <option value="1">1</option>
                      <option value="3">3</option>
                      <option value="5">5</option>
                    </select>
                  }
                />
                <SettingsRow 
                  label="Auto-download Winners" 
                  description="Save winners automatically"
                  action={
                    <ToggleSwitch defaultChecked={false} onChange={() => {}} />
                  }
                />
              </div>
            </section>

            {/* Storage & Cleanup Dashboard */}
            <section>
              <StorageDashboard />
            </section>

            {/* Service Status */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Service Status
              </h2>
              <div className="bg-[#1C2230] rounded-xl p-4 space-y-3">
                <ServiceStatus name="Script Engine" status="active" />
                <ServiceStatus name="Voice Engine" status="active" />
                <ServiceStatus name="Video Engine" status="active" />
                <ServiceStatus name="Assembly" status="active" />
                <ServiceStatus name="Research" status="active" />
              </div>
              <p className="text-xs text-[#6B7280] mt-2 px-1">
                All services are live with real AI providers.
              </p>
            </section>

            {/* Sign Out */}
            <section className="pt-4">
              <button
                onClick={handleSignOut}
                className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium uppercase tracking-wider hover:bg-red-500/20 transition-colors"
              >
                Sign Out
              </button>
            </section>

            {/* Version */}
            <p className="text-center text-[10px] text-[#4B5563] pt-4">
              FEEDR v0.1.0 • Made for creators
            </p>
          </>
        )}
      </main>
    </>
  );
}

// Stat Card Component
function StatCard({ 
  label, 
  value, 
  icon,
  highlight = false 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-[#1C2230] rounded-xl p-4",
      highlight && "ring-1 ring-[#2EE6C9]/30"
    )}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        {highlight && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#2EE6C9]/20 text-[#2EE6C9] uppercase">
            Best
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#6B7280] mt-1">{label}</p>
    </div>
  );
}

// Settings Row Component
function SettingsRow({ 
  label, 
  description, 
  action 
}: { 
  label: string; 
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-[#6B7280] mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({ 
  defaultChecked, 
  onChange 
}: { 
  defaultChecked: boolean; 
  onChange: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  
  const handleChange = () => {
    const newValue = !checked;
    setChecked(newValue);
    onChange(newValue);
  };
  
  return (
    <button
      onClick={handleChange}
      className={cn(
        "w-11 h-6 rounded-full transition-colors",
        checked ? "bg-[#2EE6C9]" : "bg-[#2D3748]"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

// Transaction Row Component
function TransactionRow({ tx }: { tx: CreditTransaction }) {
  const isPositive = tx.amount_cents > 0;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {tx.description || tx.transaction_type}
        </p>
        <p className="text-[10px] text-[#6B7280] mt-0.5">
          {new Date(tx.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <span className={cn("text-sm font-medium", isPositive ? "text-green-400" : "text-white")}>
          {isPositive ? "+" : ""}{formatCost(Math.abs(tx.amount_cents))}
        </span>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded uppercase tracking-wider",
          tx.transaction_type === "bonus" && "bg-green-500/20 text-green-400",
          tx.transaction_type === "generation" && "bg-white/10 text-[#9CA3AF]",
          tx.transaction_type === "refund" && "bg-[#2EE6C9]/20 text-[#2EE6C9]",
          tx.transaction_type === "purchase" && "bg-blue-500/20 text-blue-400",
          tx.transaction_type === "subscription" && "bg-blue-500/20 text-blue-400",
          tx.transaction_type === "adjustment" && "bg-yellow-500/20 text-yellow-400",
        )}>
          {tx.transaction_type}
        </span>
      </div>
    </div>
  );
}

// Service Status Component
function ServiceStatus({ 
  name, 
  status 
}: { 
  name: string; 
  status: "mock" | "active" | "error";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#9CA3AF]">{name}</span>
      <span className={cn(
        "text-[10px] px-2 py-0.5 rounded uppercase tracking-wider",
        status === "mock" && "bg-yellow-500/20 text-yellow-500",
        status === "active" && "bg-[#2EE6C9]/20 text-[#2EE6C9]",
        status === "error" && "bg-red-500/20 text-red-500"
      )}>
        {status}
      </span>
    </div>
  );
}
