import client from "@/api/main";
import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { Flex } from "@/components/Flex";
import { ModalStateManager } from "@/components/ModelStateManager";
import { Divider } from "@/components/partials/Divider/Divider";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import type { SelectedTokenValue } from "@/components/TokenSearch/TokenSearch";
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
  CheckboxGroup,
  ClickableTile,
  Column,
  ComposedModal,
  DatePicker,
  DatePickerInput,
  Dropdown,
  FormGroup,
  Grid,
  IconButton,
  InlineNotification,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import z from "zod";
import styles from "./demo.module.scss";

interface AlertRow {
  id: string;
  tokenAddress: string;
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
type AlertPeriod = "30m" | "1h" | "6h" | "24h";
type TriggerMode = "once" | "always";

const ALERT_TYPE_VALUES = [
  "technical-indicators",
  "token-stats",
  "trading-events",
  "market-movements",
] as const;
const ALERT_PERIOD_VALUES = ["30m", "1h", "6h", "24h"] as const;
const TRIGGER_MODE_VALUES = ["once", "always"] as const;
const CONDITION_OP_VALUES = ["gt", "gte", "eq", "lt", "lte"] as const;
const ALERT_METRIC_VALUES = [
  "price_percentage",
  "price_usd",
  "volume_usd",
  "buying_volume_usd",
  "buying_volume_percentage",
  "selling_volume_usd",
  "selling_volume_percentage",
  "trades",
  "trades_percentage",
] as const;

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

const selectedTokenSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  imgUrl: z.string().nullable(),
});

const conditionRowSchema = z.object({
  id: z.string().min(1),
  period: z.enum(ALERT_PERIOD_VALUES),
  metric: z.enum(ALERT_METRIC_VALUES),
  condition: z.enum(CONDITION_OP_VALUES),
  value: z
    .string()
    .trim()
    .min(1)
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), "Invalid number"),
});

const alertFormSchema = z
  .object({
    type: z.enum(ALERT_TYPE_VALUES).nullable(),
    token: selectedTokenSchema.nullable(),
    triggerMode: z.enum(TRIGGER_MODE_VALUES),
    expiresAtDate: z.date().nullable(),
    expiresAtTime: z.string().trim().min(1),
    conditions: z.array(conditionRowSchema).min(1).max(3),
    alertName: z.string().trim().min(1),
    emailEnabled: z.boolean(),
    email: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (!data.type) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "Alert type is required",
      });
    }

    if (data.type == "token-stats" && !data.token) {
      ctx.addIssue({
        code: "custom",
        path: ["token"],
        message: "Token is required",
      });
    }

    if (data.emailEnabled) {
      if (!data.email || data.email.trim().length == 0) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email is required",
        });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Invalid email",
        });
      }
    }

    const expiresAt = combineLocalDateAndTime(
      data.expiresAtDate,
      data.expiresAtTime,
    );
    if (!expiresAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAtDate"],
        message: "Invalid expiry date/time",
      });
    }
  });

type AlertFormValues = z.input<typeof alertFormSchema>;
type AlertConfig = z.output<typeof alertFormSchema>;
type ConditionRow = AlertFormValues["conditions"][number];

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
    period: "1h",
    metric: "price_percentage",
    condition,
    value: "",
  };
}

function getMetricOption(metric: AlertMetric) {
  return METRIC_OPTIONS.find((item) => item.id == metric) ?? METRIC_OPTIONS[0];
}

function createInitialConfig(type: AlertType = null): AlertFormValues {
  return {
    type,
    token: null,
    triggerMode: "once",
    expiresAtDate: null,
    expiresAtTime: "09:00",
    conditions: [createConditionRow()],
    alertName: "",
    emailEnabled: true,
    email: "",
  };
}

