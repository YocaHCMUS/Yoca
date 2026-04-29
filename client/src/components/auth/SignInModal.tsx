import client from "@/api/main";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowRight } from "@carbon/icons-react";
import {
  Button,
  ComposedModal,
  Form,
  InlineNotification,
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
import { useNavigate } from "react-router";
import z from "zod";
import { ModalStateManager } from "../ModelStateManager";
import { Divider } from "../partials/Divider/Divider";
import styles from "./AuthModal.module.scss";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { SignUpModal } from "./SignUpModal";
import { WalletAuthButton } from "./WalletAuthButton";

type SignInModalProps = {
  open: boolean;
  onClose: () => void;
  redirectUrl?: string;
};

export function SignInModal({
  open,
  onClose,
  redirectUrl,
}: SignInModalProps) {
  const { tr, fmt } = useLocalization();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const resolvedRedirectUrl =
    typeof redirectUrl == "string" && redirectUrl.length > 0 ? redirectUrl : "/";

  const formSchema = z.object({
    email: z.email(tr("validation.invalidEmail")),
    password: z.string().min(8, tr("validation.passwordTooShort", { min: 8 })),
  });

  type FormSchema = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
  });

  function close() {
    setErrMsg(null);
    clearErrors();
    onClose();
  }

  async function onSubmit(data: FormSchema) {
    setIsSubmitting(true);
    setErrMsg(null);

    try {
      const resp = await client.api.users.auth.password.login.$post({
        json: {
          email: data.email,
          password: data.password,
        },
      });

      if (resp.status == 200) {
        await refreshUser();
        close();
        navigate(resolvedRedirectUrl, { replace: true });
      } else if (resp.status == 401 || resp.status == 422) {
        const res = await resp.json();
        const errCode = res.errorCode;
        setErrMsg(tr(`ERROR.${errCode}`));
      } else {
        setErrMsg(tr("ERROR.GENERAL_UNKNOWN_ERR"));
      }
    } catch (error) {
      console.error(error);
      setErrMsg(tr("ERROR.NETWORK_ERR"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function onGoogleSignInSuccess(_userId: string) {
    refreshUser();
    close();
    navigate(resolvedRedirectUrl, { replace: true });
  }

  function onGoogleSignInError(_error: string) {
    setErrMsg(tr("ERROR.GOOGLE_VERIFICATION_FAILED"));
  }

  return (
    <ComposedModal className={styles.modalLayer} open={open} onClose={close}>
      <ModalHeader label={tr("nav.account")} title={tr("auth.signIn")} />
      <ModalBody className={"bodyne"} hasScrollingContent>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap={6}>
            <TextInput
              id="email"
              labelText={`${tr("auth.email")}*`}
              placeholder={tr("auth.email")}
              invalid={!!errors.email}
              invalidText={errors.email?.message || ""}
              {...register("email")}
            />

            <PasswordInput
              id="password"
              labelText={`${tr("auth.password")}*`}
              placeholder={tr("auth.password")}
              invalid={!!errors.password}
              invalidText={errors.password?.message || ""}
              disabled={isSubmitting}
              {...register("password")}
            />

            <Link>{tr("auth.forgotPassword")}</Link>

            {errMsg && (
              <InlineNotification
                kind="error"
                title="Error"
                lowContrast
                subtitle={errMsg}
              />
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              renderIcon={ArrowRight}
              style={{
                inlineSize: "100%",
                maxInlineSize: "100%",
              }}
            >
              {tr("auth.continueWithPassword")}
            </Button>
          </Stack>
        </Form>
        <Divider text={tr("common.or")} />
        <Stack gap={4} style={{ marginBottom: "2rem" }}>
          <GoogleAuthButton
            disabled={isSubmitting}
            onSuccess={onGoogleSignInSuccess}
            onError={onGoogleSignInError}
          />

          <WalletAuthButton
            disabled={isSubmitting}
            onSuccess={async (userId) => {
              await refreshUser();
              close();
              navigate(resolvedRedirectUrl, { replace: true });
            }}
            onError={(err) => setErrMsg(err)}
          />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ModalStateManager
          renderLauncher={({ setOpen }) => (
            <span className={styles.bottomInfo}>
              {tr("auth.signUpSuggestion", {
                $createAccount: (
                  <Link
                    onClick={() => {
                      setOpen(true);
                      onClose();
                    }}
                  >
                    {tr("auth.createAccount")}
                  </Link>
                ),
              })}
            </span>
          )}
        >
          {({ open, setOpen }) => (
            <SignUpModal open={open} onClose={() => setOpen(false)} />
          )}
        </ModalStateManager>
      </ModalFooter>
    </ComposedModal>
  );
}
