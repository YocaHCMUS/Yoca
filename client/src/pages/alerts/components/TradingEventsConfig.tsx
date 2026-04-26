import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
import {
  Button,
  Dropdown,
  FormGroup,
  IconButton,
  InlineNotification,
  Stack,
  TextInput,
} from "@carbon/react";
import { Add, SubtractAlt } from "@carbon/react/icons";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import styles from "../demo.module.scss";
import type { AlertFormValues } from "../form-types";

const conditionOptions = [
  { id: "gt", text: ">" },
  { id: "gte", text: "≥" },
  { id: "eq", text: "=" },
  { id: "lt", text: "<" },
  { id: "lte", text: "≤" },
] as const;

const periodOptions = [
  { id: "30m", text: "30m" },
  { id: "1h", text: "1h" },
  { id: "6h", text: "6h" },
  { id: "24h", text: "24h" },
] as const;

const aggregationOptions = [
  { id: "volume_usd", text: "Volume (USD)" },
  { id: "trade_count", text: "Trade count" },
] as const;

const directionOptions = [
  { id: "buy", text: "Buy only" },
  { id: "sell", text: "Sell only" },
  { id: "both", text: "Both" },
] as const;

function getConditionOption(
  condition: AlertFormValues["tradingConditions"][number]["condition"],
) {
  return (
    conditionOptions.find((item) => item.id == condition) ?? conditionOptions[0]
  );
}

function getAggregationOption(
  aggregation: AlertFormValues["tradingConditions"][number]["aggregation"],
) {
  return (
    aggregationOptions.find((item) => item.id == aggregation) ??
    aggregationOptions[0]
  );
}

function getDirectionOption(
  direction: AlertFormValues["tradingScope"]["direction"],
) {
  return (
    directionOptions.find((item) => item.id == direction) ?? directionOptions[0]
  );
}

export default function TradingEventsConfig() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<AlertFormValues>();

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
                items={[...directionOptions]}
                itemToString={(item) => item?.text || ""}
                selectedItem={getDirectionOption(field.value)}
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
                          items={[...aggregationOptions]}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={getAggregationOption(field.value)}
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
                          items={[...periodOptions]}
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
                    name={`tradingConditions.${index}.condition`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`trading-condition-op-${row.formId}`}
                          titleText={
                            index == 0 ? "Condition" : `Condition ${index + 1}`
                          }
                          label="Select condition"
                          items={[...conditionOptions]}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={getConditionOption(field.value)}
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
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    period: "1h",
                    aggregation: "volume_usd",
                    condition: "gt",
                    value: "",
                  });
                }}
              >
                Add Condition
              </Button>
            )}
          </Stack>
        </Stack>
      </FormGroup>

      <Divider />
    </Stack>
  );
}
