import client from "@/api/main";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useAuth } from "@/contexts/AuthContext.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import {
  Button,
  Column,
  Grid,
  InlineLoading,
  InlineNotification,
  TextInput,
  Tile,
} from "@carbon/react";
import { useCallback, useEffect, useState } from "react";
import styles from "./index.module.scss";

export default function ProfilePage() {
  const { tr } = useLocalization();
  const { user } = useAuth();
  const [discordUrl, setDiscordUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inlineKind, setInlineKind] = useState<
    "success" | "error" | null
  >(null);
  const [inlineTitle, setInlineTitle] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (client.api.alerts as any).settings.$get();
      if (res.ok) {
        const data = (await res.json()) as {
          discordWebhookUrl: string | null;
        };
        setDiscordUrl(data.discordWebhookUrl || "");
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadSettings();
    else setLoading(false);
  }, [user, loadSettings]);

  const dismissInline = () => {
    setInlineKind(null);
    setInlineTitle("");
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    dismissInline();
    setSaving(true);
    try {
      const trimmed = discordUrl.trim();
      const res = await (client.api.alerts as any).settings.$patch({
        json: {
          discordWebhookUrl: trimmed || null,
        },
      });
      if (res.ok) {
        setInlineKind("success");
        setInlineTitle(tr("profilePage.savedSuccess"));
      } else {
        const body = (await res.json()) as { error?: string };
        setInlineKind("error");
        setInlineTitle(body?.error || tr("profilePage.savedError"));
      }
    } catch {
      setInlineKind("error");
      setInlineTitle(tr("profilePage.savedError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.title}>{tr("profilePage.title")}</h1>
          <p className={styles.subtitle}>{tr("profilePage.subtitle")}</p>
        </div>

        <Grid narrow fullWidth className={styles.card}>
          <Column lg={16} md={8} sm={4}>
            <Tile style={{ background: "transparent", padding: "2rem" }}>
              {!user ? (
                <div className={styles.signInWrap}>
                  <p>{tr("profilePage.signInRequired")}</p>
                </div>
              ) : loading ? (
                <InlineLoading description="Loading settings…" />
              ) : (
                <>
                  {inlineKind && (
                    <InlineNotification
                      kind={inlineKind}
                      title={inlineTitle}
                      onClose={dismissInline}
                      lowContrast
                      style={{ marginBottom: "1.5rem" }}
                    />
                  )}
                  <form onSubmit={onSave}>
                    <div className={styles.formRow}>
                      <TextInput
                        id="discord-webhook-url"
                        labelText={tr("profilePage.discordLabel")}
                        placeholder={tr("profilePage.discordPlaceholder")}
                        value={discordUrl}
                        onChange={(ev) => setDiscordUrl(ev.target.value)}
                        disabled={saving}
                        autoComplete="off"
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        {saving ? <InlineLoading /> : null}
                        <Button
                          type="submit"
                          kind="primary"
                          disabled={saving}
                        >
                          {tr("profilePage.saveButton")}
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </Tile>
          </Column>
        </Grid>
      </div>
    </PageWrapper>
  );
}
