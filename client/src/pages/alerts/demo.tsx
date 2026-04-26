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
  DatePicker,
  DatePickerInput,
  FormGroup,
  Grid,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Section,
  Stack,
  TimePicker,
} from "@carbon/react";
import { Add, ArrowLeft, ArrowRight } from "@carbon/react/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form";
import z from "zod";
import AlertNotificationSettings from "./components/AlertNotificationSettings";
import TokenStatsConfig from "./components/TokenStatsConfig";
import TradingEventsConfig from "./components/TradingEventsConfig";
import styles from "./demo.module.scss";
import {
  alertPeriods,
  alertTypes,
  conditionOps,
  defaultConfig,
  tokenAlertMetrics,
  tradingAggregations,
  triggerModes,
  type AlertFormValues,
  type AlertStep,
  type AlertType,
} from "./form-types";

interface AlertRow {
  id: string;
  type: string;
  target: string;
  alertName: string;
  createdAt: string;
  [key: string]: string;
}

const alertConfigModules: Partial<Record<AlertType, ComponentType>> = {
  "token-stats": TokenStatsConfig,
  "trading-events": TradingEventsConfig,
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
  period: z.enum(alertPeriods),
  metric: z.enum(tokenAlertMetrics),
  condition: z.enum(conditionOps),
  value: z
    .string()
    .trim()
    .min(1)
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), "Invalid number"),
});

const tradingConditionRowSchema = z.object({
  id: z.string().min(1),
  period: z.enum(alertPeriods),
  aggregation: z.enum(tradingAggregations),
  condition: z.enum(conditionOps),
  value: z
    .string()
    .trim()
    .min(1)
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), "Invalid number"),
});

const tradingScopeSchema = z.object({
  walletAddress: z.string().trim(),
  tokenAddress: z.string().trim(),
  poolAddress: z.string().trim(),
  counterpartyAddress: z.string().trim(),
  direction: z.enum(["buy", "sell", "both"]),
});

const alertFormSchema = z
  .object({
    type: z.enum(alertTypes).nullable(),
    token: selectedTokenSchema.nullable(),
    triggerMode: z.enum(triggerModes),
    expiresAtDate: z.date().nullable(),
    expiresAtTime: z.string().trim().min(1),
    tokenConditions: z.array(conditionRowSchema).min(1).max(3),
    tradingConditions: z.array(tradingConditionRowSchema).min(1).max(3),
    tradingScope: tradingScopeSchema,
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

    if (data.type == "trading-events" && data.tradingConditions.length == 0) {
      ctx.addIssue({
        code: "custom",
        path: ["tradingConditions"],
        message: "At least one condition is required",
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

type AlertConfig = z.output<typeof alertFormSchema>;
function AlertConfigurationShared() {
  const { lang } = useLocalization();
  const { control } = useFormContext<AlertFormValues>();

  const datePickerLocale = lang == "vi" ? "vn" : "en";
  const datePickerFormat = lang == "vi" ? "d/m/Y" : "m/d/Y";

  return (
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
                field.onChange(next);
              }}
            >
              <RadioButton id="once" labelText="Only Once" value="once" />
              <RadioButton id="always" labelText="Always" value="always" />
            </RadioButtonGroup>
          )}
        />
      </FormGroup>
      <FormGroup legendText="Expiry">
        <Stack gap={1} orientation="horizontal" className={styles.dateTimeWrap}>
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
    defaultValues: useMemo(() => defaultConfig(), []),
    resolver: zodResolver(alertFormSchema),
    mode: "onChange",
  });

  const tokenAlerts = useGet(
    client.api.alerts.tokens,
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const tradingAlerts = useGet(
    client.api.alerts.trading,
    200,
    {},
    {
      enabled: !!user,
    },
  );

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

    const selectedType = methods.getValues("type");
    const fieldsToValidate =
      selectedType == "token-stats"
        ? (["token", "tokenConditions"] as const)
        : selectedType == "trading-events"
          ? (["tradingConditions"] as const)
          : ([] as const);

    if (fieldsToValidate.length == 0) {
      return;
    }

    const isValid = await methods.trigger([...fieldsToValidate]);
    if (!isValid) {
      return;
    }

    setStep("notification");
  };

  const handleModalClose = () => {
    setStep("type-selection");
    methods.reset(defaultConfig());
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

    if (data.type != "token-stats" && data.type != "trading-events") {
      handleModalClose();
      setOpen(false);
      return;
    }

    const expiresAt = combineLocalDateAndTime(
      data.expiresAtDate,
      data.expiresAtTime,
    )!;

    try {
      setIsSubmitting(true);
      const email =
        data.emailEnabled && data.email.trim().length > 0
          ? data.email.trim()
          : null;

      const res =
        data.type == "token-stats"
          ? await client.api.alerts.tokens.$post({
              json: {
                alertType: "token",
                tokenTarget: {
                  tokenAddress: data.token!.id,
                },
                triggerMode: data.triggerMode,
                expiresAt,
                name: data.alertName,
                ...(email ? { delivery: { email } } : {}),
                conditions: data.tokenConditions.map((row) => ({
                  period: row.period,
                  metric: row.metric,
                  conditionOp: row.condition,
                  value: row.value,
                })),
              },
            })
          : await client.api.alerts.trading.$post({
              json: {
                alertType: "trading",
                triggerMode: data.triggerMode,
                expiresAt,
                name: data.alertName,
                ...(email ? { delivery: { email } } : {}),
                scopes: (() => {
                  const scope = data.tradingScope;
                  const trimOrNull = (value: string) => {
                    const trimmed = value.trim();
                    return trimmed.length > 0 ? trimmed : null;
                  };

                  const mapped = {
                    walletAddress: trimOrNull(scope.walletAddress),
                    tokenAddress: trimOrNull(scope.tokenAddress),
                    poolAddress: trimOrNull(scope.poolAddress),
                    counterpartyAddress: trimOrNull(scope.counterpartyAddress),
                    direction: scope.direction,
                  };

                  const hasAddress =
                    mapped.walletAddress ||
                    mapped.tokenAddress ||
                    mapped.poolAddress ||
                    mapped.counterpartyAddress;

                  if (!hasAddress && mapped.direction == "both") {
                    return [];
                  }

                  return [mapped];
                })(),
                conditions: data.tradingConditions.map((row) => ({
                  aggregation: row.aggregation,
                  period: row.period,
                  conditionOp: row.condition,
                  value: row.value,
                })),
              },
            });

      if (res.status == 201) {
        await Promise.all([tokenAlerts.mutate(), tradingAlerts.mutate()]);
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

  const selectedType = methods.watch("type");
  const ConfigModule =
    selectedType && selectedType in alertConfigModules
      ? alertConfigModules[selectedType]
      : null;

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

                          {step == "configuration" && (
                            <Stack gap={6}>
                              {ConfigModule ? (
                                <ConfigModule />
                              ) : (
                                <Txt>
                                  Configuration for this alert type is not yet
                                  implemented.
                                </Txt>
                              )}
                              <AlertConfigurationShared />
                            </Stack>
                          )}

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
                loading={tokenAlerts.isLoading || tradingAlerts.isLoading}
                enablePagination
                pageSize={10}
              />

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
