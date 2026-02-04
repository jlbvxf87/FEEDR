import { createClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  // Handle code exchange (OAuth or magic link)
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Redirect to confirmed page for signup, otherwise to next
      return NextResponse.redirect(`${origin}/auth/confirmed`);
    }
  }

  // Handle token hash (email confirmation)
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "recovery" | "invite" | "magiclink" | "email_change",
    });

    if (!error) {
      // Redirect to branded confirmation page
      return NextResponse.redirect(`${origin}/auth/confirmed`);
    }
  }

  // If there's an error, redirect to login with error message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
