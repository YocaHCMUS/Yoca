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
  ComposedModal,
  ModalBody,
  ModalHeader,
  Stack,
  InlineLoading,
} from "@carbon/react";
import { Add } from "@carbon/react/icons";
import { ComponentType, useMemo, useState } from "react";
import TokenStatsConfig from "./components/TokenStatsConfig";
import { TradingEventsConfig } from "./components/TradingEventsConfig";
import styles from "./demo.module.scss";
import { type AlertType } from "./form-schema";

interface AlertRow {
  id: string;
  type: string;
  target: string;
  alertName: string;
  createdAt: string;
  [key: string]: string;
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
  accentLabel: string;
};

function AlertTypeTile({ option, onClick, accentLabel }: AlertTypeTileProps) {
  return (
    <Button
      kind="ghost"
      onClick={() => onClick(option.id)}
      className={styles.alertTypeTile}
    >
      <Stack gap={2} className={styles.alertTypeTileBody}>
        <span className={styles.alertTypeTileEyebrow}>{accentLabel}</span>
        <Txt size="md" block bold>
          <span className={styles.alertTypeTileTitle}>{option.title}</span>
        </Txt>
        <Txt size="sm" block className={styles.alertTypeTileDescription}>
          {option.description}
        </Txt>
        <Txt secondary size="sm" block className={styles.alertTypeTileExample}>
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
    <ComposedModal
      open={open}
      onClose={onClose}
      className={styles.alertModalRoot}
    >
      <ModalHeader label="Alerts" title="Select trigger type" />
      <ModalBody className={styles.alertTypeModalBody}>
        <Stack gap={4}>
          <Txt secondary size="sm" className={styles.modalIntro}>
            Please select an alert trigger type to continue.
          </Txt>
          <div className={styles.alertTypeGrid}>
            {alertTypeOptions.map((option) => (
              <AlertTypeTile
                key={option.id}
                option={option}
                onClick={onSelectType}
                accentLabel={
                  option.id == "token-stats"
                    ? "Token Alerts"
                    : option.id == "trading-events"
                      ? "Trading Alerts"
                      : "Coming Soon"
                }
              />
            ))}
          </div>
        </Stack>
      </ModalBody>
    </ComposedModal>
  );
}

