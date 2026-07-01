import client from "@/api/main";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useAuth } from "@/contexts/AuthContext.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { TrashCan } from "@carbon/icons-react";
import {
    Button,
    Column,
    Grid,
    InlineLoading,
    InlineNotification,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TextInput,
    Tile,
    Toggle,
} from "@carbon/react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { CreateAlertRuleModal } from "./CreateAlertRuleModal.tsx";
import styles from "./index.module.scss";

type FollowedWalletRow = {
  id: number;
  address: string;
  label: string | null;
  createdAt: string;
};

type HeliusSyncResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

type PostAlertsResponse = {
  wallet: FollowedWalletRow;
  heliusSync: HeliusSyncResult;
};

type DeleteAlertsResponse = {
  deleted: boolean;
  heliusSync: HeliusSyncResult;
};

type AlertRuleApiRow = {
  id: number;
  name: string | null;
  walletAddress: string;
  actionType: string;
  minVolume: number | string;
  maxVolume: number | string | null;
  triggerType: string;
  volumeUnit: string;
  expiryDate: string;
};

type AlertSettingsApiResponse = {
  discordWebhookUrl: string | null;
  registeredEmail: string | null;
  emailAlertsEnabled: boolean;
  emailAlertsAddress: string | null;
};

function isValidSolanaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) return false;
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export default function AlertsPage() {
  const { tr, fmt, lang } = useLocalization();
  const { user } = useAuth();

  const ui =
    lang === "vi"
      ? {
          eyebrow: "Alert Center",
          title: "Trung tam canh bao",
          subtitle:
            "Giam sat vi, hieu suat token va cac su kien giao dich trong mot bang dieu khien duy nhat, dong thoi giu san cau hinh Discord, email va dong bo webhook.",
          statWallets: "Vi dang theo doi",
          statRules: "Quy tac dang bat",
          statDelivery: "Kenh san sang",
          featureWallets: "Wallet monitoring",
          featureTokens: "Token performance",
          featureTrading: "Trading events",
          discordDesc:
            "Gui canh bao webhook den Discord de theo doi nhanh cac vi va su kien quan trong.",
          emailDesc:
            "Dieu khien phan phoi den email da dang ky hoac hop thu thay the cho demo va van hanh doi ngu.",
          rulesTitle: "Active alert rules",
          rulesDesc:
            "Theo doi cac quy tac dang hoat dong, cua so het han va logic kich hoat ma khong thay doi xu ly phia server.",
          followedTitle: "Followed wallets",
          followedDesc:
            "Quan ly danh sach vi Solana dang theo doi va giu Helius dong bo voi danh sach hien tai.",
          signInTitle: "Dang nhap de su dung Alert Center",
          signInDesc:
            "Ban can dang nhap de quan ly kenh nhan thong bao, tao quy tac canh bao va dong bo danh sach vi theo doi.",
          configured: "Configured",
          notConfigured: "Needs setup",
          enabled: "Enabled",
          disabled: "Disabled",
          ruleCreate: "Create alert rule",
        }
      : {
          eyebrow: "Alert Center",
          title: "Alert Center",
          subtitle:
            "Monitor wallets, token performance, and trading events from one place while keeping Discord, email, and webhook sync settings ready.",
          statWallets: "Followed wallets",
          statRules: "Active rules",
          statDelivery: "Delivery ready",
          featureWallets: "Wallet monitoring",
          featureTokens: "Token performance",
          featureTrading: "Trading events",
          discordDesc:
            "Send webhook alerts to Discord for fast operational monitoring of wallets and high-signal events.",
          emailDesc:
            "Control delivery to your registered email or an override inbox for demos and team workflows.",
          rulesTitle: "Active alert rules",
          rulesDesc:
            "Review live rules, expiration windows, and trigger logic without changing any server-side alert processing.",
          followedTitle: "Followed wallets",
          followedDesc:
            "Track Solana wallets, label them for triage, and keep Helius synced with the current list.",
          signInTitle: "Sign in to use Alert Center",
          signInDesc:
            "You need an account session to manage delivery channels, create alert rules, and sync followed wallets.",
          configured: "Configured",
          notConfigured: "Needs setup",
          enabled: "Enabled",
          disabled: "Disabled",
          ruleCreate: "Create alert rule",
        };

  // ── Settings state (Discord + email) ─────────────────────────
  const [discordUrl, setDiscordUrl] = useState("");
  const [discordLoading, setDiscordLoading] = useState(true);
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordInline, setDiscordInline] = useState<{
    kind: "success" | "error";
    title: string;
  } | null>(null);

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailOverride, setEmailOverride] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailInline, setEmailInline] = useState<{
    kind: "success" | "error" | "warning";
    title: string;
  } | null>(null);

  // ── Wallet list state ────────────────────────────────────────
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<FollowedWalletRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [inlineKind, setInlineKind] = useState<
    "success" | "error" | "warning" | null
  >(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineSubtitle, setInlineSubtitle] = useState("");

  const [rulesRows, setRulesRows] = useState<AlertRuleApiRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);

  const hasDiscordConfigured = discordUrl.trim().length > 0;
  const hasEmailDestination = Boolean(emailOverride.trim() || registeredEmail);
  const deliveryReadyCount =
    Number(hasDiscordConfigured) + Number(hasEmailDestination);

  // ── Settings load/save ───────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setDiscordLoading(true);
    try {
      const res = await (client.api.alerts as any).settings.$get();
      if (res.ok) {
        const data = (await res.json()) as AlertSettingsApiResponse;
        setDiscordUrl(data.discordWebhookUrl || "");
        setRegisteredEmail(data.registeredEmail);
        setEmailEnabled(Boolean(data.emailAlertsEnabled));
        setEmailOverride(data.emailAlertsAddress || "");
      }
    } catch {
      /* ignore */
    } finally {
      setDiscordLoading(false);
    }
  }, []);

  const onSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscordInline(null);
    setDiscordSaving(true);
    try {
      const trimmed = discordUrl.trim();
      const res = await (client.api.alerts as any).settings.$patch({
        json: { discordWebhookUrl: trimmed || null },
      });
      if (res.ok) {
        const data = (await res.json()) as AlertSettingsApiResponse;
        setDiscordUrl(data.discordWebhookUrl || "");
        setRegisteredEmail(data.registeredEmail);
        setEmailEnabled(Boolean(data.emailAlertsEnabled));
        setEmailOverride(data.emailAlertsAddress || "");
        setDiscordInline({
          kind: "success",
          title: tr("alertsPage.discordSaved"),
        });
      } else {
        const body = (await res.json()) as { error?: string };
        setDiscordInline({
          kind: "error",
          title: body?.error || tr("alertsPage.discordSaveError"),
        });
        void loadSettings();
      }
    } catch {
      setDiscordInline({
        kind: "error",
        title: tr("alertsPage.discordSaveError"),
      });
      void loadSettings();
    } finally {
      setDiscordSaving(false);
    }
  };

  const onSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailInline(null);

    const overrideTrimmed = emailOverride.trim();
    const hasDestination = !!(overrideTrimmed || registeredEmail);

    if (emailEnabled && !hasDestination) {
      setEmailInline({
        kind: "warning",
        title: tr("alertsPage.emailNoDestination"),
      });
      return;
    }

    setEmailSaving(true);
    try {
      const res = await (client.api.alerts as any).settings.$patch({
        json: {
          emailAlertsEnabled: emailEnabled,
          emailAlertsAddress: overrideTrimmed || null,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as AlertSettingsApiResponse;
        setDiscordUrl(data.discordWebhookUrl || "");
        setRegisteredEmail(data.registeredEmail);
        setEmailEnabled(Boolean(data.emailAlertsEnabled));
        setEmailOverride(data.emailAlertsAddress || "");
        setEmailInline({ kind: "success", title: tr("alertsPage.emailSaved") });
      } else {
        const body = (await res.json()) as { error?: string };
        setEmailInline({
          kind: "error",
          title: body?.error || tr("alertsPage.emailSaveError"),
        });
        void loadSettings();
      }
    } catch {
      setEmailInline({ kind: "error", title: tr("alertsPage.emailSaveError") });
      void loadSettings();
    } finally {
      setEmailSaving(false);
    }
  };

  // ── Wallet list load ─────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await client.api.alerts.$get();
      if (!res.ok) throw new Error("list_failed");
      const data = (await res.json()) as FollowedWalletRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setListError(tr("alertsPage.errorGeneric"));
    } finally {
      setListLoading(false);
    }
  }, [tr]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const api = client.api.alerts as unknown as {
        rules: { $get: () => Promise<Response> };
      };
      const res = await api.rules.$get();
      if (!res.ok) throw new Error("rules_failed");
      const data = (await res.json()) as AlertRuleApiRow[];
      setRulesRows(Array.isArray(data) ? data : []);
    } catch {
      setRulesRows([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadList();
      void loadSettings();
      void loadRules();
    } else {
      setListLoading(false);
      setDiscordLoading(false);
    }
  }, [user, loadList, loadSettings, loadRules]);

  // ── Wallet inline helpers ────────────────────────────────────
  const showInline = (
    kind: "success" | "error" | "warning",
    title: string,
    subtitle = "",
  ) => {
    setInlineKind(kind);
    setInlineTitle(title);
    setInlineSubtitle(subtitle);
  };

  const dismissInline = () => {
    setInlineKind(null);
    setInlineTitle("");
    setInlineSubtitle("");
  };

  // ── Wallet add ───────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dismissInline();
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      showInline("error", tr("alertsPage.errorInvalidAddress"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await client.api.alerts.$post({
        json: { address: trimmed, label: label.trim() || undefined },
      });
      const body = (await res.json()) as
        | PostAlertsResponse
        | { error?: string };

      if (res.status === 409) {
        showInline("warning", tr("alertsPage.errorDuplicate"));
        return;
      }
      if (!res.ok || !("wallet" in body)) {
        showInline(
          "error",
          "error" in body && typeof body.error === "string"
            ? body.error
            : tr("alertsPage.errorGeneric"),
        );
        return;
      }

      if (body.heliusSync.ok) {
        showInline(
          "success",
          tr("alertsPage.successHelius"),
          tr("alertsPage.successSaved"),
        );
      } else {
        showInline(
          "warning",
          tr("alertsPage.partialHelius"),
          body.heliusSync.error || "",
        );
      }

      setAddress("");
      setLabel("");
      await loadList();
    } catch {
      showInline("error", tr("alertsPage.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Wallet delete ────────────────────────────────────────────
  const onDeleteRule = async (ruleId: number) => {
    dismissInline();
    setDeletingRuleId(ruleId);
    try {
      const res = await (client.api.alerts as any).rules[":ruleId"].$delete({
        param: { ruleId: String(ruleId) },
      });
      if (!res.ok) {
        showInline("error", tr("alertsPage.deleteFailed"));
        return;
      }
      showInline("success", tr("alertsPage.ruleDeleteSuccess"));
      await loadRules();
    } catch {
      showInline("error", tr("alertsPage.deleteFailed"));
    } finally {
      setDeletingRuleId(null);
    }
  };

  const onDelete = async (id: number) => {
    dismissInline();
    setDeletingId(id);
    try {
      const res = await (client.api.alerts as any)[":id"].$delete({
        param: { id: String(id) },
      });
      if (res.status === 404) {
        showInline("warning", tr("alertsPage.deleteNotFound"));
        await loadList();
        return;
      }
      if (!res.ok) {
        showInline("error", tr("alertsPage.deleteFailed"));
        return;
      }
      const body = (await res.json()) as DeleteAlertsResponse;
      if (body.heliusSync.ok) {
        showInline("success", tr("alertsPage.deleteSuccess"));
      } else {
        showInline(
          "warning",
          tr("alertsPage.deletePartial"),
          body.heliusSync.error || "",
        );
      }
      await loadList();
    } catch {
      showInline("error", tr("alertsPage.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <PageWrapper noMarketTickers>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>{ui.eyebrow}</div>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <h1 className={styles.title}>{ui.title}</h1>
              <p className={styles.subtitle}>{ui.subtitle}</p>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {user ? (listLoading ? "..." : String(rows.length)) : "--"}
                </span>
                <span className={styles.metricLabel}>{ui.statWallets}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {user ? (rulesLoading ? "..." : String(rulesRows.length)) : "--"}
                </span>
                <span className={styles.metricLabel}>{ui.statRules}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {user ? `${deliveryReadyCount}/2` : "--"}
                </span>
                <span className={styles.metricLabel}>{ui.statDelivery}</span>
              </div>
            </div>
          </div>

          <div className={styles.heroPills}>
            <span className={styles.heroPill}>{ui.featureWallets}</span>
            <span className={styles.heroPill}>{ui.featureTokens}</span>
            <span className={styles.heroPill}>{ui.featureTrading}</span>
          </div>
        </div>

        {!user ? (
          <section className={`${styles.panelCard} ${styles.signInCard}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <h2 className={styles.sectionTitle}>{ui.signInTitle}</h2>
                <p className={styles.sectionCopy}>{ui.signInDesc}</p>
              </div>
            </div>

            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>
                {tr("alertsPage.signInRequired")}
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className={styles.settingsGrid}>
              <section className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeading}>
                    <h2 className={styles.sectionTitle}>
                      {tr("alertsPage.discordSectionTitle")}
                    </h2>
                    <p className={styles.sectionCopy}>{ui.discordDesc}</p>
                  </div>
                  <span
                    className={styles.statusPill}
                    data-tone={hasDiscordConfigured ? "success" : "muted"}
                  >
                    {hasDiscordConfigured ? ui.configured : ui.notConfigured}
                  </span>
                </div>

                <div className={styles.panelBody}>
                  {discordInline && (
                    <InlineNotification
                      kind={discordInline.kind}
                      title={discordInline.title}
                      onClose={() => setDiscordInline(null)}
                      lowContrast
                      className={styles.notice}
                    />
                  )}

                  {discordLoading ? (
                    <div className={styles.loadingRow}>
                      <InlineLoading description="Loading..." />
                    </div>
                  ) : (
                    <form onSubmit={onSaveDiscord}>
                      <div className={styles.discordRow}>
                        <TextInput
                          id="discord-webhook-url"
                          labelText={tr("alertsPage.discordLabel")}
                          placeholder={tr("alertsPage.discordPlaceholder")}
                          value={discordUrl}
                          onChange={(ev) => setDiscordUrl(ev.target.value)}
                          disabled={discordSaving}
                          autoComplete="off"
                        />
                        <div className={styles.formActions}>
                          {discordSaving ? <InlineLoading /> : null}
                          <Button
                            type="submit"
                            kind="primary"
                            disabled={discordSaving}
                          >
                            {tr("alertsPage.discordSaveButton")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </section>

              <section className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeading}>
                    <h2 className={styles.sectionTitle}>
                      {tr("alertsPage.emailSectionTitle")}
                    </h2>
                    <p className={styles.sectionCopy}>{ui.emailDesc}</p>
                  </div>
                  <span
                    className={styles.statusPill}
                    data-tone={emailEnabled ? "success" : "muted"}
                  >
                    {emailEnabled ? ui.enabled : ui.disabled}
                  </span>
                </div>

                <div className={styles.panelBody}>
                  {emailInline && (
                    <InlineNotification
                      kind={emailInline.kind}
                      title={emailInline.title}
                      onClose={() => setEmailInline(null)}
                      lowContrast
                      className={styles.notice}
                    />
                  )}

                  {discordLoading ? (
                    <div className={styles.loadingRow}>
                      <InlineLoading description="Loading..." />
                    </div>
                  ) : (
                    <form onSubmit={onSaveEmail}>
                      <div className={styles.toggleRow}>
                        <Toggle
                          id="email-alerts-enabled"
                          labelText={tr("alertsPage.emailToggleLabel")}
                          labelA="Off"
                          labelB="On"
                          toggled={emailEnabled}
                          onToggle={(checked: boolean) =>
                            setEmailEnabled(checked)
                          }
                          disabled={emailSaving}
                        />
                      </div>

                      <p className={styles.fieldHint}>
                        {registeredEmail
                          ? tr("alertsPage.emailRegisteredHint", {
                              email: registeredEmail,
                            })
                          : tr("alertsPage.emailNoRegistered")}
                      </p>

                      <div className={styles.discordRow}>
                        <TextInput
                          id="email-override"
                          type="email"
                          labelText={tr("alertsPage.emailOverrideLabel")}
                          placeholder={tr(
                            "alertsPage.emailOverridePlaceholder",
                          )}
                          value={emailOverride}
                          onChange={(ev) => setEmailOverride(ev.target.value)}
                          disabled={emailSaving}
                          autoComplete="off"
                        />
                        <div className={styles.formActions}>
                          {emailSaving ? <InlineLoading /> : null}
                          <Button
                            type="submit"
                            kind="primary"
                            disabled={emailSaving}
                          >
                            {tr("alertsPage.emailSaveButton")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            </div>

            <section className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeading}>
                  <h3 className={styles.sectionTitle}>{ui.rulesTitle}</h3>
                  <p className={styles.sectionCopy}>{ui.rulesDesc}</p>
                </div>

                <div className={styles.panelHeaderActions}>
                  <span className={styles.countPill}>
                    {rulesLoading ? "..." : rulesRows.length}
                  </span>
                  <Button
                    kind="tertiary"
                    onClick={() => setRuleModalOpen(true)}
                  >
                    {ui.ruleCreate}
                  </Button>
                </div>
              </div>

              <div className={styles.panelBody}>
                {rulesLoading ? (
                  <div className={styles.loadingRow}>
                    <InlineLoading description={tr("alertsPage.ruleLoading")} />
                  </div>
                ) : rulesRows.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateTitle}>
                      {tr("alertsPage.ruleTableEmpty")}
                    </p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <Table size="md" useZebraStyles>
                      <TableHead>
                        <TableRow>
                          <TableHeader>
                            {tr("alertsPage.ruleTableName")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.ruleTableWallet")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.ruleTableAction")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.ruleTableVolume")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.ruleTableTrigger")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.ruleTableExpires")}
                          </TableHeader>
                          <TableHeader className={styles.actionsCell}>
                            {tr("alertsPage.tableActions")}
                          </TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rulesRows.map((r) => {
                          const min = Number(r.minVolume);
                          const max =
                            r.maxVolume != null && r.maxVolume !== ""
                              ? Number(r.maxVolume)
                              : null;
                          const volLabel =
                            max != null && Number.isFinite(max)
                              ? `${min} - ${max} ${r.volumeUnit}`
                              : `${min}+ ${r.volumeUnit}`;
                          return (
                            <TableRow key={r.id}>
                              <TableCell>
                                <span className={styles.primaryCell}>
                                  {r.name?.trim() || "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={styles.addressValue}>
                                  {r.walletAddress}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={styles.tableTag}
                                  data-tone="primary"
                                >
                                  {r.actionType}
                                </span>
                              </TableCell>
                              <TableCell>{volLabel}</TableCell>
                              <TableCell>
                                <span
                                  className={styles.tableTag}
                                  data-tone="accent"
                                >
                                  {r.triggerType}
                                </span>
                              </TableCell>
                              <TableCell>
                                {fmt.datetime.datetime(
                                  new Date(r.expiryDate),
                                )}
                              </TableCell>
                              <TableCell className={styles.actionsCell}>
                                {deletingRuleId === r.id ? (
                                  <InlineLoading />
                                ) : (
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    hasIconOnly
                                    iconDescription="Delete rule"
                                    renderIcon={TrashCan}
                                    className={styles.iconAction}
                                    disabled={deletingRuleId !== null}
                                    onClick={() => void onDeleteRule(r.id)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <div className={styles.panelHeading}>
                  <h3 className={styles.sectionTitle}>{ui.followedTitle}</h3>
                  <p className={styles.sectionCopy}>{ui.followedDesc}</p>
                </div>
                <span className={styles.countPill}>
                  {listLoading ? "..." : rows.length}
                </span>
              </div>

              <div className={styles.panelBody}>
                {inlineKind && (
                  <InlineNotification
                    kind={inlineKind}
                    title={inlineTitle}
                    subtitle={inlineSubtitle}
                    onClose={dismissInline}
                    lowContrast
                    className={styles.notice}
                  />
                )}

                <form onSubmit={onSubmit}>
                  <div className={styles.formRow}>
                    <TextInput
                      id="follow-address"
                      labelText={tr("alertsPage.addressLabel")}
                      placeholder={tr("alertsPage.addressPlaceholder")}
                      value={address}
                      onChange={(ev) => setAddress(ev.target.value)}
                      disabled={submitting}
                      autoComplete="off"
                    />
                    <TextInput
                      id="follow-label"
                      labelText={tr("alertsPage.labelOptional")}
                      placeholder={tr("alertsPage.labelPlaceholder")}
                      value={label}
                      onChange={(ev) => setLabel(ev.target.value)}
                      disabled={submitting}
                      autoComplete="off"
                    />
                    <div className={styles.formActions}>
                      {submitting ? (
                        <InlineLoading
                          description={tr("alertsPage.followButton")}
                        />
                      ) : null}
                      <Button
                        type="submit"
                        kind="primary"
                        disabled={submitting}
                      >
                        {tr("alertsPage.followButton")}
                      </Button>
                    </div>
                  </div>
                </form>

                {listError ? (
                  <InlineNotification
                    kind="error"
                    title={listError}
                    lowContrast
                    onClose={() => setListError(null)}
                    className={styles.notice}
                  />
                ) : null}

                {listLoading ? (
                  <div className={styles.loadingRow}>
                    <InlineLoading description={tr("alertsPage.loadingList")} />
                  </div>
                ) : rows.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateTitle}>
                      {tr("alertsPage.emptyList")}
                    </p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <Table size="md" useZebraStyles>
                      <TableHead>
                        <TableRow>
                          <TableHeader>
                            {tr("alertsPage.tableAddress")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.tableLabel")}
                          </TableHeader>
                          <TableHeader>
                            {tr("alertsPage.tableAdded")}
                          </TableHeader>
                          <TableHeader className={styles.actionsCell}>
                            {tr("alertsPage.tableActions")}
                          </TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <span className={styles.addressValue}>
                                {row.address}
                              </span>
                            </TableCell>
                            <TableCell>
                              {row.label ? (
                                <span className={styles.labelPill}>
                                  {row.label}
                                </span>
                              ) : (
                                <span className={styles.mutedValue}>-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {fmt.datetime.datetime(new Date(row.createdAt))}
                            </TableCell>
                            <TableCell className={styles.actionsCell}>
                              {deletingId === row.id ? (
                                <InlineLoading />
                              ) : (
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  hasIconOnly
                                  iconDescription="Delete"
                                  renderIcon={TrashCan}
                                  className={styles.iconAction}
                                  disabled={deletingId !== null}
                                  onClick={() => onDelete(row.id)}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <CreateAlertRuleModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onSaved={() => {
          void loadRules();
          showInline("success", tr("alertsPage.ruleCreateSuccess"));
        }}
      />
    </PageWrapper>
  );

  if (false) {
    return (
      <PageWrapper noMarketTickers>
        <div className={styles.page}>
          <div className={styles.hero}>
            <div className={styles.heroEyebrow}>{ui.eyebrow}</div>
            <div className={styles.heroTop}>
              <div className={styles.heroCopy}>
                <h1 className={styles.title}>{ui.title}</h1>
                <p className={styles.subtitle}>{ui.subtitle}</p>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {user ? (listLoading ? "..." : String(rows.length)) : "--"}
                  </span>
                  <span className={styles.metricLabel}>{ui.statWallets}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {user ? (rulesLoading ? "..." : String(rulesRows.length)) : "--"}
                  </span>
                  <span className={styles.metricLabel}>{ui.statRules}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {user ? `${deliveryReadyCount}/2` : "--"}
                  </span>
                  <span className={styles.metricLabel}>{ui.statDelivery}</span>
                </div>
              </div>
            </div>

            <div className={styles.heroPills}>
              <span className={styles.heroPill}>{ui.featureWallets}</span>
              <span className={styles.heroPill}>{ui.featureTokens}</span>
              <span className={styles.heroPill}>{ui.featureTrading}</span>
            </div>
          </div>

          {!user ? (
          <section className={`${styles.panelCard} ${styles.signInCard}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <h2 className={styles.sectionTitle}>{ui.signInTitle}</h2>
                <p className={styles.sectionCopy}>{ui.signInDesc}</p>
              </div>
            </div>

            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>
                {tr("alertsPage.signInRequired")}
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ── Discord Webhook URL section ─────────────────── */}
            <Grid
              narrow
              fullWidth
              className={styles.card}
              style={{ marginBottom: "1.5rem" }}
            >
              <Column lg={16} md={8} sm={4}>
                <Tile style={{ background: "transparent", padding: "2rem" }}>
                  <h3 className={styles.sectionTitle}>
                    {tr("alertsPage.discordSectionTitle")}
                  </h3>

                  {discordInline && (
                    <InlineNotification
                      kind={discordInline.kind}
                      title={discordInline.title}
                      onClose={() => setDiscordInline(null)}
                      lowContrast
                      style={{ marginBottom: "1rem" }}
                    />
                  )}

                  {discordLoading ? (
                    <InlineLoading description="Loading…" />
                  ) : (
                    <form onSubmit={onSaveDiscord}>
                      <div className={styles.discordRow}>
                        <TextInput
                          id="discord-webhook-url"
                          labelText={tr("alertsPage.discordLabel")}
                          placeholder={tr("alertsPage.discordPlaceholder")}
                          value={discordUrl}
                          onChange={(ev) => setDiscordUrl(ev.target.value)}
                          disabled={discordSaving}
                          autoComplete="off"
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          {discordSaving ? <InlineLoading /> : null}
                          <Button
                            type="submit"
                            kind="primary"
                            disabled={discordSaving}
                          >
                            {tr("alertsPage.discordSaveButton")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </Tile>
              </Column>
            </Grid>

            {/* ── Email notifications section ─────────────────── */}
            <Grid
              narrow
              fullWidth
              className={styles.card}
              style={{ marginBottom: "1.5rem" }}
            >
              <Column lg={16} md={8} sm={4}>
                <Tile style={{ background: "transparent", padding: "2rem" }}>
                  <h3 className={styles.sectionTitle}>
                    {tr("alertsPage.emailSectionTitle")}
                  </h3>

                  {emailInline && (
                    <InlineNotification
                      kind={emailInline.kind}
                      title={emailInline.title}
                      onClose={() => setEmailInline(null)}
                      lowContrast
                      style={{ marginBottom: "1rem" }}
                    />
                  )}

                  {discordLoading ? (
                    <InlineLoading description="Loading…" />
                  ) : (
                    <form onSubmit={onSaveEmail}>
                      <div style={{ marginBottom: "1rem" }}>
                        <Toggle
                          id="email-alerts-enabled"
                          labelText={tr("alertsPage.emailToggleLabel")}
                          labelA="Off"
                          labelB="On"
                          toggled={emailEnabled}
                          onToggle={(checked: boolean) =>
                            setEmailEnabled(checked)
                          }
                          disabled={emailSaving}
                        />
                      </div>

                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--cds-text-secondary)",
                          marginBottom: "1rem",
                        }}
                      >
                        {registeredEmail
                          ? tr("alertsPage.emailRegisteredHint", {
                              email: registeredEmail,
                            })
                          : tr("alertsPage.emailNoRegistered")}
                      </p>

                      <div className={styles.discordRow}>
                        <TextInput
                          id="email-override"
                          type="email"
                          labelText={tr("alertsPage.emailOverrideLabel")}
                          placeholder={tr(
                            "alertsPage.emailOverridePlaceholder",
                          )}
                          value={emailOverride}
                          onChange={(ev) => setEmailOverride(ev.target.value)}
                          disabled={emailSaving}
                          autoComplete="off"
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          {emailSaving ? <InlineLoading /> : null}
                          <Button
                            type="submit"
                            kind="primary"
                            disabled={emailSaving}
                          >
                            {tr("alertsPage.emailSaveButton")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </Tile>
              </Column>
            </Grid>

            {/* ── Advanced alert rules (predicate filters) ───── */}
            <Grid
              narrow
              fullWidth
              className={styles.card}
              style={{ marginBottom: "1.5rem" }}
            >
              <Column lg={16} md={8} sm={4}>
                <Tile style={{ background: "transparent", padding: "2rem" }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <h3 className={styles.sectionTitle}>
                      {tr("alertsPage.ruleTableTitle")}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--cds-text-secondary)",
                        margin: "0 0 1rem",
                        maxWidth: "52rem",
                      }}
                    >
                      {tr("alertsPage.ruleTableSubtitle")}
                    </p>
                    <Button
                      kind="tertiary"
                      onClick={() => setRuleModalOpen(true)}
                    >
                      {tr("alertsPage.ruleCreateOpen")}
                    </Button>
                  </div>

                  {rulesLoading ? (
                    <InlineLoading description={tr("alertsPage.ruleLoading")} />
                  ) : rulesRows.length === 0 ? (
                    <p style={{ color: "var(--cds-text-secondary)" }}>
                      {tr("alertsPage.ruleTableEmpty")}
                    </p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <Table size="lg" useZebraStyles>
                        <TableHead>
                          <TableRow>
                            <TableHeader>
                              {tr("alertsPage.ruleTableName")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.ruleTableWallet")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.ruleTableAction")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.ruleTableVolume")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.ruleTableTrigger")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.ruleTableExpires")}
                            </TableHeader>
                            <TableHeader className={styles.actionsCell}>
                              {tr("alertsPage.tableActions")}
                            </TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rulesRows.map((r) => {
                            const min = Number(r.minVolume);
                            const max =
                              r.maxVolume != null && r.maxVolume !== ""
                                ? Number(r.maxVolume)
                                : null;
                            const volLabel =
                              max != null && Number.isFinite(max)
                                ? `${min}–${max} ${r.volumeUnit}`
                                : `${min}+ ${r.volumeUnit}`;
                            return (
                              <TableRow key={r.id}>
                                <TableCell>{r.name?.trim() || "—"}</TableCell>
                                <TableCell>
                                  <span
                                    style={{
                                      fontFamily: "IBM Plex Mono, monospace",
                                      wordBreak: "break-all",
                                    }}
                                  >
                                    {r.walletAddress}
                                  </span>
                                </TableCell>
                                <TableCell>{r.actionType}</TableCell>
                                <TableCell>{volLabel}</TableCell>
                                <TableCell>{r.triggerType}</TableCell>
                                <TableCell>
                                  {fmt.datetime.datetime(
                                    new Date(r.expiryDate),
                                  )}
                                </TableCell>
                                <TableCell className={styles.actionsCell}>
                                  {deletingRuleId === r.id ? (
                                    <InlineLoading />
                                  ) : (
                                    <Button
                                      kind="ghost"
                                      size="sm"
                                      hasIconOnly
                                      iconDescription="Delete rule"
                                      renderIcon={TrashCan}
                                      disabled={deletingRuleId !== null}
                                      onClick={() => void onDeleteRule(r.id)}
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Tile>
              </Column>
            </Grid>

            {/* ── Followed wallets section ────────────────────── */}
            <Grid narrow fullWidth className={styles.card}>
              <Column lg={16} md={8} sm={4}>
                <Tile style={{ background: "transparent", padding: "2rem" }}>
                  {inlineKind && (
                    <InlineNotification
                      kind={inlineKind}
                      title={inlineTitle}
                      subtitle={inlineSubtitle}
                      onClose={dismissInline}
                      lowContrast
                      style={{ marginBottom: "1.5rem" }}
                    />
                  )}

                  <form onSubmit={onSubmit}>
                    <div className={styles.formRow}>
                      <TextInput
                        id="follow-address"
                        labelText={tr("alertsPage.addressLabel")}
                        placeholder={tr("alertsPage.addressPlaceholder")}
                        value={address}
                        onChange={(ev) => setAddress(ev.target.value)}
                        disabled={submitting}
                        autoComplete="off"
                      />
                      <TextInput
                        id="follow-label"
                        labelText={tr("alertsPage.labelOptional")}
                        placeholder={tr("alertsPage.labelPlaceholder")}
                        value={label}
                        onChange={(ev) => setLabel(ev.target.value)}
                        disabled={submitting}
                        autoComplete="off"
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        {submitting ? (
                          <InlineLoading
                            description={tr("alertsPage.followButton")}
                          />
                        ) : null}
                        <Button
                          type="submit"
                          kind="primary"
                          disabled={submitting}
                        >
                          {tr("alertsPage.followButton")}
                        </Button>
                      </div>
                    </div>
                  </form>

                  {listError ? (
                    <InlineNotification
                      kind="error"
                      title={listError}
                      lowContrast
                      onClose={() => setListError(null)}
                      style={{ marginBottom: "1rem" }}
                    />
                  ) : null}

                  {listLoading ? (
                    <InlineLoading description={tr("alertsPage.loadingList")} />
                  ) : rows.length === 0 ? (
                    <p style={{ color: "var(--cds-text-secondary)" }}>
                      {tr("alertsPage.emptyList")}
                    </p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <Table size="lg" useZebraStyles>
                        <TableHead>
                          <TableRow>
                            <TableHeader>
                              {tr("alertsPage.tableAddress")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.tableLabel")}
                            </TableHeader>
                            <TableHeader>
                              {tr("alertsPage.tableAdded")}
                            </TableHeader>
                            <TableHeader className={styles.actionsCell}>
                              {tr("alertsPage.tableActions")}
                            </TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <span
                                  style={{
                                    fontFamily: "IBM Plex Mono, monospace",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {row.address}
                                </span>
                              </TableCell>
                              <TableCell>{row.label || "—"}</TableCell>
                              <TableCell>
                                {fmt.datetime.datetime(new Date(row.createdAt))}
                              </TableCell>
                              <TableCell className={styles.actionsCell}>
                                {deletingId === row.id ? (
                                  <InlineLoading />
                                ) : (
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    hasIconOnly
                                    iconDescription="Delete"
                                    renderIcon={TrashCan}
                                    disabled={deletingId !== null}
                                    onClick={() => onDelete(row.id)}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Tile>
              </Column>
            </Grid>
          </>
        )}
      </div>

      <CreateAlertRuleModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onSaved={() => {
          void loadRules();
          showInline("success", tr("alertsPage.ruleCreateSuccess"));
        }}
      />
    </PageWrapper>
  );
  }
}
