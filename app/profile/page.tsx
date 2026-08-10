import { redirect } from "next/navigation";

import { PayCmdShell } from "@/components/paycmd-shell";
import { ProfileEditor } from "@/components/profile-editor";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/profile");
  }

  const [profileResult, scaWalletResult, externalWalletResult, contactsResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("wallets")
      .select("circle_wallet_id, address, wallet_address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_external_wallets")
      .select("wallet_type, wallet_address")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  return (
    <PayCmdShell>
      <ProfileEditor
        userId={user.id}
        userEmail={user.email ?? ""}
        initialProfile={profileResult.data}
        scaWallet={scaWalletResult.data}
        externalWallet={externalWalletResult.data}
        contactsCount={contactsResult.count ?? 0}
      />
    </PayCmdShell>
  );
}
