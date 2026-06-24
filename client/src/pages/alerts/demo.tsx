import client from "@/api/main";
import { ModalStateManager } from "@/components/ModelStateManager";
import Tble from "@/components/Tble";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import {
  Button,
  Column,
  ComposedModal,
  Grid,
  ModalBody,
  ModalHeader,
  Section,
  Stack,
} from "@carbon/react";
import { Add } from "@carbon/react/icons";
import { ComponentType, useMemo, useState, type ReactNode } from "react";
import TokenStatsConfig from "./components/TokenStatsConfig";
import { TradingEventsConfig } from "./components/TradingEventsConfig";
import styles from "./demo.module.scss";
import { type AlertType } from "./form-schema";

interface AlertRow {
  id: string;
  type: ReactNode;
  target: ReactNode;
  alertName: ReactNode;
  createdAt: ReactNode;
  actions?: ReactNode;
  [key: string]: ReactNode | undefined;
}

type ConfigComponentProps = {
  onReturn: () => void;
  onFinish: () => void;
  open: boolean;
};

const alertConfigModules: Record<
  AlertType,
  ComponentType<ConfigComponentProps> | null
> = {
  "token-stats": TokenStatsConfig,
  "trading-events": TradingEventsConfig,
  "market-movements": null,
  "technical-indicators": null,
};

interface AlertTypeOption {
  id: AlertType;
  title: string;
  description: string;
  example: string;
}

type AlertTypeTileProps = {
  option: AlertTypeOption;
  onClick: (type: AlertType) => void;
};

function AlertTypeTile({ option, onClick }: AlertTypeTileProps) {
  return (
    <Button
      kind="ghost"
      onClick={() => onClick(option.id)}
      className={styles.alertTypeTile}
    >
      <Stack gap={2}>
        <Txt size="md" block bold>
          {option.title}
        </Txt>
        <Txt size="sm" block>
          {option.description}
        </Txt>
        <Txt secondary size="sm" block>
          {option.example}
        </Txt>
      </Stack>
    </Button>
  );
}

interface AlertTypeSelectionProps {
  open: boolean;
  onClose: () => void;
  alertTypeOptions: AlertTypeOption[];
  onSelectType: (type: AlertType) => void;
}

function AlertTypeSelection({
  open,
  onClose,
  alertTypeOptions,
  onSelectType,
}: AlertTypeSelectionProps) {
  return (
    <ComposedModal open={open} onClose={onClose}>
      <ModalHeader label="Alerts" title="Select trigger type" />
      <ModalBody>
        <Stack>
          <Txt secondary size="sm">
            Please select an alert trigger type
          </Txt>
          <Stack gap={1}>
            {alertTypeOptions.map((option) => (
              <AlertTypeTile
                key={option.id}
                option={option}
                onClick={onSelectType}
              />
            ))}
          </Stack>
        </Stack>
      </ModalBody>
    </ComposedModal>
  );
}

