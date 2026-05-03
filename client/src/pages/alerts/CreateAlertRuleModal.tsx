import client from "@/api/main";
import { ArrowLeft, ArrowRight } from "@carbon/icons-react";
import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
  Toggle,
} from "@carbon/react";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";

function defaultExpiryLocal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type CreateAlertRuleModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function CreateAlertRuleModal({
  open,
  onClose,
  onSaved,
}: CreateAlertRuleModalProps) {
  const { tr } = useLocalization();
  const [step, setStep] = useState<1 | 2>(1);

  const [walletAddress, setWalletAddress] = useState("");
  const [actionType, setActionType] = useState<"SWAP" | "TRANSFER" | "ALL">(
    "SWAP",
  );
  const [minVolume, setMinVolume] = useState("10");
  const [maxVolume, setMaxVolume] = useState("100");
  const [volumeUnit, setVolumeUnit] = useState<"USD" | "SOL">("USD");
  const [triggerType, setTriggerType] = useState<"ONCE" | "ALWAYS">("ONCE");
  const [expiryLocal, setExpiryLocal] = useState(defaultExpiryLocal);

  const [alertName, setAlertName] = useState("Trading Event 1");
  const [useDefaultDelivery, setUseDefaultDelivery] = useState(true);
  const [discordOverride, setDiscordOverride] = useState("");
  const [emailOverride, setEmailOverride] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setWalletAddress("");
    setActionType("SWAP");
    setMinVolume("10");
    setMaxVolume("100");
    setVolumeUnit("USD");
    setTriggerType("ONCE");
    setExpiryLocal(defaultExpiryLocal());
    setAlertName("Trading Event 1");
    setUseDefaultDelivery(true);
    setDiscordOverride("");
    setEmailOverride("");
    setErrorMsg(null);
    setSubmitting(false);
  }, [open]);

  const messagePreview = useMemo(() => {
    const min = minVolume.trim() || "?";
    const maxTrim = maxVolume.trim();
    const sym = volumeUnit === "USD" ? "$" : " SOL";
    const range =
      maxTrim.length > 0
        ? tr("alertsPage.rulePreviewRangeBoth", { min, max: maxTrim, sym })
        : tr("alertsPage.rulePreviewRangeMin", { min, sym });

    let verb = tr("alertsPage.rulePreviewVerbAny");
    if (actionType === "SWAP") verb = tr("alertsPage.rulePreviewVerbSwap");
    else if (actionType === "TRANSFER")
      verb = tr("alertsPage.rulePreviewVerbTransfer");

    const wa = walletAddress.trim() || tr("alertsPage.rulePreviewWalletPlaceholder");
    return tr("alertsPage.rulePreviewBody", { wallet: wa, verb, range });
  }, [
    actionType,
    maxVolume,
    minVolume,
    tr,
    volumeUnit,
    walletAddress,
  ]);

  const validateStep1 = (): boolean => {
    const trimmed = walletAddress.trim();
    try {
      new PublicKey(trimmed);
    } catch {
      setErrorMsg(tr("alertsPage.ruleErrorWallet"));
      return false;
    }
    const min = Number(minVolume);
    const max = maxVolume.trim() ? Number(maxVolume) : NaN;
    if (!Number.isFinite(min) || min <= 0) {
      setErrorMsg(tr("alertsPage.ruleErrorMinVol"));
      return false;
    }
    if (maxVolume.trim() && (!Number.isFinite(max) || max < min)) {
      setErrorMsg(tr("alertsPage.ruleErrorMaxVol"));
      return false;
    }
    const exp = new Date(expiryLocal);
    if (Number.isNaN(+exp) || exp <= new Date()) {
      setErrorMsg(tr("alertsPage.ruleErrorExpiry"));
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const submit = async () => {
    setErrorMsg(null);
    const trimmedWallet = walletAddress.trim();
    const min = Number(minVolume);
    const maxRaw = maxVolume.trim();
    const max = maxRaw ? Number(maxRaw) : null;

    if (!useDefaultDelivery) {
      const discordOk = discordOverride.includes("discord.com/api/webhooks/");
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOverride.trim());
      if (!discordOk && !emailOk) {
        setErrorMsg(tr("alertsPage.ruleErrorDelivery"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await (client.api.alerts as any).rules.$post({
        json: {
          name: alertName.trim() || null,
          walletAddress: trimmedWallet,
          actionType,
          minVolume: min,
          maxVolume: max,
          volumeUnit,
          triggerType,
          expiryDate: new Date(expiryLocal).toISOString(),
          useDefaultDelivery,
          discordWebhookOverride: useDefaultDelivery
            ? null
            : discordOverride.trim() || null,
          emailOverride: useDefaultDelivery ? null : emailOverride.trim() || null,
        },
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setErrorMsg(body?.error || tr("alertsPage.ruleSaveError"));
        return;
      }

      onSaved();
      onClose();
    } catch {
      setErrorMsg(tr("alertsPage.ruleSaveError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComposedModal open={open} onClose={onClose} size="md">
      <ModalHeader label={tr("alertsPage.ruleModalLabel")} title={tr("alertsPage.ruleModalTitle")} />
      <ModalBody aria-label={tr("alertsPage.ruleModalTitle")} hasScrollingContent>
        <Stack gap={6}>
          <p style={{ color: "var(--cds-text-secondary)", margin: 0 }}>
            {step === 1
              ? tr("alertsPage.ruleStep1Indicator")
              : tr("alertsPage.ruleStep2Indicator")}
          </p>

          {errorMsg ? (
            <InlineNotification
              kind="error"
              title={errorMsg}
              lowContrast
              onClose={() => setErrorMsg(null)}
            />
          ) : null}

          {step === 1 ? (
            <Stack gap={5}>
              <TextInput
                id="rule-wallet"
                labelText={tr("alertsPage.ruleTraderLabel")}
                placeholder={tr("alertsPage.addressPlaceholder")}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />

              <Select
                id="rule-action"
                labelText={tr("alertsPage.ruleActionLabel")}
                value={actionType}
                onChange={(e) =>
                  setActionType(e.target.value as typeof actionType)
                }
              >
                <SelectItem value="SWAP" text={tr("alertsPage.ruleActionSwap")} />
                <SelectItem
                  value="TRANSFER"
                  text={tr("alertsPage.ruleActionTransfer")}
                />
                <SelectItem value="ALL" text={tr("alertsPage.ruleActionAll")} />
              </Select>

              <Stack gap={3} orientation="horizontal">
                <TextInput
                  id="rule-vol-min"
                  type="number"
                  labelText={tr("alertsPage.ruleVolFrom")}
                  value={minVolume}
                  onChange={(e) => setMinVolume(e.target.value)}
                  min={0}
                />
                <TextInput
                  id="rule-vol-max"
                  type="number"
                  labelText={tr("alertsPage.ruleVolTo")}
                  value={maxVolume}
                  onChange={(e) => setMaxVolume(e.target.value)}
                  min={0}
                />
              </Stack>

              <Select
                id="rule-unit"
                labelText={tr("alertsPage.ruleVolUnit")}
                value={volumeUnit}
                onChange={(e) =>
                  setVolumeUnit(e.target.value as typeof volumeUnit)
                }
              >
                <SelectItem value="USD" text={tr("alertsPage.ruleUnitUsd")} />
                <SelectItem value="SOL" text={tr("alertsPage.ruleUnitSol")} />
              </Select>

              <RadioButtonGroup
                legendText={tr("alertsPage.ruleTriggerLegend")}
                name="rule-trigger"
                valueSelected={triggerType}
                onChange={(v) => setTriggerType(v as typeof triggerType)}
              >
                <RadioButton
                  id="tr-once"
                  labelText={tr("alertsPage.ruleTriggerOnce")}
                  value="ONCE"
                />
                <RadioButton
                  id="tr-always"
                  labelText={tr("alertsPage.ruleTriggerAlways")}
                  value="ALWAYS"
                />
              </RadioButtonGroup>

              <TextInput
                id="rule-expiry"
                type="datetime-local"
                labelText={tr("alertsPage.ruleExpiry")}
                value={expiryLocal}
                onChange={(e) => setExpiryLocal(e.target.value)}
              />
            </Stack>
          ) : (
            <Stack gap={5}>
              <Toggle
                id="rule-use-default"
                labelText={tr("alertsPage.ruleUseDefault")}
                toggled={useDefaultDelivery}
                onToggle={(checked) => setUseDefaultDelivery(checked)}
                labelA={tr("alertsPage.ruleToggleOff")}
                labelB={tr("alertsPage.ruleToggleOn")}
              />

              {!useDefaultDelivery ? (
                <Stack gap={4}>
                  <TextInput
                    id="rule-discord-ov"
                    labelText={tr("alertsPage.ruleDiscordOverride")}
                    placeholder={tr("alertsPage.discordPlaceholder")}
                    value={discordOverride}
                    onChange={(e) => setDiscordOverride(e.target.value)}
                  />
                  <TextInput
                    id="rule-email-ov"
                    type="email"
                    labelText={tr("alertsPage.ruleEmailOverride")}
                    value={emailOverride}
                    onChange={(e) => setEmailOverride(e.target.value)}
                  />
                </Stack>
              ) : null}

              <TextInput
                id="rule-name"
                labelText={tr("alertsPage.ruleNameLabel")}
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
              />

              <div>
                <p className="cds--label">{tr("alertsPage.rulePreviewLabel")}</p>
                <TextArea
                  labelText=""
                  hideLabel
                  readOnly
                  value={messagePreview}
                  rows={4}
                  id="rule-preview"
                />
              </div>
            </Stack>
          )}
        </Stack>
      </ModalBody>

      <ModalFooter>
        {step === 2 ? (
          <Button kind="secondary" renderIcon={ArrowLeft} onClick={() => setStep(1)}>
            {tr("alertsPage.ruleBack")}
          </Button>
        ) : (
          <Button kind="secondary" onClick={onClose}>
            {tr("alertsPage.ruleCancel")}
          </Button>
        )}
        {step === 1 ? (
          <Button
            kind="primary"
            renderIcon={ArrowRight}
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
          >
            {tr("alertsPage.ruleNext")}
          </Button>
        ) : (
          <Button kind="primary" disabled={submitting} onClick={() => void submit()}>
            {tr("alertsPage.ruleSave")}
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
