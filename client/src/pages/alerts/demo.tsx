import client from "@/api/main";
import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { Flex } from "@/components/Flex";
import { ModalStateManager } from "@/components/ModelStateManager";
import Tble from "@/components/Tble";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  Button,
  Checkbox,
  ClickableTile,
  Column,
  ComposedModal,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Grid,
  IconButton,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Section,
  Stack,
  TextArea,
  TextInput,
  TimePicker,
} from "@carbon/react";
import { Add, ArrowLeft, ArrowRight, SubtractAlt } from "@carbon/react/icons";
import { useMemo, useState } from "react";
import styles from "./demo.module.scss";

interface AlertRow {
  id: string;
  tokenAddress: string;
  period: string;
  createdAt: string;
  [key: string]: string;
}

type AlertType =
  | "technical-indicators"
  | "token-stats"
  | "trading-events"
  | "market-movements"
  | null;
type AlertStep = "type-selection" | "configuration" | "notification";

interface AlertConfig {
  type: AlertType;
  token?: string;
  network?: string;
  metric?: string;
  threshold?: number;
  condition?: string;
  name?: string;
  email?: boolean;
  telegram?: boolean;
  discord?: boolean;
}

interface AlertTypeOption {
  id: AlertType;
  title: string;
  description: string;
  example: string;
}

interface AlertTypeTileProps {
  option: AlertTypeOption;
  onClick: (type: AlertType) => void;
}

function AlertTypeTile({ option, onClick }: AlertTypeTileProps) {
  return (
    <ClickableTile
      onClick={() => onClick(option.id)}
      className={overwriteStyles.alertTypeTile}
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
    </ClickableTile>
  );
}

interface AlertTypeSelectionProps {
  alertTypeOptions: AlertTypeOption[];
  onSelectType: (type: AlertType) => void;
}

function AlertTypeSelection({
  alertTypeOptions,
  onSelectType,
}: AlertTypeSelectionProps) {
  return (
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
  );
}

interface AlertConfigurationProps {
  config: AlertConfig;
  setConfig: (config: AlertConfig) => void;
}

type ConditionOp = "gt" | "gte" | "eq" | "lt" | "lte";

type AlertMetric =
  | "price_percentage"
  | "price_usd"
  | "volume_usd"
  | "buying_volume_usd"
  | "buying_volume_percentage"
  | "selling_volume_usd"
  | "selling_volume_percentage"
  | "trades"
  | "trades_percentage";

interface ConditionRow {
  id: string;
  metric: AlertMetric;
  condition: ConditionOp;
  value: string;
}

const CONDITION_OPTIONS: Array<{ id: ConditionOp; text: string }> = [
  { id: "gt", text: "Greater than (>)" },
  { id: "gte", text: "Greater than or equal (≥)" },
  { id: "eq", text: "Equal (=)" },
  { id: "lt", text: "Less than (<)" },
  { id: "lte", text: "Less than or equal (≤)" },
];

const METRIC_OPTIONS: Array<{ id: AlertMetric; text: string; helper: string }> =
  [
    {
      id: "price_percentage",
      text: "Price change",
      helper: "Percent change over the selected period",
    },
    { id: "price_usd", text: "Price", helper: "Current token price in USD" },
    { id: "volume_usd", text: "Volume", helper: "Total trading volume in USD" },
    {
      id: "buying_volume_usd",
      text: "Buy volume",
      helper: "Buy-side volume in USD",
    },
    {
      id: "buying_volume_percentage",
      text: "Buy volume %",
      helper: "Buy-side share of total volume",
    },
    {
      id: "selling_volume_usd",
      text: "Sell volume",
      helper: "Sell-side volume in USD",
    },
    {
      id: "selling_volume_percentage",
      text: "Sell volume %",
      helper: "Sell-side share of total volume",
    },
    { id: "trades", text: "Trades", helper: "Number of trades" },
    {
      id: "trades_percentage",
      text: "Trades %",
      helper: "Trade count change over the selected period",
    },
  ];

function getConditionOption(condition: ConditionOp) {
  return (
    CONDITION_OPTIONS.find((item) => item.id == condition) ??
    CONDITION_OPTIONS[0]
  );
}

function createConditionRow(condition: ConditionOp = "gt"): ConditionRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metric: "price_percentage",
    condition,
    value: "",
  };
}

function getMetricOption(metric: AlertMetric) {
  return METRIC_OPTIONS.find((item) => item.id == metric) ?? METRIC_OPTIONS[0];
}

function combineLocalDateAndTime(
  date: Date | null,
  time: string,
): string | null {
  if (!date || !time) return null;

  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const localDate = new Date(date);
  localDate.setHours(hours, minutes, 0, 0);
  return localDate.toISOString();
}

