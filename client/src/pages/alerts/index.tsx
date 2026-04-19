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
} from "@carbon/react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
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

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await client.api.alerts.$get();
      if (!res.ok) {
        throw new Error("list_failed");
      }
      const data = (await res.json()) as FollowedWalletRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setListError(tr("alertsPage.errorGeneric"));
    } finally {
      setListLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
        json: {
          address: trimmed,
          label: label.trim() || undefined,
        },
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
        showInline("warning", tr("alertsPage.partialHelius"), body.heliusSync.error || "");
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
        showInline("warning", tr("alertsPage.deletePartial"), body.heliusSync.error || "");
      }
      await loadList();
    } catch {
      showInline("error", tr("alertsPage.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageWrapper>
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.title}>{tr("alertsPage.title")}</h1>
          <p className={styles.subtitle}>{tr("alertsPage.subtitle")}</p>
        </div>

        {!user ? (
          <Grid narrow fullWidth className={styles.card}>
            <Column lg={16} md={8} sm={4}>
              <Tile style={{ background: "transparent", padding: "2rem" }}>
                <p style={{ textAlign: "center", color: "var(--cds-text-secondary)", padding: "2rem 0" }}>
                  {tr("alertsPage.signInRequired")}
                </p>
              </Tile>
            </Column>
          </Grid>
        ) : (
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
                    <Button type="submit" kind="primary" disabled={submitting}>
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
        )}
      </div>
    </PageWrapper>
  );
}