export default function AlertsDemo() {
  const { fmt } = useLocalization();
  const { user } = useAuth();
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
    client.api.alertsHp.trading,
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const isLoading = tokenAlerts.isLoading || tradingAlerts.isLoading;

  const rows: AlertRow[] = useMemo(() => {
    const tokenRows = (tokenAlerts.data ?? []).map((alertDetails) => ({
      id: alertDetails.alertId,
      type: "token",
      target: alertDetails.tokenTarget?.tokenAddress || "-",
      alertName: alertDetails.alert.alertName,
      createdAt: fmt.datetime.datetime(alertDetails.alert.createdAt),
    }));

    const tradingRows = (tradingAlerts.data ?? []).map((alertDetails) => {
      const firstScope = alertDetails.tradingScopes[0];
      const target =
        firstScope?.walletAddress ||
        firstScope?.tokenAddress ||
        firstScope?.poolAddress ||
        firstScope?.counterpartyAddress ||
        "all";

      return {
        id: alertDetails.alertId,
        type: "trading",
        target,
        alertName: alertDetails.alert.name,
        createdAt: fmt.datetime.datetime(alertDetails.alert.createdAt),
      };
    });

    return [...tokenRows, ...tradingRows];
  }, [fmt, tokenAlerts.data, tradingAlerts.data]);

  const tokenAlertCount = useMemo(
    () => (tokenAlerts.data ?? []).length,
    [tokenAlerts.data],
  );

  const tradingAlertCount = useMemo(
    () => (tradingAlerts.data ?? []).length,
    [tradingAlerts.data],
  );

  const totalAlertCount = rows.length;

  const headers = useMemo(
    () => [
      { header: "Type", key: "type" },
      { header: "Target", key: "target" },
      { header: "Alert Name", key: "alertName" },
      { header: "Created At", key: "createdAt" },
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
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroEyebrow}>Alert Center</div>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <h1 className={styles.title}>Token Alerts</h1>
              <p className={styles.subtitle}>
                Monitor token-specific alert rules, trading events, and delivery
                settings in a clean Yoca dashboard layout.
              </p>
              <div className={styles.heroPills}>
                <span className={styles.heroPill}>Token performance</span>
                <span className={styles.heroPill}>Trading events</span>
                <span className={styles.heroPill}>Delivery sync</span>
              </div>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {isLoading ? "..." : String(totalAlertCount)}
                </span>
                <span className={styles.metricLabel}>Total alerts</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {isLoading ? "..." : String(tokenAlertCount)}
                </span>
                <span className={styles.metricLabel}>Token alerts</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {isLoading ? "..." : String(tradingAlertCount)}
                </span>
                <span className={styles.metricLabel}>Trading alerts</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              <h2 className={styles.sectionTitle}>Your Alerts</h2>
              <p className={styles.sectionCopy}>
                Token and trading alert rules created for your account.
              </p>
            </div>

            <ModalStateManager
              renderLauncher={({ setOpen }) => (
                <Button
                  kind="primary"
                  renderIcon={Add}
                  onClick={() => setOpen(true)}
                  className={styles.primaryAction}
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
                        onClose={() => {
                          onModalClose();
                          setOpen(false);
                        }}
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
                            tokenAlerts.mutate();
                            tradingAlerts.mutate();
                            setOpen(false);
                          }}
                        />
                      ) : (
                        <ComposedModal
                          open={open}
                          onClose={() => {
                            onModalClose();
                            setOpen(false);
                          }}
                          className={styles.alertModalRoot}
                        >
                          <ModalBody className={styles.alertModalBody}>
                            <div className={styles.emptyState}>
                              <div className={styles.emptyStateEyebrow}>
                                Coming soon
                              </div>
                              <h3 className={styles.emptyStateTitle}>
                                Not implemented yet
                              </h3>
                              <p className={styles.emptyStateDescription}>
                                This alert type is reserved for future token
                                alert workflows.
                              </p>
                            </div>
                          </ModalBody>
                        </ComposedModal>
                      ))}
                  </>
                );
              }}
            </ModalStateManager>
          </div>

          <div className={styles.panelBody}>
            {isLoading ? (
              <div className={styles.loadingCard}>
                <InlineLoading description="Loading alerts" />
              </div>
            ) : rows.length > 0 ? (
              <div className={styles.tableSection}>
                <div className={styles.tableShell}>
                  <Tble
                    rows={rows.map((row) => ({
                      ...row,
                      type: (
                        <span
                          className={styles.alertTypeLabel}
                          data-type={row.type}
                        >
                          {row.type === "token" ? "Token" : "Trading"}
                        </span>
                      ),
                      target: (
                        <span className={styles.targetCell}>{row.target}</span>
                      ),
                      alertName: (
                        <span className={styles.nameCell}>{row.alertName}</span>
                      ),
                      createdAt: (
                        <span className={styles.dateCell}>{row.createdAt}</span>
                      ),
                    }))}
                    headers={headers}
                    enablePagination
                    pageSize={10}
                    boxed={false}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateEyebrow}>Token alerts</div>
                <h3 className={styles.emptyStateTitle}>No token alerts yet</h3>
                <p className={styles.emptyStateDescription}>
                  Create your first token alert to track token performance and
                  trading changes from a polished alert center.
                </p>
                <p className={styles.modalIntro}>
                  Use the Create New Alert button above to open the alert
                  builder.
                </p>
              </div>
            )}

            {(tokenAlerts.error || tradingAlerts.error) && (
              <Txt block secondary>
                Failed to load alerts
              </Txt>
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
