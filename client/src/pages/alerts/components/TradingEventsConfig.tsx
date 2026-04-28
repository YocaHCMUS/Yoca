import { UserTradeDirection, UserTradingAggregation } from "@/api/alerts";
import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
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
  conditionOptions,
  periodOptions,
  TradingAlertForm,
  tradingEventsSchema,
} from "../form-schema";
import AlertConfigurationShared from "./AlertConfigurationShared";
import AlertNotificationSettings from "./AlertNotificationSettings";

const directionOptions: {
  id: UserTradeDirection;
  text: string;
}[] = [
  {
    id: "both",
    text: "Buy & Sell",
  },
  {
    id: "buy",
    text: "Buy",
  },
  {
    id: "sell",
    text: "Sell",
  },
];

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
      <FormGroup legendText="Scope (Optional)">
        <Stack gap={4}>
          <TextInput
            id="scope-wallet-address"
            labelText="Wallet Address"
            placeholder="Enter wallet address"
            {...register("tradingScope.walletAddress")}
          />
          <TextInput
            id="scope-token-address"
            labelText="Token Address"
            placeholder="Enter token address"
            {...register("tradingScope.tokenAddress")}
          />
          <TextInput
            id="scope-pool-address"
            labelText="Pool Address"
            placeholder="Enter pool address"
            {...register("tradingScope.poolAddress")}
          />
          <TextInput
            id="scope-counterparty-address"
            labelText="Counterparty Address"
            placeholder="Enter counterparty address"
            {...register("tradingScope.counterpartyAddress")}
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
                    invalidText={String(
                      errors.tradingConditions?.[index]?.value?.message || "",
                    )}
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
    expiresAtDate: null,
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
      tokenAddress: "So11111111111111111111111111111111111111112",
      poolAddress: "",
      counterpartyAddress: "",
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
  setOpen: (open: boolean) => void;
}

export function TradingEventsConfig({
  onReturn,
  onFinish,
  open,
  setOpen,
}: TradingEventsConfigProps) {
  const [stepNum, setStepNum] = useState(1);
  const [isSubmitting, setSubmitting] = useState(false);

  const methods = useForm({
    resolver: zodResolver(tradingEventsSchema),
    defaultValues: createTradingEventsDefaultValues(),
    mode: "onChange",
  });

  const handleSubmit = () => {
    setSubmitting(true);
  };

  const handleNext = async () => {
    const fields = stepFields[stepNum];

    const isValid = await methods.trigger(fields, {
      // focuses first invalid field
      shouldFocus: true,
    });

    if (!isValid) return;

    setStepNum((prev) => prev + 1);
  };

  const handleClose = () => {
    setOpen(false);
    onReturn();
  };

  return (
    <ComposedModal open={open} onClose={handleClose}>
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
            stepNum - 1 <= 0 ? handleClose() : setStepNum(stepNum - 1)
          }
          renderIcon={ArrowLeft}
        >
          Back
        </Button>

        {stepNum == finalStepNum ? (
          <Button kind="primary" onClick={handleSubmit} disabled={isSubmitting}>
            Save
          </Button>
        ) : (
          <Button kind="primary" onClick={handleNext} renderIcon={ArrowRight}>
            Next
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
