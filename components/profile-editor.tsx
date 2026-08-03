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
  KeyRound,
  Loader2,
  Mail,
  Network,
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

import { getChainMeta } from "@/components/chain-identity";
import { supportedChains } from "@/lib/paycmd/chains";
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
import { localeRequestHeaders, useI18n } from "@/lib/i18n";

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

// Was a 3-entry literal, so a profile defaulting to any of the other 9 supported chains
// displayed the raw key ("optimismSepolia"). getChainMeta covers all 12 and derives its
// labels from web3Chains.
function chainLabel(chain: string) {
  return getChainMeta(chain)?.label ?? chain;
}

function fallbackHandle(email: string, userId: string) {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "paycmd";
  return `${base}${userId.slice(0, 4)}`.slice(0, 32);
}

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : displayName.slice(0, 2);
  return letters.toUpperCase();
}

function shortAddress(address?: string | null, fallback = "") {
  if (!address) return fallback;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function compactHandle(value: string) {
  if (value.length <= 24) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
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
      ...localeRequestHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(new Error(data?.message ?? data?.error ?? `Request failed: ${response.status}`), {
      code: data?.error,
      data,
    });
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
  const { t } = useI18n();
  const scaAddress = scaWallet?.address ?? scaWallet?.wallet_address ?? "";
  const gatewaySignerAddress = gatewaySigner?.address ?? gatewaySigner?.wallet_address ?? "";
  const externalWalletAddress = externalWallet?.wallet_address ?? "";
  const notConnected = t("profile.notConnected");
  const defaultName = initialProfile?.display_name || userEmail || t("profile.defaultName");
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
  const displayPaycmdId = `@${compactHandle(handle || "handle")}`;
  const readinessLabel =
    profileCompleteness >= 85
      ? t("profile.readiness.payReady")
      : profileCompleteness >= 55
        ? t("profile.readiness.almost")
        : t("profile.readiness.needsSetup");

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setSaveState("error");
      setMessage(t("profile.avatarTypeError"));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSaveState("error");
      setMessage(t("profile.avatarSizeError"));
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
      setMessage(t("profile.avatarUploaded"));
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : t("profile.avatarUploadFailed"),
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
      setMessage(t("profile.saved"));
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : t("profile.saveFailed"));
    }
  }

  async function copyValue(key: string, value?: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1200);
  }

  return (
    <div className="payna-shell-bg h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:pb-8 md:pt-14">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {t("profile.console")}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal md:text-3xl">{t("profile.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("profile.description")}
            </p>
          </div>
          <div className="rounded-2xl border bg-card/75 px-4 py-3 shadow-sm backdrop-blur-xl md:px-3 md:py-2.5">
            <div className="text-xs text-muted-foreground">{t("profile.readiness")}</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-xl font-semibold">{profileCompleteness}%</div>
              <Badge variant={profileCompleteness >= 85 ? "default" : "outline"}>{readinessLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.95fr)]">
          <section className="space-y-4">
            <div className="overflow-hidden rounded-2xl border bg-card/82 shadow-sm backdrop-blur-xl">
              <div className="relative border-b bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.24),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.16),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.3),transparent_55%)] p-4">
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {t("profile.paymentIdentity")}
                  </Badge>
                  <Badge variant={profileCompleteness >= 85 ? "default" : "outline"}>
                    {readinessLabel}
                  </Badge>
                </div>
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-[0_20px_80px_rgba(16,185,129,0.12)]">
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
                      className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-2xl border bg-card/95 text-foreground shadow-sm transition hover:bg-accent"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t("profile.uploadAvatar")}
                    >
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-muted-foreground">{t("profile.primaryIdentity")}</div>
                    <div className="mt-1 truncate text-3xl font-semibold tracking-normal md:text-4xl" title={displayName}>
                      {displayName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background/60 px-2.5 py-1" title={paycmdId}>
                        <AtSign className="h-4 w-4 text-primary" />
                        <span className="truncate">{displayPaycmdId}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background/60 px-2.5 py-1">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        {chainLabel(defaultChain)}
                      </span>
                    </div>
                    <div className="mt-4 max-w-md">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t("profile.profileReadiness")}</span>
                        <span>{profileCompleteness}%</span>
                      </div>
                      <div className="mt-2 h-2.5 rounded-full bg-background/80">
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all"
                          style={{ width: `${profileCompleteness}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-border md:grid-cols-3">
                <Metric label={t("profile.circleWallet")} value={shortAddress(scaAddress, notConnected)} />
                <Metric label={t("profile.contacts")} value={contactsCount.toString()} />
                <Metric label={t("profile.defaultRail")} value={chainLabel(defaultChain)} />
              </div>
            </div>

            <div className="rounded-2xl border bg-card/82 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{t("profile.contactCard")}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.contactPreviewHelp")}</div>
                </div>
                <Badge className="gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("profile.payReady")}
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-background/70 p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(displayName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{displayName}</div>
                  <div className="truncate text-xs text-muted-foreground" title={paycmdId}>{displayPaycmdId}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{bio || t("profile.defaultBio")}</div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => copyValue("paycmd-id", paycmdId)}
                  aria-label={t("profile.copyPaynaId")}
                >
                  {copiedKey === "paycmd-id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/82 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{t("profile.walletRails")}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.walletRailsHelp")}</div>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Network className="h-3.5 w-3.5" />
                  {t("profile.testnet")}
                </Badge>
              </div>
              <div className="grid gap-3">
              <InfoPanel
                icon={Wallet}
                label={t("profile.circleGatewayAddress")}
                value={shortAddress(scaAddress, notConnected)}
                detail={t("profile.circleGatewayDetail")}
                copyValue={scaAddress}
                copied={copiedKey === "circle-gateway"}
                onCopy={() => copyValue("circle-gateway", scaAddress)}
              />
              <InfoPanel
                icon={Fingerprint}
                label={t("profile.metamaskWallet")}
                value={shortAddress(externalWalletAddress, notConnected)}
                detail={externalWallet?.wallet_type ? t("profile.primaryWallet", { wallet: externalWallet.wallet_type }) : t("profile.linkMetamask")}
                copyValue={externalWalletAddress}
                copied={copiedKey === "metamask"}
                onCopy={() => copyValue("metamask", externalWalletAddress)}
              />
              <InfoPanel
                icon={KeyRound}
                label={t("profile.paynaAccessId")}
                value={shortAddress(userId, "")}
                detail={t("profile.paynaAccessIdHelp")}
                copyValue={userId}
                copied={copiedKey === "payna-access-id"}
                onCopy={() => copyValue("payna-access-id", userId)}
              />
              <InfoPanel
                icon={ShieldCheck}
                label={t("profile.gatewaySignerEoa")}
                value={shortAddress(gatewaySignerAddress, notConnected)}
                detail={gatewaySignerAddress ? t("profile.gatewaySignerDetail") : t("profile.gatewaySignerPending")}
                copyValue={gatewaySignerAddress}
                copied={copiedKey === "gateway-signer"}
                onCopy={() => copyValue("gateway-signer", gatewaySignerAddress)}
              />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card/82 shadow-sm backdrop-blur-xl">
            <form onSubmit={saveProfile} className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4 border-b pb-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="h-4 w-4 text-primary" />
                    {t("profile.commandProfile")}
                  </div>
                  <h1 className="mt-1 text-xl font-semibold tracking-normal">{t("profile.editProfile")}</h1>
                </div>
                <Badge variant={saveState === "saved" ? "default" : saveState === "error" ? "destructive" : "secondary"}>
                  {saveState === "saving"
                    ? t("profile.saveState.saving")
                    : saveState === "saved"
                      ? t("profile.saveState.saved")
                      : saveState === "error"
                        ? t("profile.saveState.error")
                        : t("profile.saveState.draft")}
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
                <Field label={t("profile.displayNameLabel")} htmlFor="displayName">
                  <Input
                    id="displayName"
                    value={displayName}
                    maxLength={60}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="h-11 rounded-2xl"
                    placeholder={t("profile.placeholderName")}
                  />
                </Field>
                <Field label={t("profile.handleLabel")} htmlFor="handle">
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="handle"
                      value={handle}
                      maxLength={32}
                      onChange={(event) => setHandle(event.target.value.toLowerCase())}
                      className="h-11 rounded-2xl pl-9"
                      placeholder="minh"
                    />
                  </div>
                </Field>
              </div>

              <Field label={t("profile.bioLabel")} htmlFor="bio">
                <textarea
                  id="bio"
                  value={bio}
                  maxLength={180}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("profile.placeholderBio")}
                  className="min-h-24 w-full resize-none rounded-2xl border bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("profile.websiteLabel")} htmlFor="websiteUrl">
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="websiteUrl"
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      className="h-11 rounded-2xl pl-9"
                      placeholder="https://paycmd.xyz"
                    />
                  </div>
                </Field>
                <Field label={t("profile.defaultReceivingChain")} htmlFor="defaultChain">
                  <Select value={defaultChain} onValueChange={setDefaultChain}>
                    <SelectTrigger id="defaultChain" className="h-11 w-full rounded-2xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Was 3 hardcoded items, so the other 9 supported chains were unreachable
                          from the UI even though the API accepted them. */}
                      {supportedChains.map((chain) => {
                        const meta = getChainMeta(chain);
                        const Icon = meta?.Icon;
                        return (
                          <SelectItem key={chain} value={chain}>
                            <span className="flex items-center gap-2">
                              {Icon ? <Icon className="size-4 shrink-0" /> : null}
                              {meta?.label ?? chain}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <details className="rounded-2xl border bg-background/55 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-medium text-foreground">{t("profile.advancedFields")}</summary>
                <div className="mt-3">
                  <Field label={t("profile.avatarUrlLabel")} htmlFor="avatarUrl">
                    <Input
                      id="avatarUrl"
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      className="h-11 rounded-2xl"
                      placeholder={t("profile.avatarPlaceholder")}
                    />
                  </Field>
                </div>
              </details>

              <div className="rounded-2xl border bg-background/70 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium">{userEmail || t("common.signedIn")}</span>
                  {websiteUrl ? (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {t("profile.website")}
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
                  {t("profile.handleHelp")}
                </div>
                <Button type="submit" disabled={saveState === "saving" || uploadingAvatar}>
                  {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("profile.saveProfile")}
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
    <div className="bg-card/70 p-4">
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
    <div className="rounded-2xl border bg-background/65 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
      {copyValue ? (
        <div className="mt-3 overflow-hidden rounded-xl border bg-card/70 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <div className="truncate" title={copyValue}>{copyValue}</div>
        </div>
      ) : null}
      <div className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}
