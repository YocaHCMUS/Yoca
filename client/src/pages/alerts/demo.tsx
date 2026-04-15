import client from "@/api/main";
import { ModalStateManager } from "@/components/ModelStateManager";
import Tble from "@/components/Tble";
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
  ExpandableSearch,
  Grid,
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
import { Add, ArrowLeft, ArrowRight } from "@carbon/react/icons";
import { useMemo, useState } from "react";

interface AlertRow {
  id: string;
  tokenAddress: string;
  alertType: string;
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

function AlertConfiguration({ config, setConfig }: AlertConfigurationProps) {
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
        {/* <ComboBox
          id="carbon-combobox"
          invalidText="Error message goes here"
          items={[
            "Apple",
            "Apricot",
            "Avocado",
            "Banana",
            "Blackberry",
            "Blueberry",
            "Cantaloupe",
          ]}
          onChange={function k_e() {}}
          titleText="Label"
          typeahead
          warnText="Warning message goes here"
        /> */}
        <div
          className={overwriteStyles.inlineSearch}
          style={{
            display: "flex",
            position: "relative",
            alignItems: "center",
          }}
        >
          <p style={{ inlineSize: "100%" }}>hello</p>
          <div
            style={{
              position: "absolute",
              display: "flex",
              justifyContent: "flex-end",
              insetInline: 0,
              insetBlockStart: 0,
            }}
          >
            <ExpandableSearch labelText="Search" size="lg" className="FUkc" />
          </div>
        </div>
      </Stack>

      <Stack gap={2}>
        <Txt secondary size="sm">
          Conditions
        </Txt>
        <Txt size="sm" secondary>
          Maximum 3 different conditions
        </Txt>
        <Stack gap={1} orientation="horizontal" style={{ alignItems: "end" }}>
          <div style={{ width: 200 }}>
            <Dropdown
              id="metric-select"
              titleText="Metric"
              label="Price change (%)"
              items={[
                {
                  id: "price-change",
                  text: "Price change (%)",
                },
                { id: "volume", text: "Volume" },
                {
                  id: "trades",
                  text: "Number of trades",
                },
              ]}
              itemToString={(item) => item?.text || ""}
              initialSelectedItem={{
                id: "price-change",
                text: "Price change (%)",
              }}
              hideLabel
            />
          </div>
          <div style={{ width: 200 }}>
            <Dropdown
              id="metric-select"
              titleText="Metric"
              label="Price change (%)"
              items={[
                {
                  id: "30m",
                  text: "30m",
                },
                { id: "1h", text: "1h" },
                {
                  id: "6h",
                  text: "6h",
                },
                {
                  id: "24h",
                  text: "24h",
                },
              ]}
              itemToString={(item) => item?.text || ""}
              initialSelectedItem={{
                id: "1h",
                text: "1h",
              }}
              hideLabel
            />
          </div>
          <TextInput value="10" id="threshold-min-input" labelText="" />
          <TextInput value="100" id="threshold-max-input" labelText="" />
        </Stack>
      </Stack>

      <Stack gap={2}>
        <Checkbox
          id="condition-check"
          labelText="One condition is expired when token increases or decreases in value"
          defaultChecked
        />
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
          <Txt secondary size="sm">
            Expiry
          </Txt>
          <Stack
            gap={1}
            orientation="horizontal"
            className={overwriteStyles.dateTimePicker}
            style={{ justifyContent: "start" }}
          >
            <DatePicker datePickerType="single">
              <DatePickerInput
                id="expiry-date-input"
                placeholder="mm/dd/yyyy"
                labelText="Expiry Date"
                hideLabel
              />
            </DatePicker>
            <TimePicker
              id="expiry-time-input"
              labelText="Expiry Time"
              hideLabel
            />
          </Stack>
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
      alertType: alert.alertType,
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
                      <Stack gap={2} style={{ marginBlockEnd: 200 }}>
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
