"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

interface HeaderProps {
  showBack?: boolean;
  title?: string;
}

export function Header({ showBack = false, title }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B0E11]/95 backdrop-blur-lg border-b border-[#1C2230]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-[#6B7280] hover:text-white transition-colors"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          )}
          {title ? (
            <h1 className="text-sm font-semibold text-white uppercase tracking-wider">
              {title}
            </h1>
          ) : (
            <Image
              src="/logo.png"
              alt="FEEDR"
              width={100}
              height={25}
              className="object-contain"
              priority
            />
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-[10px] text-[#6B7280] hover:text-white transition-colors uppercase tracking-wider px-3 py-1.5"
        >
          Exit
        </button>
      </div>
    </header>
  );
}