function AlertConfiguration() {
  const { lang } = useLocalization();
  const {
    control,
    watch,
    register,
    formState: { errors },
  } = useFormContext<AlertFormValues>();
  const alertType = watch("type");
  const {
    fields: conditionFields,
    append,
    remove,
  } = useFieldArray({
    name: "conditions",
    control,
    keyName: "formId",
  });

  const datePickerLocale = lang == "vi" ? "vn" : "en";
  const datePickerFormat = lang == "vi" ? "d/m/Y" : "m/d/Y";

  if (alertType !== "token-stats") {
    return <Txt>Configuration for this alert type not yet implemented</Txt>;
  }

  return (
    <Stack gap={7}>
      <FormGroup legendText="Token">
        <Stack gap={4}>
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
                disabled: true,
              },
              {
                id: "watchlist",
                text: "From My Watchlist",
                disabled: true,
              },
            ]}
            itemToString={(item) => item?.text || ""}
            initialSelectedItem={{
              id: "specific",
              text: "Specific Token",
            }}
            disabled
          />
          <Controller
            name="token"
            control={control}
            render={({ field }) => (
              <DropdownPanelField
                id="token-search-select"
                titleText="Token"
                placeholder="Select token"
                initialValue={field.value}
                onValueChange={field.onChange}
                invalid={!!errors.token}
                invalidText={String(
                  errors.token?.message || "Token is required",
                )}
                renderValue={(token: SelectedTokenValue) => (
                  <Flex
                    align="center"
                    gap={3}
                    className={styles.selectedTokenValue}
                  >
                    <TknImg size={20} src={token.imgUrl} alt={token.symbol} />
                    <span>{token.symbol || token.name || token.id}</span>
                  </Flex>
                )}
                renderPanel={({ setValue, closePanel }) => (
                  <TokenSearch setValue={setValue} closePanel={closePanel} />
                )}
              />
            )}
          />
        </Stack>
      </FormGroup>
      <Divider />
      <FormGroup legendText="Conditions">
        <Stack gap={4}>
          <InlineNotification
            hideCloseButton
            lowContrast
            kind="info"
            title="Notes:"
            subtitle="Maximum 3 conditions"
            style={{ maxInlineSize: "none" }}
          />

          <Stack gap={2}>
            {conditionFields.map((row, index) => (
              <div key={row.formId} className={styles.conditionRow}>
                <Flex
                  className={styles.conditionConfig}
                  dir="row"
                  align="start"
                  gap={1}
                >
                  <Controller
                    name={`conditions.${index}.metric`}
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        id={`condition-metric-${row.formId}`}
                        titleText={
                          index == 0 ? "Metric" : `Metric ${index + 1}`
                        }
                        label="Select metric"
                        items={METRIC_OPTIONS}
                        itemToString={(item) => item?.text || ""}
                        selectedItem={getMetricOption(field.value)}
                        onChange={({ selectedItem }) => {
                          if (!selectedItem) return;
                          field.onChange(selectedItem.id);
                        }}
                      />
                    )}
                  />
                  <Controller
                    name={`conditions.${index}.period`}
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        id={`condition-period-${row.formId}`}
                        titleText={
                          index == 0 ? "Period" : `Period ${index + 1}`
                        }
                        label="Select period"
                        items={[
                          { id: "30m", text: "30m" },
                          { id: "1h", text: "1h" },
                          { id: "6h", text: "6h" },
                          { id: "24h", text: "24h" },
                        ]}
                        itemToString={(item) => item?.text || ""}
                        selectedItem={{ id: field.value, text: field.value }}
                        onChange={({ selectedItem }) => {
                          if (!selectedItem) return;
                          field.onChange(selectedItem.id as AlertPeriod);
                        }}
                      />
                    )}
                  />
                  <Controller
                    name={`conditions.${index}.condition`}
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        id={`condition-op-${row.formId}`}
                        titleText={
                          index == 0 ? "Condition" : `Condition ${index + 1}`
                        }
                        label="Select condition"
                        items={CONDITION_OPTIONS}
                        itemToString={(item) => item?.text || ""}
                        selectedItem={getConditionOption(field.value)}
                        onChange={({ selectedItem }) => {
                          if (!selectedItem) return;
                          field.onChange(selectedItem.id);
                        }}
                      />
                    )}
                  />
                  <TextInput
                    id={`condition-value-${row.formId}`}
                    labelText="Value"
                    placeholder="10"
                    {...register(`conditions.${index}.value`)}
                    invalid={!!errors.conditions?.[index]?.value}
                    invalidText={String(
                      errors.conditions?.[index]?.value?.message || "",
                    )}
                  />
                  <div
                    style={{
                      paddingBlockStart: "1.5rem",
                    }}
                  >
                    <IconButton
                      size="md"
                      kind="ghost"
                      label="Remove"
                      style={{
                        visibility: index > 0 ? "visible" : "hidden",
                      }}
                      onClick={() => {
                        if (index == 0) return;
                        remove(index);
                      }}
                    >
                      <SubtractAlt />
                    </IconButton>
                  </div>
                </Flex>
              </div>
            ))}
            {conditionFields.length < 3 && (
              <Button
                kind="primary"
                renderIcon={Add}
                onClick={() => {
                  append(createConditionRow());
                }}
              >
                Add Condition
              </Button>
            )}
          </Stack>
        </Stack>
      </FormGroup>
      <Divider />
      <Stack gap={2} orientation="horizontal">
        <FormGroup legendText="Trigger">
          <Controller
            name="triggerMode"
            control={control}
            render={({ field }) => (
              <RadioButtonGroup
                name="trigger"
                valueSelected={field.value}
                onChange={(next) => {
                  field.onChange(next as TriggerMode);
                }}
              >
                <RadioButton id="once" labelText="Only Once" value="once" />
                <RadioButton id="always" labelText="Always" value="always" />
              </RadioButtonGroup>
            )}
          />
        </FormGroup>
        <FormGroup legendText="Expiry">
          <Stack
            gap={1}
            orientation="horizontal"
            className={overwriteStyles.dateTimePicker}
          >
            <Controller
              name="expiresAtDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  datePickerType="single"
                  locale={datePickerLocale}
                  dateFormat={datePickerFormat}
                  value={field.value ? [field.value] : []}
                  onChange={(selectedDates) => {
                    field.onChange(selectedDates[0] ?? null);
                  }}
                >
                  <DatePickerInput
                    id="expiry-date-input"
                    placeholder="mm/dd/yyyy"
                    labelText="Expiry"
                    hideLabel
                  />
                </DatePicker>
              )}
            />
            <Controller
              name="expiresAtTime"
              control={control}
              render={({ field }) => (
                <TimePicker
                  id="expiry-time-input"
                  labelText="24h"
                  hideLabel
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                  }}
                />
              )}
            />
          </Stack>
          {/* <Txt secondary size="sm" block>
            UTC stored: {expiresAtUtc ? fmt.datetime.utc(expiresAtUtc) : "---"}
          </Txt> */}
        </FormGroup>
      </Stack>
    </Stack>
  );
}

