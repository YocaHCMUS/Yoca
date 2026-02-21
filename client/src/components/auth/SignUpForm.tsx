import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowRight } from "@carbon/icons-react";
import {
  Button,
  Form,
  Heading,
  Link,
  PasswordInput,
  Stack,
  TextInput,
} from "@carbon/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { GoogleAuthButton } from "./GoogleAuthButton";
import styles from "./SignUpForm.module.scss";
import { WalletAuthenButton } from "./WalletAuthButton";

export function SignUpForm() {
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

  const onGoogleSignInSuccess = async (credential: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await client.api.users.auth.google.$post({
        json: { token: credential },
      });

      if (response.ok) {
        const res = await response.json();
      } else {
        setErrorMessage(tr("auth.googleAuthFailed"));
      }
    } catch (error) {
      setErrorMessage(tr("auth.googleAuthFailed"));
      console.error("Google sign up error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleSignInError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div>
      <Heading>{tr("auth.signUp")}</Heading>

      <Form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap={7}>
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
            labelText={tr("auth.username")}
            placeholder={tr("auth.username")}
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

          <div style={{ textAlign: "center" }}>
            {tr("auth.termsAndPrivacy", {
              $terms: <Link href="/terms">{tr("auth.termsOfService")} </Link>,
              $privacy: <Link href="/privacy">{tr("auth.privacyPolicy")}</Link>,
            })}
          </div>

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
            {isSubmitting ? tr("common.loading") : tr("auth.createAccount")}
          </Button>
        </Stack>
      </Form>

      <div className={styles["divider"]}>
        <div className={styles["divider-line"]}>
          <div className={styles["divider-border"]}></div>
        </div>
        <div className={styles["divider-text-container"]}>
          <span className={styles["divider-text"]}>{tr("auth.or")}</span>
        </div>
      </div>

      <GoogleAuthButton
        onSuccess={onGoogleSignInSuccess}
        onError={onGoogleSignInError}
        disabled={isSubmitting}
      />

      <WalletAuthenButton
        onSuccess={() => {}}
        onError={(err) => setErrorMessage(err.message)}
      />
    </div>
  );
}
