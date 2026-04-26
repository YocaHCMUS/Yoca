import { Flex } from "@/components/Flex";
import { Divider } from "@/components/partials/Divider/Divider";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  Checkbox,
  CheckboxGroup,
  FormGroup,
  Stack,
  TextArea,
  TextInput,
} from "@carbon/react";
import { Controller, useFormContext } from "react-hook-form";
import styles from "../demo.module.scss";
import type { AlertFormValues } from "../form-types";

export default function AlertNotificationSettings() {
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
                placeholder="example@email.com"
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
            placeholder="My Alert"
            id="alert-name-input"
            {...register("alertName")}
            invalid={!!errors.alertName}
            invalidText={String(errors.alertName?.message || "")}
          />
          <TextArea
            className={overwriteStyles.filledTextArea}
            labelText="Message (Auto)"
            readOnly
            value={`Notification content will be generated automatically based on selected alert type and conditions.`}
            id="alert-message-textarea"
          />
        </Stack>
      </FormGroup>
    </Stack>
  );
}