function AlertNotificationSettings() {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<AlertFormValues>();
  const emailEnabled = watch("emailEnabled");

  return (
    <Stack gap={6}>
      <FormGroup legendText="Delivery Channel">
        <CheckboxGroup legendText="Group label">
          <Flex dir="row" align="center" gap={20}>
            <Controller
              name="emailEnabled"
              control={control}
              render={({ field }) => (
                <Checkbox
                  className={styles.emailCheckBox}
                  id="delivery-channel-email"
                  labelText="Email"
                  checked={field.value}
                  onChange={(_, data) => field.onChange(data.checked)}
                  style={{ maxInlineSize: "fit-content" }}
                />
              )}
            />
            {emailEnabled && (
              <TextInput
                className={styles.emailSetup}
                labelText="Email"
                hideLabel
                placeholder="phuc21744@gmail.com"
                id="delivery-channel-email__email"
                helperText=""
                {...register("email")}
                invalid={!!errors.email}
                invalidText={String(errors.email?.message || "")}
              />
            )}
          </Flex>
          <Checkbox
            id="delivery-channel-telegram"
            labelText="Telegram"
            disabled
          />
          <Checkbox
            id="delivery-channel-discord"
            labelText="Discord"
            disabled
          />
        </CheckboxGroup>
      </FormGroup>
      <Divider />
      <FormGroup legendText="Alert">
        <Stack gap={4}>
          <TextInput
            labelText="Alert name"
            placeholder="Token Stats Performance 1"
            id="alert-name-input"
            {...register("alertName")}
            invalid={!!errors.alertName}
            invalidText={String(errors.alertName?.message || "")}
          />
          <TextArea
            className={overwriteStyles.filledTextArea}
            labelText="Message (Auto)"
            readOnly
            value={`Token SOL on Solana
Trigger condition:
Price change (%) in 1h from 10% to 100%`}
            id="alert-message-textarea"
          />
        </Stack>
      </FormGroup>
    </Stack>
  );
}

