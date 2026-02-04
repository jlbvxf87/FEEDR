"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { Header } from "@/components/nav/Header";
import { cn } from "@/lib/utils";

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

            {/* Stats Grid */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Your Stats
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard 
                  label="Batches" 
                  value={stats.totalBatches} 
                  icon="📦" 
                />
                <StatCard 
                  label="Clips Generated" 
                  value={stats.totalClips} 
                  icon="🎬" 
                />
                <StatCard 
                  label="Winners" 
                  value={stats.totalWinners} 
                  icon="🏆"
                  highlight 
                />
                <StatCard 
                  label="Killed" 
                  value={stats.totalKilled} 
                  icon="❌" 
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
                  label="Default Batch Size" 
                  description="Clips per generation"
                  action={
                    <select className="bg-[#0B0E11] border border-[#2D3748] rounded px-2 py-1 text-sm text-white">
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="15" selected>15</option>
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

            {/* Service Status */}
            <section>
              <h2 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                Service Status
              </h2>
              <div className="bg-[#1C2230] rounded-xl p-4 space-y-3">
                <ServiceStatus name="Script Engine" status="mock" />
                <ServiceStatus name="Voice Engine" status="mock" />
                <ServiceStatus name="Video Engine" status="mock" />
                <ServiceStatus name="Assembly" status="mock" />
              </div>
              <p className="text-xs text-[#6B7280] mt-2 px-1">
                Services are in development mode. Real AI will be enabled soon.
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
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-[#1C2230] rounded-xl p-4",
      highlight && "ring-1 ring-[#2EE6C9]/30"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
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