function AlertConfiguration({ config, setConfig }: AlertConfigurationProps) {
  const { lang, fmt } = useLocalization();
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [expiryTime, setExpiryTime] = useState("09:00");
  const [conditions, setConditions] = useState<ConditionRow[]>([
    createConditionRow(),
  ]);

  const datePickerLocale = lang == "vi" ? "vn" : "en";
  const datePickerFormat = lang == "vi" ? "d/m/Y" : "m/d/Y";
  const expiresAtUtc = useMemo(
    () => combineLocalDateAndTime(expiryDate, expiryTime),
    [expiryDate, expiryTime],
  );

  if (config.type !== "token-stats") {
    return <Txt>Configuration for this alert type not yet implemented</Txt>;
  }

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Txt size="sm" secondary>
          Token
        </Txt>
        <Dropdown
          id="token-type-select"
          titleText="Token Type"
          label="Specific Token"
          items={[
            {
              id: "specific",
              text: "Specific Token",
            },
            {
              id: "portfolio",
              text: "From My Portfolio",
            },
            {
              id: "watchlist",
              text: "From My Watchlist",
            },
          ]}
          itemToString={(item) => item?.text || ""}
          initialSelectedItem={{
            id: "specific",
            text: "Specific Token",
          }}
        />
        <DropdownPanelField
          id="token-search-select"
          titleText="Token"
          placeholder="Select token"
          renderPanel={({ setValue, closePanel }) => (
            <TokenSearch setValue={setValue} closePanel={closePanel} />
          )}
        />
      </Stack>

      <Stack gap={2}>
        <Txt secondary size="sm">
          Conditions
        </Txt>
        <Txt size="sm" secondary>
          Add up to 3 conditions. Each row has metric, operator, and value.
        </Txt>

        <Stack gap={2}>
          {conditions.map((row, index) => (
            <Flex
              className={styles.conditionEntry}
              key={row.id}
              dir="row"
              align="end"
              gap={1}
            >
              <Dropdown
                id={`condition-metric-${row.id}`}
                titleText={index == 0 ? "Metric" : `Metric ${index + 1}`}
                label="Select metric"
                items={METRIC_OPTIONS}
                itemToString={(item) => item?.text || ""}
                selectedItem={getMetricOption(row.metric)}
                onChange={({ selectedItem }) => {
                  if (!selectedItem) return;
                  setConditions((current) =>
                    current.map((item) =>
                      item.id == row.id
                        ? { ...item, metric: selectedItem.id }
                        : item,
                    ),
                  );
                }}
                style={{ flex: 1 }}
              />
              <Dropdown
                id={`condition-op-${row.id}`}
                titleText={index == 0 ? "Condition" : `Condition ${index + 1}`}
                label="Select condition"
                items={CONDITION_OPTIONS}
                itemToString={(item) => item?.text || ""}
                selectedItem={getConditionOption(row.condition)}
                onChange={({ selectedItem }) => {
                  if (!selectedItem) return;
                  setConditions((current) =>
                    current.map((item) =>
                      item.id == row.id
                        ? { ...item, condition: selectedItem.id }
                        : item,
                    ),
                  );
                }}
                style={{ flex: 1 }}
              />
              <TextInput
                id={`condition-value-${row.id}`}
                labelText="Value"
                placeholder="10"
                value={row.value}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setConditions((current) =>
                    current.map((item) =>
                      item.id == row.id ? { ...item, value: nextValue } : item,
                    ),
                  );
                }}
              />

              <IconButton
                size="md"
                kind="ghost"
                label="Remove"
                style={{ visibility: index > 0 ? "visible" : "hidden" }}
                onClick={() => {
                  if (index == 0) return;
                  setConditions((current) =>
                    current.filter((item) => item.id != row.id),
                  );
                }}
              >
                <SubtractAlt />
              </IconButton>
            </Flex>
          ))}

          {conditions.length < 3 && (
            <Button
              kind="primary"
              size="sm"
              renderIcon={Add}
              onClick={() => {
                setConditions((current) => [...current, createConditionRow()]);
              }}
            >
              Add Condition
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack gap={2} orientation="horizontal">
        <Stack gap={2}>
          <Txt secondary size="sm">
            Trigger
          </Txt>
          <RadioButtonGroup name="trigger" defaultSelected="once">
            <RadioButton id="once" labelText="Only Once" value="once" />
            <RadioButton id="always" labelText="Always" value="always" />
          </RadioButtonGroup>
        </Stack>
        <Stack>
          <Stack
            gap={1}
            orientation="horizontal"
            className={overwriteStyles.dateTimePicker}
            style={{ justifyContent: "start" }}
          >
            <DatePicker
              datePickerType="single"
              locale={datePickerLocale}
              dateFormat={datePickerFormat}
              onChange={(selectedDates) => {
                setExpiryDate(selectedDates[0] ?? null);
              }}
            >
              <DatePickerInput
                id="expiry-date-input"
                placeholder="mm/dd/yyyy"
                labelText="Expiry"
              />
            </DatePicker>
            <TimePicker
              id="expiry-time-input"
              labelText="24h"
              onChange={(event) => setExpiryTime(event.target.value)}
            />
          </Stack>
          <Txt secondary size="sm" block>
            UTC stored: {expiresAtUtc ? fmt.datetime.utc(expiresAtUtc) : "---"}
          </Txt>
        </Stack>
      </Stack>
    </Stack>
  );
}