export default function AlertsDemo() {
  const { fmt } = useLocalization();
  const { user } = useAuth();
  const [step, setStep] = useState<AlertStep>("type-selection");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methods = useForm<AlertFormValues, unknown, AlertConfig>({
    defaultValues: useMemo(() => createInitialConfig(), []),
    resolver: zodResolver(alertFormSchema),
    mode: "onChange",
  });

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
      createdAt: fmt.datetime.datetime(alert.createdAt),
    }));
  }, [alerts, fmt]);

  const headers = useMemo(
    () => [
      { header: "Token Address", key: "tokenAddress" },
      { header: "Alert Type", key: "alertType" },
      { header: "Created At", key: "createdAt" },
    ],
    [],
  );

  const selectAlertType = (type: AlertType) => {
    methods.setValue("type", type);
    setStep("configuration");
  };

  const goBack = () => {
    if (step == "configuration") {
      setStep("type-selection");
    } else if (step == "notification") {
      setStep("configuration");
    }
  };

  const goNext = async () => {
    if (step != "configuration") {
      return;
    }

    const isValid = await methods.trigger(["token", "conditions"]);
    if (!isValid) {
      return;
    }

    setStep("notification");
  };

  const handleModalClose = () => {
    setStep("type-selection");
    methods.reset(createInitialConfig());
  };

  const handleSave = async (setOpen: (next: boolean) => void) => {
    const isValid = await methods.trigger();
    if (!isValid) {
      return;
    }

    const parsed = alertFormSchema.safeParse(methods.getValues());
    if (!parsed.success) {
      return;
    }
    const data = parsed.data;

    if (data.type != "token-stats") {
      handleModalClose();
      setOpen(false);
      return;
    }

    const expiresAt = combineLocalDateAndTime(
      data.expiresAtDate,
      data.expiresAtTime,
    )!;

    const mappedConditions = data.conditions.map((row) => ({
      period: row.period,
      alertType: row.metric,
      condition: row.condition,
      value: row.value,
    }));

    if (mappedConditions.length == 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const email =
        data.emailEnabled && data.email.trim().length > 0
          ? data.email.trim()
          : null;

      const res = await client.api.alerts.$post({
        json: {
          tokenAddress: data.token!.id,
          triggerMode: data.triggerMode,
          expiresAt,
          alertName: data.alertName,
          ...(email ? { email } : {}),
          conditions: mappedConditions,
        },
      });

      if (res.status == 201) {
        await alerts.mutate();
        handleModalClose();
        setOpen(false);
      }
    } catch (error) {
      console.log("failed to create alert", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFooterButtons = (setOpen: (next: boolean) => void) => {
    switch (step) {
      case "configuration":
        return (
          <>
            <Button kind="secondary" onClick={goBack} renderIcon={ArrowLeft}>
              Back
            </Button>
            <Button
              kind="primary"
              onClick={() => void goNext()}
              renderIcon={ArrowRight}
            >
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
            <Button
              kind="primary"
              onClick={() => void handleSave(setOpen)}
              disabled={isSubmitting}
            >
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
                      <FormProvider {...methods}>
                        <Stack gap={2}>
                          {step == "type-selection" && (
                            <AlertTypeSelection
                              alertTypeOptions={alertTypeOptions}
                              onSelectType={selectAlertType}
                            />
                          )}

                          {step == "configuration" && <AlertConfiguration />}

                          {step == "notification" && (
                            <AlertNotificationSettings />
                          )}
                        </Stack>
                      </FormProvider>
                    </ModalBody>
                    <ModalFooter>{renderFooterButtons(setOpen)}</ModalFooter>
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
