"use client";

import {
  AtSign,
  BadgeCheck,
  Camera,
  Check,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe2,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

type ProfileRecord = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  default_chain: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  website_url?: string | null;
  auth_provider?: string | null;
  primary_external_wallet_address?: string | null;
  updated_at?: string | null;
};

type WalletRecord = {
  address?: string | null;
  wallet_address?: string | null;
  circle_wallet_id?: string | null;
};

type ExternalWalletRecord = {
  wallet_address?: string | null;
  wallet_type?: string | null;
};

type ProfileEditorProps = {
  userId: string;
  userEmail: string;
  initialProfile: ProfileRecord | null;
  scaWallet: WalletRecord | null;
  gatewaySigner: WalletRecord | null;
  externalWallet: ExternalWalletRecord | null;
  contactsCount: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const chainLabels: Record<string, string> = {
  arcTestnet: "Arc Testnet",
  baseSepolia: "Base Sepolia",
  avalancheFuji: "Avalanche Fuji",
};

function fallbackHandle(email: string, userId: string) {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "paycmd";
  return `${base}${userId.slice(0, 4)}`.slice(0, 32);
}

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : displayName.slice(0, 2);
  return letters.toUpperCase();
}

function shortAddress(address?: string | null) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function storageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error ?? data?.message ?? `Request failed: ${response.status}`);
  }

  return data;
}