interface AlertNotificationSettingsProps {
  config: AlertConfig;
  setConfig: (config: AlertConfig) => void;
}

function AlertNotificationSettings({
  config,
  setConfig,
}: AlertNotificationSettingsProps) {
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Txt size="md" block bold>
          * Delivery Channel
        </Txt>
        <Button kind="tertiary" size="sm">
          Use default
        </Button>
        <Stack gap={1} orientation="vertical">
          <Checkbox id="email" labelText="Email" defaultChecked />
          <Checkbox
            id="telegram"
            labelText="Telegram"
            disabled
            helperText="PRO"
          />
          <Checkbox
            id="discord"
            labelText="Discord"
            disabled
            helperText="PRO"
          />
        </Stack>
      </Stack>

      <TextInput
        labelText="* Alert name"
        placeholder="Token Stats Performance 1"
        value="Token Stats Performance 1"
        id="alert-name-input"
      />
      <TextArea
        labelText="Message (Auto)"
        readOnly
        value={`Token SOL on Solana
Trigger condition:
Price change (%) in 1h from 10% to 100%`}
        id="alert-message-textarea"
      />
    </Stack>
  );
}

export default function AlertsDemo() {
  const { fmt, tr } = useLocalization();
  const { user } = useAuth();
  const [step, setStep] = useState<AlertStep>("type-selection");
  const [config, setConfig] = useState<AlertConfig>({ type: null });

  const alerts = useGet(
    client.api.alerts,
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const rows: AlertRow[] = useMemo(() => {
    if (!alerts.data) return [];
    return alerts.data.map((alert) => ({
      id: alert.id,
      tokenAddress: alert.tokenAddress,
      period: alert.period,
      createdAt: fmt.datetime.datetime(alert.createdAt),
    }));
  }, [alerts, fmt]);

  console.log("alerts", alerts.data);

  const headers = useMemo(
    () => [
      { header: "Token Address", key: "tokenAddress" },
      { header: "Alert Type", key: "alertType" },
      { header: "Period", key: "period" },
      { header: "Created At", key: "createdAt" },
    ],
    [],
  );

  const selectAlertType = (type: AlertType) => {
    setConfig({ type });
    setStep("configuration");
  };

  const goBack = () => {
    if (step == "configuration") {
      setStep("type-selection");
    } else if (step == "notification") {
      setStep("configuration");
    }
  };

  const goNext = () => {
    if (step == "configuration") {
      setStep("notification");
    }
  };

  const handleModalClose = () => {
    setStep("type-selection");
    setConfig({ type: null });
  };

  const renderFooterButtons = () => {
    switch (step) {
      case "configuration":
        return (
          <>
            <Button kind="secondary" onClick={goBack} renderIcon={ArrowLeft}>
              Back
            </Button>
            <Button kind="primary" onClick={goNext} renderIcon={ArrowRight}>
              Next
            </Button>
          </>
        );
      case "notification":
        return (
          <>
            <Button kind="secondary" onClick={goBack} renderIcon={ArrowLeft}>
              Back
            </Button>
            <Button kind="primary" onClick={handleModalClose}>
              Save
            </Button>
          </>
        );
      default:
        return null;
    }
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
                {({ open, setOpen }) => (
                  <ComposedModal
                    open={open}
                    onClose={() => {
                      handleModalClose();
                      setOpen(false);
                    }}
                  >
                    <ModalHeader
                      label="Alerts"
                      title={
                        step == "type-selection"
                          ? "Create New Alert"
                          : step == "configuration"
                            ? "Alert Configuration"
                            : "Notification Settings"
                      }
                    />
                    <ModalBody>
                      <Stack gap={2} style={{ marginBlockEnd: 120 }}>
                        {step == "type-selection" && (
                          <AlertTypeSelection
                            alertTypeOptions={alertTypeOptions}
                            onSelectType={selectAlertType}
                          />
                        )}

                        {step == "configuration" && (
                          <AlertConfiguration
                            config={config}
                            setConfig={setConfig}
                          />
                        )}

                        {step == "notification" && (
                          <AlertNotificationSettings
                            config={config}
                            setConfig={setConfig}
                          />
                        )}
                      </Stack>
                    </ModalBody>
                    <ModalFooter>{renderFooterButtons()}</ModalFooter>
                  </ComposedModal>
                )}
              </ModalStateManager>

              <Tble
                rows={rows}
                headers={headers}
                title="Your Alerts"
                loading={alerts.isLoading}
                enablePagination
                pageSize={10}
              />

              {alerts.error && (
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
