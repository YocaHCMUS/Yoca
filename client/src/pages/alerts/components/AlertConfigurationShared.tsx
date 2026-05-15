import { Divider } from "@/components/partials/Divider/Divider";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  DatePicker,
  DatePickerInput,
  FormGroup,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TimePicker,
} from "@carbon/react";
import { Controller, useFormContext } from "react-hook-form";
import styles from "../demo.module.scss";
import type { BaseAlertForm } from "../form-schema";

export default function AlertConfigurationShared() {
  const { lang } = useLocalization();
  const {
    control,
    formState: { errors },
  } = useFormContext<BaseAlertForm>();

  const datePickerLocale = lang == "vi" ? "vn" : "en";
  const datePickerFormat = lang == "vi" ? "d/m/Y" : "m/d/Y";

  return (
    <>
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
          <Stack
            gap={1}
            orientation="horizontal"
            className={styles.dateTimeWrap}
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
                    invalid={!!errors.expiresAtDate}
                    invalidText={
                      String(errors.expiresAtDate?.message) || "Incorrect value"
                    }
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
                  invalid={!!errors.expiresAtTime}
                  invalidText={
                    String(errors.expiresAtTime?.message) || "Incorrect format"
                  }
                />
              )}
            />
          </Stack>
        </FormGroup>
      </Stack>
      <Divider />
    </>
  );
}
