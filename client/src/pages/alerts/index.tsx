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
  const { tr, fmt } = useLocalization();
  const { user } = useAuth();

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
      const res = await client.api.alerts.index.$get();
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
      const res = await client.api.alerts.index.$post({
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
          <h1 className={styles.title}>{tr("alertsPage.title")}</h1>
          <p className={styles.subtitle}>{tr("alertsPage.subtitle")}</p>
        </div>

        {!user ? (
          <Grid narrow fullWidth className={styles.card}>
            <Column lg={16} md={8} sm={4}>
              <Tile style={{ background: "transparent", padding: "2rem" }}>
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--cds-text-secondary)",
                    padding: "2rem 0",
                  }}
                >
                  {tr("alertsPage.signInRequired")}
                </p>
              </Tile>
            </Column>
          </Grid>
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
