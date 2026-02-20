import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { UserFollow } from "@carbon/icons-react";
import {
  Button,
  Heading,
  InlineNotification,
  PasswordInput,
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
  const { tr } = useLocalization();
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

  const handleGoogleSuccess = async (credential: string) => {
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

  const handleGoogleError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div className={styles["sign-up-form-container"]}>
      <Heading>{tr("auth.signUp")}</Heading>

      {errorMessage && (
        <InlineNotification
          kind="error"
          title={tr("common.error")}
          subtitle={errorMessage}
          onCloseButtonClick={() => setErrorMessage(null)}
          className={styles["error-notification"]}
          lowContrast
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles["form"]}>
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

        <div className={styles["terms-text"]}>
          {tr("auth.termsPrefix")}{" "}
          <a href="/terms" tabIndex={isSubmitting ? -1 : 0}>
            {tr("auth.termsOfService")}
          </a>{" "}
          {tr("common.and")}{" "}
          <a href="/privacy" tabIndex={isSubmitting ? -1 : 0}>
            {tr("auth.privacyPolicy")}
          </a>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          renderIcon={UserFollow}
        >
          {isSubmitting ? tr("common.loading") : tr("auth.createAccount")}
        </Button>

        <div className={styles["divider"]}>
          <div className={styles["divider-line"]}>
            <div className={styles["divider-border"]}></div>
          </div>
          <div className={styles["divider-text-container"]}>
            <span className={styles["divider-text"]}>{tr("auth.or")}</span>
          </div>
        </div>

        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          disabled={isSubmitting}
        />

        <WalletAuthenButton
          onSuccess={() => {}}
          onError={(err) => setErrorMessage(err.message)}
        />
      </form>
    </div>
  );
}
