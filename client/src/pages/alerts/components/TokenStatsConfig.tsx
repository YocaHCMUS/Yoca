import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
import { TknImg } from "@/components/TknImg";
import type { SelectedTokenValue } from "@/components/TokenSearch/TokenSearch";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
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

const metricOptions = [
  {
    id: "price_percentage",
    text: "Price change %",
    helper: "Percent change over the selected period",
  },
  { id: "price_usd", text: "Price", helper: "Current token price in USD" },
] as const;

const periodOptions = [
  { id: "30m", text: "30m" },
  { id: "1h", text: "1h" },
  { id: "6h", text: "6h" },
  { id: "24h", text: "24h" },
] as const;

function getConditionOption(
  condition: AlertFormValues["tokenConditions"][number]["condition"],
) {
  return (
    conditionOptions.find((item) => item.id == condition) ?? conditionOptions[0]
  );
}

function getMetricOption(
  metric: AlertFormValues["tokenConditions"][number]["metric"],
) {
  return metricOptions.find((item) => item.id == metric) ?? metricOptions[0];
}

export default function TokenStatsConfig() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<AlertFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: "tokenConditions",
    control,
    keyName: "formId",
  });

  return (
    <Stack gap={7}>
      <FormGroup legendText="Token">
        <Stack gap={4}>
          <Dropdown
            id="token-type-select"
            titleText="Token Type"
            label="Specific Token"
            items={[
              { id: "specific", text: "Specific Token" },
              { id: "portfolio", text: "From My Portfolio", disabled: true },
              { id: "watchlist", text: "From My Watchlist", disabled: true },
            ]}
            itemToString={(item) => item?.text || ""}
            initialSelectedItem={{ id: "specific", text: "Specific Token" }}
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
                    name={`tokenConditions.${index}.metric`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "16rem" }}>
                        <Dropdown
                          id={`token-condition-metric-${row.formId}`}
                          titleText={
                            index == 0 ? "Metric" : `Metric ${index + 1}`
                          }
                          label="Select metric"
                          items={[...metricOptions]}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={getMetricOption(field.value)}
                          onChange={({ selectedItem }) => {
                            if (!selectedItem) return;
                            field.onChange(selectedItem.id);
                          }}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name={`tokenConditions.${index}.period`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`token-condition-period-${row.formId}`}
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
                    name={`tokenConditions.${index}.condition`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`token-condition-op-${row.formId}`}
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
                    id={`token-condition-value-${row.formId}`}
                    labelText="Value"
                    placeholder="10"
                    {...register(`tokenConditions.${index}.value`)}
                    invalid={!!errors.tokenConditions?.[index]?.value}
                    invalidText={String(
                      errors.tokenConditions?.[index]?.value?.message || "",
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
                    metric: "price_percentage",
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
