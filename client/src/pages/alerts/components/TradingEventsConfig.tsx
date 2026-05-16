import { UserTradingAggregation } from "@/api/alerts";
import client from "@/api/main";
import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
import PoolSearch, {
  type SelectedPoolValue,
} from "@/components/PoolSearch/PoolSearch";
import { TknImg } from "@/components/TknImg";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Button,
  ComposedModal,
  Dropdown,
  FormGroup,
  IconButton,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextInput,
} from "@carbon/react";
import { Add, ArrowLeft, ArrowRight, SubtractAlt } from "@carbon/react/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import styles from "../demo.module.scss";
import {
  combineLocalDateAndTime,
  conditionOptions,
  directionOptions,
  periodOptions,
  TradingAlertForm,
  tradingEventsSchema,
} from "../form-schema";
import AlertConfigurationShared from "./AlertConfigurationShared";
import AlertNotificationSettings from "./AlertNotificationSettings";

const aggregationOptions: { id: UserTradingAggregation; text: string }[] = [
  { id: "volume_usd", text: "Volume (USD)" },
  { id: "trade_count", text: "Trade Count" },
];

function TradingEventsConfigContent() {
  const methods = useFormContext<TradingAlertForm>();
  const {
    control,
    register,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    name: "tradingConditions",
    control,
    keyName: "formId",
  });

  return (
    <Stack gap={7}>
      <FormGroup legendText="Scope">
        <Stack gap={4}>
          <TextInput
            id="scope-wallet-address"
            labelText="Wallet Address"
            placeholder="Enter wallet address"
            {...register("tradingScope.walletAddress")}
            invalid={!!errors.tradingScope?.walletAddress}
            invalidText={errors.tradingScope?.walletAddress?.message || ""}
          />
          <Controller
            name="tradingScope.token"
            control={control}
            render={({ field }) => (
              <DropdownPanelField
                id="token-search-select"
                titleText="Token"
                placeholder="Select token"
                initialValue={field.value}
                onValueChange={field.onChange}
                invalid={!!errors.tradingScope?.token}
                invalidText={
                  errors.tradingScope?.token?.message || "Token is required"
                }
                renderValue={(token) => (
                  <Flex
                    align="center"
                    gap={3}
                    className={styles.selectedTokenValue}
                  >
                    <TknImg size={20} src={token.imgUrl} alt={token.symbol} />
                    <span>{token.symbol || token.name || token.address}</span>
                  </Flex>
                )}
                renderPanel={({ setValue, closePanel }) => (
                  <TokenSearch setValue={setValue} closePanel={closePanel} />
                )}
              />
            )}
          />
          <Controller
            name="tradingScope.poolAddress"
            control={control}
            render={({ field }) => (
              <DropdownPanelField<SelectedPoolValue>
                id="pool-search-select"
                titleText="Pool"
                placeholder="Select pool"
                initialValue={null}
                onValueChange={(value) => {
                  field.onChange(value?.address ?? "");
                }}
                invalid={!!errors.tradingScope?.poolAddress}
                invalidText={errors.tradingScope?.poolAddress?.message || ""}
                renderValue={(pool) => (
                  <Flex
                    align="center"
                    gap={3}
                    className={styles.selectedTokenValue}
                  >
                    <Flex align="center" gap={-2} style={{ zIndex: 2 }}>
                      <TknImg
                        size={20}
                        src={pool.baseTokenImg}
                        alt={pool.baseTokenSymbol}
                      />
                      <span style={{ marginLeft: -10 }}>
                        <TknImg
                          size={20}
                          src={pool.quoteTokenImg}
                          alt={pool.quoteTokenSymbol}
                        />
                      </span>
                    </Flex>
                    <span>
                      {pool.baseTokenSymbol || pool.baseTokenAddress || "?"}/
                      {pool.quoteTokenSymbol || pool.quoteTokenAddress || "?"}
                    </span>
                  </Flex>
                )}
                renderPanel={({ setValue, closePanel }) => (
                  <PoolSearch setValue={setValue} closePanel={closePanel} />
                )}
              />
            )}
          />
          <TextInput
            id="scope-counterparty-address"
            labelText="Counterparty Address (Optional)"
            placeholder="Enter counterparty address"
            {...register("tradingScope.counterpartyAddress")}
            invalid={!!errors.tradingScope?.counterpartyAddress}
            invalidText={
              errors.tradingScope?.counterpartyAddress?.message || ""
            }
          />
          <Controller
            name="tradingScope.direction"
            control={control}
            render={({ field }) => (
              <Dropdown
                id="scope-direction"
                titleText="Direction"
                label="Select direction"
                items={directionOptions}
                itemToString={(item) => item?.text || ""}
                selectedItem={
                  directionOptions.find((option) => option.id == field.value) ||
                  directionOptions[0]
                }
                onChange={({ selectedItem }) => {
                  if (!selectedItem) return;
                  field.onChange(selectedItem.id);
                }}
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

          <Stack gap={6}>
            {fields.map((row, index) => (
              <div key={row.formId} className={styles.conditionRow}>
                <Flex
                  className={styles.conditionConfig}
                  dir="row"
                  align="start"
                  gap={1}
                >
                  <Controller
                    name={`tradingConditions.${index}.aggregation`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "16rem" }}>
                        <Dropdown
                          id={`trading-condition-aggregation-${row.formId}`}
                          titleText={
                            index == 0
                              ? "Aggregation"
                              : `Aggregation ${index + 1}`
                          }
                          label="Select aggregation"
                          items={aggregationOptions}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={
                            aggregationOptions.find(
                              (option) => option.id == field.value,
                            ) || aggregationOptions[0]
                          }
                          onChange={({ selectedItem }) => {
                            if (!selectedItem) return;
                            field.onChange(selectedItem.id);
                          }}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name={`tradingConditions.${index}.period`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`trading-condition-period-${row.formId}`}
                          titleText={
                            index == 0 ? "Period" : `Period ${index + 1}`
                          }
                          label="Select period"
                          items={periodOptions}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={{ id: field.value, text: field.value }}
                          onChange={({ selectedItem }) => {
                            if (!selectedItem) return;
                            field.onChange(selectedItem.id);
                          }}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name={`tradingConditions.${index}.op`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`trading-condition-op-${row.formId}`}
                          titleText={
                            index == 0 ? "Condition" : `Condition ${index + 1}`
                          }
                          label="Select condition"
                          items={conditionOptions}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={
                            conditionOptions.find(
                              (option) => option.id == field.value,
                            ) || conditionOptions[0]
                          }
                          onChange={({ selectedItem }) => {
                            if (!selectedItem) return;
                            field.onChange(selectedItem.id);
                          }}
                        />
                      </div>
                    )}
                  />

                  <TextInput
                    id={`trading-condition-value-${row.formId}`}
                    labelText="Value"
                    placeholder="10"
                    {...register(`tradingConditions.${index}.value`)}
                    invalid={!!errors.tradingConditions?.[index]?.value}
                    invalidText={
                      errors.tradingConditions?.[index]?.value?.message || ""
                    }
                  />

                  <div style={{ paddingBlockStart: "1.5rem" }}>
                    <IconButton
                      size="md"
                      kind="ghost"
                      label="Remove"
                      style={{ visibility: index > 0 ? "visible" : "hidden" }}
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

            {fields.length < 3 && (
              <Button
                kind="primary"
                renderIcon={Add}
                onClick={() => {
                  append({
                    period: "1h",
                    aggregation: "volume_usd",
                    op: "gt",
                    value: 0,
                  });
                }}
              >
                Add Condition
              </Button>
            )}
          </Stack>
        </Stack>
      </FormGroup>

      <AlertConfigurationShared />
    </Stack>
  );
}

export function createTradingEventsDefaultValues(): TradingAlertForm {
  return {
    type: "trading-events",
    triggerMode: "once",
    expiresAtDate: new Date(),
    expiresAtTime: "09:00",
    tradingConditions: [
      {
        period: "1h",
        aggregation: "volume_usd",
        op: "gt",
        value: 0,
      },
    ],
    tradingScope: {
      walletAddress: "",
      token: {
        address: "So11111111111111111111111111111111111111112",
        imgUrl:
          "https://assets.coingecko.com/coins/images/21629/standard/solana.jpg?1696520989",
        name: "Wrapped SOL",
        symbol: "SOL",
      },
      poolAddress: undefined,
      counterpartyAddress: undefined,
      direction: "both",
    },
    alertName: "",
    emailEnabled: true,
    email: "",
  };
}

const stepFields: Record<number, (keyof TradingAlertForm)[]> = {
  1: ["tradingConditions", "tradingScope"],
  2: ["email", "emailEnabled"],
};

const finalStepNum = 2;

interface TradingEventsConfigProps {
  onReturn: () => void;
  onFinish: () => void;
  open: boolean;
}

export function TradingEventsConfig({
  onReturn,
  onFinish,
  open,
}: TradingEventsConfigProps) {
  const { tr } = useLocalization();

  const [stepNum, setStepNum] = useState(1);
  const [isSubmitting, setSubmitting] = useState(false);

  const methods = useForm({
    resolver: zodResolver(tradingEventsSchema),
    defaultValues: createTradingEventsDefaultValues(),
    mode: "onChange",
  });

  async function onSubmit(data: TradingAlertForm) {
    setSubmitting(true);
    try {
      const resp = await client.api.alertsHp.trading.$post({
        json: {
          alertType: "trading",
          conditions: data.tradingConditions.map((cond) => ({
            aggregation: cond.aggregation,
            period: cond.period,
            value: cond.value,
            conditionOp: cond.op,
          })),
          delivery: {
            email: data.emailEnabled ? data.email! : undefined,
          },
          expiresAt: combineLocalDateAndTime(
            data.expiresAtDate,
            data.expiresAtTime,
          ),
          name: data.alertName,
          scopes: [data.tradingScope],
          triggerMode: data.triggerMode,
        },
      });

      if (!resp.ok) {
        const res = await resp.json();
        tr(`ERROR.${res.errorCode}`);
        return;
      }

      onFinish();
    } catch (e) {
      console.error(e);
      tr("ERROR.GENERAL_UNKNOWN_ERR");
    } finally {
      setSubmitting(false);
    }
  }

  const onNext = async () => {
    const fields = stepFields[stepNum];

    const isValid = await methods.trigger(fields, {
      // focuses first invalid field
      shouldFocus: true,
    });

    if (!isValid) return;

    setStepNum((prev) => prev + 1);
  };

  return (
    <ComposedModal
      open={open}
      onClose={() => (stepNum == 1 ? onReturn() : setStepNum(stepNum - 1))}
    >
      <ModalHeader label="Alerts" title="Trading Events Config" />
      <ModalBody>
        <FormProvider {...methods}>
          <Stack gap={2}>
            {stepNum == 1 && <TradingEventsConfigContent />}
            {stepNum == 2 && <AlertNotificationSettings />}
          </Stack>
        </FormProvider>
      </ModalBody>
      <ModalFooter>
        <Button
          kind="secondary"
          onClick={() =>
            stepNum - 1 <= 0 ? onReturn() : setStepNum(stepNum - 1)
          }
          renderIcon={ArrowLeft}
        >
          Back
        </Button>

        {stepNum == finalStepNum ? (
          <Button
            kind="primary"
            onClick={methods.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            Save
          </Button>
        ) : (
          <Button kind="primary" onClick={onNext} renderIcon={ArrowRight}>
            Next
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