export default function AlertsDemo() {
  const { fmt } = useLocalization();
  const { user } = useAuth();
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<AlertType | null>(
    null,
  );
  const [step, setStep] = useState<"type-selection" | "configuration">(
    "type-selection",
  );

  const tokenAlerts = useGet(
    client.api.alertsHp.tokens,
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const tradingAlerts = useGet(
    client.api.alertsHp["trading-events"],
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const refreshAlerts = async () => {
    await Promise.all([tokenAlerts.mutate(), tradingAlerts.mutate()]);
  };

  const handleDeleteAlert = async (alertId: string, type: "token" | "trading") => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this alert?",
    );
    if (!confirmed) return;

    setDeleteFeedback(null);
    setDeletingAlertId(alertId);

    try {
      const endpoint = type === "token" ? client.api.alertsHp.tokens : client.api.alertsHp["trading-events"];
      const response = await (endpoint as any)[":id"].$delete({
        param: { id: alertId },
      });

      if (!response.ok) {
        setDeleteFeedback({
          kind: "error",
          message: "Failed to delete alert.",
        });
        return;
      }

      setDeleteFeedback({
        kind: "success",
        message: "Alert deleted.",
      });
      await refreshAlerts();
    } catch {
      setDeleteFeedback({
        kind: "error",
        message: "Failed to delete alert.",
      });
    } finally {
      setDeletingAlertId(null);
    }
  };

  const rows: AlertRow[] = useMemo(() => {
    const tokenRows = (tokenAlerts.data ?? []).map((alertDetails) => ({
      id: alertDetails.alertId,
      type: "token",
      target: alertDetails.tokenTarget?.tokenAddress || "-",
      alertName: alertDetails.alert.alertName,
      createdAt: fmt.datetime.datetime(alertDetails.alert.createdAt),
      actions: (
        <Button
          kind="danger--ghost"
          size="sm"
          disabled={deletingAlertId !== null}
          onClick={(event) => {
            event.stopPropagation();
            void handleDeleteAlert(alertDetails.alertId, "token");
          }}
        >
          {deletingAlertId === alertDetails.alertId ? "Deleting..." : "Delete"}
        </Button>
      ),
    }));

    const tradingRows = (tradingAlerts.data ?? []).map((alertDetails) => {
      const target = alertDetails.target.walletAddress
        ? `${alertDetails.target.tokenAddress} (${alertDetails.target.walletAddress})`
        : alertDetails.target.tokenAddress;

      return {
        id: alertDetails.alertId,
        type: `trading: ${alertDetails.condition.eventType}`,
        target,
        alertName: alertDetails.alert.name,
        createdAt: fmt.datetime.datetime(alertDetails.alert.createdAt),
        actions: <Button kind="danger--ghost" size="sm" disabled={deletingAlertId !== null} onClick={(event) => {
          event.stopPropagation();
          void handleDeleteAlert(alertDetails.alertId, "trading");
        }}>{deletingAlertId === alertDetails.alertId ? "Deleting..." : "Delete"}</Button>,
      };
    });

    return [...tokenRows, ...tradingRows];
  }, [deletingAlertId, fmt, tokenAlerts.data, tradingAlerts.data]);

  const headers = useMemo(
    () => [
      { header: "Type", key: "type" },
      { header: "Target", key: "target" },
      { header: "Alert Name", key: "alertName" },
      { header: "Created At", key: "createdAt" },
      { header: "Actions", key: "actions", align: "end" as const },
    ],
    [],
  );

  const selectAlertType = (type: AlertType) => {
    setSelectedAlertType(type);
    setStep("configuration");
  };

  const onModalClose = () => {
    setStep("type-selection");
    setSelectedAlertType(null);
  };

  const alertTypeOptions: AlertTypeOption[] = [
    {
      id: "technical-indicators",
      title: "Technical Indicators",
      description:
        "You receive alerts when there are some buy/sell signals following professional technical indicators. Recommended for professional users.",
      example: '(Example: "EMA of SOL/USD 1h cross up 70")',
    },
    {
      id: "token-stats",
      title: "Token Stats Performance",
      description:
        "You receive alerts when token(s) changes its non price parameters such as volume, number of trades, etc. In a certain time frames.",
      example:
        '(Example: "SOL (Solana) Price change 5 % in 1h is greater than 80%")',
    },
    {
      id: "trading-events",
      title: "Trading Events",
      description:
        "You receive alerts when specific actions happened, such as large buys, large sells or any trades by a wallet.",
      example:
        '(Example: "Wallet txqnzhz5z9...NsAFfXqkU2h (Solana) has a trade with maximum 1 month, To setup longer time, please Upgrade to PRO")',
    },
    {
      id: "market-movements",
      title: "Market Movements",
      description:
        "Get notifications following market events such as new trending tokens or new tokens listed.",
      example: '(Example: "WSOL (Solana) gets into Top10 Trending list")',
    },
  ];

  return (
    <PageWrapper noMarketTickers>
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4} style={{ marginTop: 32 }}>
          <Section level={1}>
            <Stack gap={5}>
              <div>
                <h1>Alerts Demo</h1>
                <p>View all alerts for your account</p>
              </div>

              <ModalStateManager
                renderLauncher={({ setOpen }) => (
                  <Button
                    kind="primary"
                    renderIcon={Add}
                    onClick={() => setOpen(true)}
                  >
                    Create New Alert
                  </Button>
                )}
              >
                {({ open, setOpen }) => {
                  const ConfigComponent =
                    selectedAlertType && alertConfigModules[selectedAlertType];

                  return (
                    <>
                      {step == "type-selection" && (
                        <AlertTypeSelection
                          open={open}
                          onClose={() => setOpen(false)}
                          alertTypeOptions={alertTypeOptions}
                          onSelectType={selectAlertType}
                        />
                      )}

                      {step == "configuration" &&
                        (ConfigComponent ? (
                          <ConfigComponent
                            open={open}
                            onReturn={() => setStep("type-selection")}
                            onFinish={() => {
                              onModalClose();
                              void refreshAlerts();
                              setOpen(false);
                            }}
                          />
                        ) : (
                          <ComposedModal
                            open={open}
                            onClose={() => {
                              console.log("close");
                              onModalClose();
                              setOpen(false);
                            }}
                          >
                            <ModalBody>Not implemented yet</ModalBody>
                          </ComposedModal>
                        ))}
                    </>
                  );
                }}
              </ModalStateManager>

              <Tble
                rows={rows}
                headers={headers}
                title="Your Alerts"
                loading={tokenAlerts.isLoading || tradingAlerts.isLoading}
                enablePagination
                pageSize={10}
              />

              {deleteFeedback && (
                <Txt
                  block
                  secondary={deleteFeedback.kind !== "error"}
                  style={{
                    color:
                      deleteFeedback.kind === "error"
                        ? "#da1e28"
                        : undefined,
                  }}
                >
                  {deleteFeedback.message}
                </Txt>
              )}

              {(tokenAlerts.error || tradingAlerts.error) && (
                <Txt block secondary>
                  Failed to load alerts
                </Txt>
              )}
            </Stack>
          </Section>
        </Column>
      </Grid>
    </PageWrapper>
  );
}
