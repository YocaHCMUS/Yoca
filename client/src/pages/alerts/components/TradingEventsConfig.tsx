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
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextInput,
} from "@carbon/react";
import { ArrowLeft, ArrowRight } from "@carbon/react/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import styles from "../demo.module.scss";
import {
  combineLocalDateAndTime,
  tradingEventTypeOptions,
  tradingEventsSchema,
  type TradingAlertForm,
  type TradingAlertFormInput,
} from "../form-schema";
import AlertConfigurationShared from "./AlertConfigurationShared";
import AlertNotificationSettings from "./AlertNotificationSettings";

const defaultToken = {
  address: "So11111111111111111111111111111111111111112",
  imgUrl: "https://assets.coingecko.com/coins/images/21629/standard/solana.jpg?1696520989",
  name: "Wrapped SOL",
  symbol: "SOL",
};

function createDefaultValues(): TradingAlertFormInput {
  return {
    type: "trading-events",
    triggerMode: "once",
    expiresAtDate: new Date(),
    expiresAtTime: "09:00",
    tradingTarget: { token: defaultToken, walletAddress: "" },
    eventType: "any_trade",
    minSolAmount: "",
    alertName: "Trading event alert",
    emailEnabled: true,
    email: "",
    discordEnabled: false,
  };
}

function TradingEventsConfigContent() {
  const { control, register, formState: { errors } } = useFormContext<TradingAlertFormInput>();
  return <Stack gap={6}>
    <FormGroup legendText="Trading event target">
      <Stack gap={4}>
        <Controller
          name="tradingTarget.token"
          control={control}
          render={({ field }) => <DropdownPanelField
            id="trading-event-token"
            titleText="Token"
            placeholder="Select token"
            initialValue={field.value}
            onValueChange={field.onChange}
            invalid={Boolean(errors.tradingTarget?.token)}
            invalidText={String(errors.tradingTarget?.token?.message ?? "A token is required")}
            renderValue={(token) => <Flex align="center" gap={3} className={styles.selectedTokenValue}><TknImg size={20} src={token.imgUrl} alt={token.symbol} /><span>{token.symbol || token.name || token.address}</span></Flex>}
            renderPanel={({ setValue, closePanel }) => <TokenSearch setValue={setValue} closePanel={closePanel} />}
          />}
        />
        <TextInput
          id="trading-event-wallet"
          labelText="Wallet address (optional)"
          helperText="Only notify for trades involving this wallet. Leave empty to monitor trades involving the token."
          placeholder="Solana wallet address"
          {...register("tradingTarget.walletAddress")}
          invalid={Boolean(errors.tradingTarget?.walletAddress)}
          invalidText={String(errors.tradingTarget?.walletAddress?.message ?? "")}
        />
      </Stack>
    </FormGroup>
    <Divider />
    <FormGroup legendText="Event condition">
      <Stack gap={4}>
        <Controller name="eventType" control={control} render={({ field }) => <Dropdown
          id="trading-event-type"
          titleText="Event type"
          label="Select event type"
          items={tradingEventTypeOptions}
          itemToString={(item) => item?.text ?? ""}
          selectedItem={tradingEventTypeOptions.find((option) => option.id === field.value) ?? tradingEventTypeOptions[0]}
          onChange={({ selectedItem }) => selectedItem && field.onChange(selectedItem.id)}
        />} />
        <TextInput
          id="trading-event-min-sol"
          labelText="Minimum SOL amount (optional)"
          helperText="The largest native SOL or wrapped-SOL leg seen in the webhook payload must meet this amount."
          placeholder="e.g. 10"
          {...register("minSolAmount")}
          invalid={Boolean(errors.minSolAmount)}
          invalidText={String(errors.minSolAmount?.message ?? "")}
        />
        <InlineNotification hideCloseButton lowContrast kind="info" title="Classification:" subtitle="Any trade and swap use enhanced webhook data. Buy/sell are best-effort and are most reliable with a wallet filter." />
      </Stack>
    </FormGroup>
    <AlertConfigurationShared />
  </Stack>;
}

interface TradingEventsConfigProps { onReturn: () => void; onFinish: () => void; open: boolean; }

export function TradingEventsConfig({ onReturn, onFinish, open }: TradingEventsConfigProps) {
  const { tr } = useLocalization();
  const [step, setStep] = useState(1);
  const [isSubmitting, setSubmitting] = useState(false);
  const methods = useForm<TradingAlertFormInput, unknown, TradingAlertForm>({ resolver: zodResolver(tradingEventsSchema), defaultValues: createDefaultValues(), mode: "onChange" });
  const onSubmit = async (data: TradingAlertForm) => {
    setSubmitting(true);
    try {
      const response = await client.api.alertsHp["trading-events"].$post({ json: {
        alertType: "trading",
        name: data.alertName,
        triggerMode: data.triggerMode,
        expiresAt: combineLocalDateAndTime(data.expiresAtDate, data.expiresAtTime),
        target: { tokenAddress: data.tradingTarget.token.address, walletAddress: data.tradingTarget.walletAddress || undefined },
        condition: { eventType: data.eventType, minSolAmount: data.minSolAmount },
        delivery: { email: data.emailEnabled ? data.email : undefined, discord: data.discordEnabled },
      } });
      if (!response.ok) { tr("ERROR.GENERAL_UNKNOWN_ERR"); return; }
      onFinish();
    } catch (error) { console.error(error); tr("ERROR.GENERAL_UNKNOWN_ERR"); }
    finally { setSubmitting(false); }
  };
  const next = async () => {
    const fields = step === 1 ? ["tradingTarget", "eventType", "minSolAmount", "triggerMode", "expiresAtDate", "expiresAtTime"] as const : [];
    if (await methods.trigger(fields)) setStep(2);
  };
  return <ComposedModal open={open} onClose={() => step === 1 ? onReturn() : setStep(1)}>
    <ModalHeader label="Alerts" title="Trading Events Config" />
    <ModalBody><FormProvider {...methods}><Form>{step === 1 ? <TradingEventsConfigContent /> : <AlertNotificationSettings />}</Form></FormProvider></ModalBody>
    <ModalFooter>
      <Button kind="secondary" onClick={() => step === 1 ? onReturn() : setStep(1)} renderIcon={ArrowLeft}>Back</Button>
      {step === 2 ? <Button kind="primary" disabled={isSubmitting} onClick={methods.handleSubmit(onSubmit)}>Save</Button> : <Button kind="primary" onClick={() => void next()} renderIcon={ArrowRight}>Next</Button>}
    </ModalFooter>
  </ComposedModal>;
}
