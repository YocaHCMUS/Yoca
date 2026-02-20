import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Login } from "@carbon/icons-react";
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
import styles from "./SignInForm.module.scss";
import { WalletAuthenButton } from "./WalletAuthButton";

export function SignInForm() {
  const { tr, fmt } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formSchema = z.object({
    email: z.email(tr("validation.invalidEmail")),
    password: z
      .string()
      .min(8, tr("validation.passwordTooShort", { min: `${1}` })),
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
      const authData = {
        email: data.email,
        password: data.password,
      };

      const resp = await client.api.users.auth.password.login.$post({
        json: {
          email: data.email,
          password: data.password,
        },
      });

      if (resp.ok) {
        const res = await resp.json();
        // redirect
      } else {
        setErrorMessage(tr("validation.invalidCredentials"));
      }
    } catch (error) {
      setErrorMessage(tr("validation.networkError"));
      console.error("Sign in error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleSignInSuccess = async () => {};

  const onGoogleSignInError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div className={styles["sign-in-form-container"]}>
      <Heading>Sign In</Heading>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap={7}>
          <TextInput
            id="email"
            labelText="Email*"
            placeholder="Email"
            invalid={!!errors.email}
            invalidText={errors.email?.message || ""}
            {...register("email")}
          />

          <PasswordInput
            id="password"
            labelText={"Password*"}
            placeholder={tr("auth.password")}
            invalid={!!errors.password}
            invalidText={errors.password?.message || ""}
            disabled={isSubmitting}
            {...register("password")}
          />

          <Link>Forgot password?</Link>

          <Button
            type="submit"
            size="lg"
            renderIcon={Login}
            style={{
              inlineSize: "100%",
              maxInlineSize: "100%",
            }}
          >
            Continue
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
        disabled={isSubmitting}
        onSuccess={onGoogleSignInSuccess}
        onError={onGoogleSignInError}
      />

      <WalletAuthenButton
        onSuccess={() => {}}
        onError={(err) => setErrorMessage(err.message)}
      />
    </div>
  );
}

export default SignInForm;