export function ProfileEditor({
  userId,
  userEmail,
  initialProfile,
  scaWallet,
  gatewaySigner,
  externalWallet,
  contactsCount,
}: ProfileEditorProps) {
  const scaAddress = scaWallet?.address ?? scaWallet?.wallet_address ?? "";
  const gatewaySignerAddress = gatewaySigner?.address ?? gatewaySigner?.wallet_address ?? "";
  const externalWalletAddress = externalWallet?.wallet_address ?? "";
  const defaultName = initialProfile?.display_name || userEmail || "PayCMD user";
  const [displayName, setDisplayName] = useState(defaultName);
  const [handle, setHandle] = useState(
    initialProfile?.handle?.toLowerCase() || fallbackHandle(userEmail, userId),
  );
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.website_url ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? "");
  const [defaultChain, setDefaultChain] = useState(initialProfile?.default_chain ?? "arcTestnet");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profileCompleteness = useMemo(() => {
    const checks = [displayName, handle, avatarUrl, bio, defaultChain, scaAddress];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [avatarUrl, bio, defaultChain, displayName, handle, scaAddress]);

  const paycmdId = `@${handle || "handle"}`;

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setSaveState("error");
      setMessage("Avatar phải là PNG, JPEG, WEBP hoặc GIF.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveState("error");
      setMessage("Avatar tối đa 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const path = `${userId}/avatar-${Date.now()}.${storageExtension(file)}`;
      const { error } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setSaveState("idle");
      setMessage("Avatar đã tải lên. Bấm Save profile để lưu.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload avatar thất bại. Kiểm tra bucket profile-avatars.",
      );
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaveState("saving");
    setMessage("");

    try {
      const result = await requestJson("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          handle,
          bio,
          websiteUrl,
          avatarUrl,
          defaultChain,
        }),
      });

      const profile = result.profile as ProfileRecord;
      setDisplayName(profile.display_name ?? displayName);
      setHandle(profile.handle ?? handle);
      setBio(profile.bio ?? "");
      setWebsiteUrl(profile.website_url ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setDefaultChain(profile.default_chain ?? "arcTestnet");
      setSaveState("saved");
      setMessage("Profile đã lưu.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Không lưu được profile.");
    }
  }

  async function copyValue(key: string, value?: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1200);
  }

  return (
    <div className="min-h-full overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          <section className="space-y-4">
            <div className="overflow-hidden rounded-md border bg-card shadow-sm">
              <div className="border-b bg-gradient-to-r from-primary/15 via-accent/30 to-transparent p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Identity pass
                  </Badge>
                  <Badge variant="outline">{profileCompleteness}% ready</Badge>
                </div>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border bg-background shadow-sm">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary text-3xl font-semibold text-primary-foreground">
                        {initials(displayName)}
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border bg-card text-foreground shadow-sm transition hover:bg-accent"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload avatar"
                    >
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-muted-foreground">PayCMD ID</div>
                    <div className="mt-1 break-words text-3xl font-semibold tracking-normal md:text-4xl">
                      {displayName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <AtSign className="h-4 w-4 text-primary" />
                        {paycmdId}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        {chainLabels[defaultChain] ?? defaultChain}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-border md:grid-cols-3">
                <Metric label="Circle wallet" value={shortAddress(scaAddress)} />
                <Metric label="Contacts" value={contactsCount.toString()} />
                <Metric label="Default rail" value={chainLabels[defaultChain] ?? defaultChain} />
              </div>
            </div>

            <div className="rounded-md border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Contact preview</div>
                  <div className="text-xs text-muted-foreground">Cách người khác sẽ nhận ra bạn trong PayCMD</div>
                </div>
                <Badge className="gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Pay-ready
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-md border bg-background p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(displayName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{displayName}</div>
                  <div className="truncate text-xs text-muted-foreground">{paycmdId}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{bio || "Stablecoin payments by command."}</div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => copyValue("paycmd-id", paycmdId)}
                  aria-label="Copy PayCMD ID"
                >
                  {copiedKey === "paycmd-id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoPanel
                icon={Wallet}
                label="Circle Gateway address"
                value={shortAddress(scaAddress)}
                detail="Cùng địa chỉ Circle SCA, dùng để nhận/fund/deposit."
                copyValue={scaAddress}
                copied={copiedKey === "circle-gateway"}
                onCopy={() => copyValue("circle-gateway", scaAddress)}
              />
              <InfoPanel
                icon={Fingerprint}
                label="MetaMask wallet"
                value={shortAddress(externalWalletAddress)}
                detail={externalWallet?.wallet_type ? `Primary ${externalWallet.wallet_type}` : "Link MetaMask from chat"}
                copyValue={externalWalletAddress}
                copied={copiedKey === "metamask"}
                onCopy={() => copyValue("metamask", externalWalletAddress)}
              />
              <InfoPanel
                icon={ShieldCheck}
                label="Gateway signer EOA"
                value={shortAddress(gatewaySignerAddress)}
                detail={gatewaySignerAddress ? "Ký burn intent, không dùng để nạp USDC." : "Tự tạo khi cần Gateway transfer."}
                copyValue={gatewaySignerAddress}
                copied={copiedKey === "gateway-signer"}
                onCopy={() => copyValue("gateway-signer", gatewaySignerAddress)}
              />
            </div>
          </section>

          <section className="rounded-md border bg-card shadow-sm">
            <form onSubmit={saveProfile} className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4 border-b pb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Profile controls</div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">Edit profile</h1>
                </div>
                <Badge variant={saveState === "saved" ? "default" : saveState === "error" ? "destructive" : "secondary"}>
                  {saveState === "saving"
                    ? "Saving"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Needs review"
                        : "Draft"}
                </Badge>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={uploadAvatar}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display name" htmlFor="displayName">
                  <Input
                    id="displayName"
                    value={displayName}
                    maxLength={60}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Minh Nguyen"
                  />
                </Field>
                <Field label="Handle" htmlFor="handle">
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="handle"
                      value={handle}
                      maxLength={32}
                      onChange={(event) => setHandle(event.target.value.toLowerCase())}
                      className="pl-9"
                      placeholder="minh"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Bio" htmlFor="bio">
                <textarea
                  id="bio"
                  value={bio}
                  maxLength={180}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Stablecoin operator, contributor, builder..."
                  className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Website" htmlFor="websiteUrl">
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="websiteUrl"
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      className="pl-9"
                      placeholder="https://paycmd.xyz"
                    />
                  </div>
                </Field>
                <Field label="Default receiving chain" htmlFor="defaultChain">
                  <Select value={defaultChain} onValueChange={setDefaultChain}>
                    <SelectTrigger id="defaultChain" className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arcTestnet">Arc Testnet</SelectItem>
                      <SelectItem value="baseSepolia">Base Sepolia</SelectItem>
                      <SelectItem value="avalancheFuji">Avalanche Fuji</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Avatar URL" htmlFor="avatarUrl">
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="Upload ảnh hoặc paste URL"
                />
              </Field>

              <div className="rounded-md border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium">{userEmail || "Signed in"}</span>
                  {websiteUrl ? (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Website
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>

              {message ? (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    saveState === "error"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {message}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Handle này sẽ là nền tảng cho contact discovery ở các bước sau.
                </div>
                <Button type="submit" disabled={saveState === "saving" || uploadingAvatar}>
                  {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save profile
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  label,
  value,
  detail,
  copyValue,
  copied,
  onCopy,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  copyValue?: string | null;
  copied?: boolean;
  onCopy?: () => void;
}) {
  const canCopy = Boolean(copyValue);

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-sm font-semibold">{value}</div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!canCopy}
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className="h-9 w-9 shrink-0"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-3 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
