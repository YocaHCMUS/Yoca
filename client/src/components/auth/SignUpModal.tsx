import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowRight } from "@carbon/icons-react";
import {
  Button,
  ComposedModal,
  Form,
  Link,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PasswordInput,
  Stack,
  TextInput,
} from "@carbon/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Divider } from "../partials/Divider/Divider";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { WalletAuthButton } from "./WalletAuthButton";

type SignUpModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SignUpModal({ open, onClose }: SignUpModalProps) {
  const { tr, fmt } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formSchema = z
    .object({
      email: z.email(tr("validation.invalidEmail")),
      displayName: z.string().min(1).optional(),
      password: z
        .string()
        .min(8, tr("validation.passwordTooShort", { min: 8 })),
      retypePassword: z.string(),
    })
    .refine((data) => data.password == data.retypePassword, {
      message: tr("validation.passwordsDoNotMatch"),
      path: ["retypePassword"],
    });

  type FormSchema = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: FormSchema) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const resp = await client.api.users.auth.password.register.$post({
        json: {
          email: data.email,
          displayName: data.displayName,
          password: data.password,
        },
      });

      if (resp.ok) {
        const res = await resp.json();
      } else {
        setErrorMessage(tr("validation.registrationFailed"));
      }
    } catch (error) {
      setErrorMessage(tr("validation.networkError"));
      console.error("Sign up error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComposedModal open={open} onClose={onClose}>
      <ModalHeader label={tr("nav.account")} title={tr("auth.signUp")} />
      <ModalBody hasScrollingContent>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap={6}>
            <TextInput
              id="email"
              labelText={tr("auth.email")}
              placeholder={tr("auth.email")}
              type="email"
              {...register("email")}
              invalid={!!errors.email}
              invalidText={errors.email?.message || ""}
              disabled={isSubmitting}
            />

            <TextInput
              id="displayName"
              labelText={tr("auth.displayName")}
              placeholder={tr("auth.displayName")}
              {...register("displayName")}
              invalid={!!errors.displayName}
              invalidText={errors.displayName?.message || ""}
              disabled={isSubmitting}
            />

            <PasswordInput
              id="password"
              labelText={tr("auth.password")}
              placeholder={tr("auth.password")}
              {...register("password")}
              invalid={!!errors.password}
              invalidText={errors.password?.message || ""}
              disabled={isSubmitting}
            />

            <PasswordInput
              id="retypePassword"
              labelText={tr("auth.confirmPassword")}
              placeholder={tr("auth.confirmPassword")}
              {...register("retypePassword")}
              invalid={!!errors.retypePassword}
              invalidText={errors.retypePassword?.message || ""}
              disabled={isSubmitting}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              renderIcon={ArrowRight}
              style={{
                inlineSize: "100%",
                maxInlineSize: "100%",
              }}
            >
              {isSubmitting
                ? tr("common.loading")
                : tr("auth.continueWithPassword")}
            </Button>
          </Stack>
        </Form>
        <Divider text={tr("common.or")} />
        <Stack gap={4} style={{ marginBottom: "2rem" }}>
          <GoogleAuthButton
            onSuccess={() => {}}
            onError={(msg) => {}}
            disabled={isSubmitting}
          />

          <WalletAuthButton
            disabled={isSubmitting}
            onSuccess={() => {}}
            onError={(msg) => setErrorMessage(msg)}
          />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            whiteSpace: "pre-wrap",
          }}
        >
          {tr("auth.termsAndPrivacy", {
            $terms: <Link href="/terms">{tr("auth.termsOfService")} </Link>,
            $privacy: <Link href="/privacy">{tr("auth.privacyPolicy")}</Link>,
          })}
        </div>
      </ModalFooter>
    </ComposedModal>
  );
}
