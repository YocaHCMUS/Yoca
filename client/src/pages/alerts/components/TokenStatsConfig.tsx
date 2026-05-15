import { UserAlertTokenMetric } from "@/api/alerts";
import client from "@/api/main";
import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
import { TknImg } from "@/components/TknImg";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Button,
  ComposedModal,
  Dropdown,
  Form,
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
  periodOptions,
  tokenStatsSchema,
  type TokenAlertForm,
  type TokenAlertMetric,
} from "../form-schema";
import AlertConfigurationShared from "./AlertConfigurationShared";
import AlertNotificationSettings from "./AlertNotificationSettings";

const metricOptions: {
  id: UserAlertTokenMetric;
  text: string;
  helper: string;
}[] = [
  {
    id: "price_percentage",
    text: "Price change %",
    helper: "Percent change over the selected period",
  },
  { id: "price_usd", text: "Price", helper: "Current token price in USD" },
];

function getMetricOption(metric: TokenAlertMetric) {
  return metricOptions.find((item) => item.id == metric) ?? metricOptions[0];
}

function createTokenStatsDefaultValues(): TokenAlertForm {
  return {
    type: "token-stats",
    token: {
      address: "So11111111111111111111111111111111111111112",
      imgUrl:
        "https://assets.coingecko.com/coins/images/21629/standard/solana.jpg?1696520989",
      name: "Wrapped SOL",
      symbol: "SOL",
    },
    triggerMode: "once",
    expiresAtDate: new Date(),
    expiresAtTime: "09:00",
    tokenConditions: [
      {
        period: "1h",
        metric: "price_percentage",
        op: "lt",
        value: -50,
      },
    ],
    alertName: "Token Stats Notification 1",
    // should automatically choose the signed in email if it was the case
    emailEnabled: true,
    email: "",
  };
}

const finalStepNum = 2;

interface TokenStatsConfigProps {
  onReturn: () => void;
  onFinish: () => void;
  open: boolean;
}

const stepFields: Record<number, (keyof TokenAlertForm)[]> = {
  1: [
    "token",
    "tokenConditions",
    "triggerMode",
    "expiresAtDate",
    "expiresAtTime",
  ],
  2: ["alertName", "email", "emailEnabled"],
};

export function TokenStatsConfigContent() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<TokenAlertForm>();

  const { fields, append, remove } = useFieldArray({
    name: "tokenConditions",
    control,
    keyName: "formId",
  });

  return (
    <Stack gap={2}>
      <FormGroup legendText="Token">
        <Stack gap={4}>
          <Dropdown
            id="token-type-select"
            titleText="Token Type"
            label="Specific Token"
            items={[
              { id: "specific", text: "Specific Token" },
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
                          items={metricOptions}
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
                          items={periodOptions}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={{
                            id: field.value,
                            text: field.value,
                          }}
                          onChange={({ selectedItem }) => {
                            if (!selectedItem) return;
                            field.onChange(selectedItem.id);
                          }}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name={`tokenConditions.${index}.op`}
                    control={control}
                    render={({ field }) => (
                      <div style={{ inlineSize: "6rem" }}>
                        <Dropdown
                          id={`token-condition-op-${row.formId}`}
                          titleText={
                            index == 0 ? "Condition" : `Condition ${index + 1}`
                          }
                          label="Select condition"
                          items={conditionOptions}
                          itemToString={(item) => item?.text || ""}
                          selectedItem={
                            conditionOptions.find(
                              (item) => item.id == field.value,
                            ) ?? conditionOptions[0]
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

            {fields.length < 3 && (
              <Button
                kind="primary"
                renderIcon={Add}
                onClick={() => {
                  append({
                    period: "1h",
                    metric: "price_percentage",
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

export default function TokenStatsConfig({
  onReturn,
  onFinish,
  open,
}: TokenStatsConfigProps) {
  const { tr } = useLocalization();

  const methods = useForm({
    resolver: zodResolver(tokenStatsSchema),
    mode: "onChange",
    defaultValues: createTokenStatsDefaultValues(),
  });
  const [stepNum, setStepNum] = useState(1);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(data: TokenAlertForm) {
    setSubmitting(true);
    try {
      const resp = await client.api.alertsRoute.tokens.$post({
        json: {
          alertType: "token",
          conditions: data.tokenConditions.map((cond) => ({
            value: cond.value,
            conditionOp: cond.op,
            metric: cond.metric,
            period: cond.period,
          })),
          name: data.alertName,
          tokenTarget: { tokenAddress: data.token.address },
          triggerMode: data.triggerMode,
          delivery: {
            email: data.emailEnabled ? data.email : undefined,
          },
          expiresAt: combineLocalDateAndTime(
            data.expiresAtDate,
            data.expiresAtTime,
          ),
        },
      });

      if (!resp.ok) {
        const res = await resp.json();
        tr(`ERROR.${res.errorCode}`);
        return;
      }

      onFinish();
    } catch (e) {
      console.log(e);
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
      <ModalHeader label="Alerts" title="Token Stats Config" />
      <ModalBody>
        <FormProvider {...methods}>
          <Form>
            {stepNum == 1 && <TokenStatsConfigContent />}
            {stepNum == 2 && <AlertNotificationSettings />}
          </Form>
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
            disabled={isSubmitting}
            onClick={methods.handleSubmit(onSubmit)}
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
