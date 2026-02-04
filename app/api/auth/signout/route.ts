import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
