import client from "@/api/main";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router";
import z from "zod";
import styles from "./AuthModal.module.scss";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { WalletAuthButton } from "./WalletAuthButton";

type ForgotPasswordStep = "auth" | "email" | "reset" | "success";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  redirectUrl?: string;
  initialMode?: "login" | "register";
};

// Component xử lý chính bao gồm cả Login & Register 
export function AuthModalBase({
  open,
  onClose,
  redirectUrl,
  initialMode = "login",
}: AuthModalProps) {
  const { tr } = useLocalization();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useUserTheme();
  const isLight = theme === "light";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>("auth");
  const [forgotInfoMsg, setForgotInfoMsg] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  
  // Quản lý trạng thái Animation Slide (false = Login, true = Register)
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === "register");

  useEffect(() => {
    setIsRegisterMode(initialMode === "register");
  }, [initialMode, open]);

  // Sử dụng trang hiện tại làm mặc định thay vì "/" (landing page)
  const resolvedRedirectUrl = typeof redirectUrl === "string" && redirectUrl.length > 0 ? redirectUrl : location.pathname;

  // ====== SCHEMA & LOGIC LOGIN ======
  const loginSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });
  type LoginSchema = z.infer<typeof loginSchema>;
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    clearErrors: clearLoginErrors,
    getValues: getLoginValues,
    formState: { errors: loginErrors },
  } = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) });

  // ====== SCHEMA & LOGIC REGISTER ======
  const registerSchema = z
    .object({
      email: z.email("Invalid email address"),
      displayName: z.string().min(1).optional(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      retypePassword: z.string(),
    })
    .refine((data) => data.password === data.retypePassword, {
      message: "Passwords do not match",
      path: ["retypePassword"],
    });
  type RegisterSchema = z.infer<typeof registerSchema>;
  const {
    register: registerSignup,
    handleSubmit: handleRegisterSubmit,
    clearErrors: clearRegisterErrors,
    formState: { errors: registerErrors },
  } = useForm<RegisterSchema>({ resolver: zodResolver(registerSchema) });

  // ====== SCHEMA & LOGIC FORGOT PASSWORD ======
  const strongPasswordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number");

  const forgotEmailSchema = z.object({
    email: z.email("Invalid email address"),
  });
  type ForgotEmailSchema = z.infer<typeof forgotEmailSchema>;
  const {
    register: registerForgotEmail,
    handleSubmit: handleForgotEmailSubmit,
    clearErrors: clearForgotEmailErrors,
    setValue: setForgotEmailField,
    formState: { errors: forgotEmailErrors },
  } = useForm<ForgotEmailSchema>({ resolver: zodResolver(forgotEmailSchema) });

  const resetPasswordSchema = z
    .object({
      email: z.email("Invalid email address"),
      code: z.string().regex(/^\d{6}$/, "Reset code must be 6 digits"),
      newPassword: strongPasswordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
  const {
    register: registerResetPassword,
    handleSubmit: handleResetPasswordSubmit,
    clearErrors: clearResetPasswordErrors,
    setValue: setResetPasswordField,
    getValues: getResetPasswordValues,
    formState: { errors: resetPasswordErrors },
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });


  // ====== HANDLERS ======
  function handleClose() {
    setErrMsg(null);
    setForgotInfoMsg(null);
    setForgotStep("auth");
    clearLoginErrors();
    clearRegisterErrors();
    clearForgotEmailErrors();
    clearResetPasswordErrors();
    onClose();
  }

  function toggleMode() {
    setIsRegisterMode((prev) => !prev);
    setErrMsg(null);
    setForgotInfoMsg(null);
    setForgotStep("auth");
  }

  function openForgotPassword(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const currentEmail = getLoginValues("email") || "";
    setErrMsg(null);
    setForgotInfoMsg(null);
    setForgotStep("email");
    setForgotEmail(currentEmail);
    setForgotEmailField("email", currentEmail);
  }

  function backToSignIn() {
    setErrMsg(null);
    setForgotInfoMsg(null);
    setForgotStep("auth");
  }

  async function sendPasswordResetCode(email: string, stayOnReset = false) {
    setIsSubmitting(true);
    setErrMsg(null);
    setForgotInfoMsg(null);
    try {
      const resp = await client.api.auth["forgot-password"].$post({
        json: { email },
      });

      if (resp.status === 200) {
        const data = await resp.json();
        setForgotEmail(email);
        setResetPasswordField("email", email);
        setForgotInfoMsg(data.message);
        if (!stayOnReset) {
          setForgotStep("reset");
        }
      } else if (resp.status === 422) {
        const res = await resp.json();
        setErrMsg(tr(`ERROR.${res.errorCode}`));
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

  async function onForgotEmailSubmit(data: ForgotEmailSchema) {
    await sendPasswordResetCode(data.email);
  }

  async function onResendCode() {
    const email = getResetPasswordValues("email") || forgotEmail;
    const parsed = forgotEmailSchema.safeParse({ email });
    if (!parsed.success) {
      setErrMsg("Enter a valid email address.");
      return;
    }
    await sendPasswordResetCode(parsed.data.email, true);
  }

  async function onResetPassword(data: ResetPasswordSchema) {
    setIsSubmitting(true);
    setErrMsg(null);
    setForgotInfoMsg(null);
    try {
      const resp = await client.api.auth["reset-password"].$post({
        json: {
          email: data.email,
          code: data.code,
          newPassword: data.newPassword,
        },
      });

      if (resp.status === 200) {
        setForgotStep("success");
      } else if (
        resp.status === 400 ||
        resp.status === 422 ||
        resp.status === 429
      ) {
        const res = await resp.json();
        setErrMsg(tr(`ERROR.${res.errorCode}`));
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

  async function onLogin(data: LoginSchema) {
    setIsSubmitting(true);
    setErrMsg(null);
    try {
      const resp = await client.api.users.auth.password.login.$post({
        json: { email: data.email, password: data.password },
      });

      if (resp.status === 200) {
        await refreshUser();
        handleClose();
        navigate(resolvedRedirectUrl, { replace: true });
      } else if (resp.status === 401 || resp.status === 422) {
        const res = await resp.json();
        setErrMsg(tr(`ERROR.${res.errorCode}`));
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

  async function onSignup(data: RegisterSchema) {
    setIsSubmitting(true);
    setErrMsg(null);
    try {
      const resp = await client.api.users.auth.password.register.$post({
        json: { email: data.email, displayName: data.displayName, password: data.password },
      });

      if (resp.status === 201) {
        await refreshUser();
        handleClose();
        navigate(resolvedRedirectUrl, { replace: true });
      } else if (resp.status === 400 || resp.status === 422) {
        const res = await resp.json();
        setErrMsg(tr(`ERROR.${res.errorCode}`));
      } else if (resp.status === 500) {
        setErrMsg(tr("ERROR.INTERNAL_SERVER_ERR"));
      } else {
        setErrMsg(tr("ERROR.GENERAL_UNKNOWN_ERR"));
      }
    } catch (err) {
      setErrMsg(tr("ERROR.NETWORK_ERR"));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  if (forgotStep !== "auth") {
    return (
      <div className={`${styles.overlay} ${isLight ? styles.lightOverlay : ""}`} onClick={handleClose}>
        <div
          className={`${styles.container} ${styles.resetContainer} ${isLight ? styles.lightContainer : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`${styles.formBox} ${styles.resetFormBox} ${isLight ? styles.lightFormBox : ""}`}>
            {forgotStep === "email" && (
              <form onSubmit={handleForgotEmailSubmit(onForgotEmailSubmit)}>
                <h1>Reset password</h1>
                <p className={styles.formDescription}>Enter your email and we will send a 6-digit reset code.</p>
                {errMsg && <p className={`${styles.globalError} ${isLight ? styles.lightError : ""}`}>{errMsg}</p>}
                {forgotInfoMsg && <p className={styles.successText}>{forgotInfoMsg}</p>}

                <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
                  <input className={isLight ? styles.lightInput : undefined} type="email" placeholder={tr("auth.email")} disabled={isSubmitting} {...registerForgotEmail("email")} />
                  <i className={`bx bxs-envelope ${isLight ? styles.lightIcon : ""}`}></i>
                </div>
                {forgotEmailErrors.email && <span className={styles.errorText}>{forgotEmailErrors.email.message}</span>}

                <button type="submit" className={`${styles.btn} ${isLight ? styles.lightBtn : ""}`} disabled={isSubmitting}>
                  {isSubmitting ? tr("common.loading") : "Send code"}
                </button>
                <button type="button" className={`${styles.secondaryBtn} ${isLight ? styles.lightSecondaryBtn : ""}`} onClick={backToSignIn} disabled={isSubmitting}>
                  Back to sign in
                </button>
              </form>
            )}

            {forgotStep === "reset" && (
              <form onSubmit={handleResetPasswordSubmit(onResetPassword)}>
                <h1>Enter reset code</h1>
                {errMsg && <p className={`${styles.globalError} ${isLight ? styles.lightError : ""}`}>{errMsg}</p>}
                {forgotInfoMsg && <p className={styles.successText}>{forgotInfoMsg}</p>}

                <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
                  <input className={isLight ? styles.lightInput : undefined} type="email" placeholder={tr("auth.email")} disabled={isSubmitting} {...registerResetPassword("email")} />
                  <i className={`bx bxs-envelope ${isLight ? styles.lightIcon : ""}`}></i>
                </div>
                {resetPasswordErrors.email && <span className={styles.errorText}>{resetPasswordErrors.email.message}</span>}

                <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
                  <input className={isLight ? styles.lightInput : undefined} type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" disabled={isSubmitting} {...registerResetPassword("code")} />
                  <i className={`bx bxs-key ${isLight ? styles.lightIcon : ""}`}></i>
                </div>
                {resetPasswordErrors.code && <span className={styles.errorText}>{resetPasswordErrors.code.message}</span>}

                <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
                  <input className={isLight ? styles.lightInput : undefined} type="password" placeholder="New password" disabled={isSubmitting} {...registerResetPassword("newPassword")} />
                  <i className={`bx bxs-lock-alt ${isLight ? styles.lightIcon : ""}`}></i>
                </div>
                {resetPasswordErrors.newPassword && <span className={styles.errorText}>{resetPasswordErrors.newPassword.message}</span>}

                <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
                  <input className={isLight ? styles.lightInput : undefined} type="password" placeholder="Confirm new password" disabled={isSubmitting} {...registerResetPassword("confirmPassword")} />
                  <i className={`bx bxs-lock-alt ${isLight ? styles.lightIcon : ""}`}></i>
                </div>
                {resetPasswordErrors.confirmPassword && <span className={styles.errorText}>{resetPasswordErrors.confirmPassword.message}</span>}

                <button type="submit" className={`${styles.btn} ${isLight ? styles.lightBtn : ""}`} disabled={isSubmitting}>
                  {isSubmitting ? tr("common.loading") : "Reset password"}
                </button>
                <div className={styles.buttonRow}>
                  <button type="button" className={`${styles.secondaryBtn} ${isLight ? styles.lightSecondaryBtn : ""}`} onClick={onResendCode} disabled={isSubmitting}>
                    Resend code
                  </button>
                  <button type="button" className={`${styles.secondaryBtn} ${isLight ? styles.lightSecondaryBtn : ""}`} onClick={backToSignIn} disabled={isSubmitting}>
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {forgotStep === "success" && (
              <div className={styles.successPanel}>
                <h1>Password updated</h1>
                <p className={styles.formDescription}>You can now sign in with your new password.</p>
                <button type="button" className={`${styles.btn} ${isLight ? styles.lightBtn : ""}`} onClick={backToSignIn}>
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.overlay} ${isLight ? styles.lightOverlay : ""}`} onClick={handleClose}>
      <div 
        className={`${styles.container} ${isLight ? styles.lightContainer : ""} ${isRegisterMode ? styles.active : ""}`} 
        onClick={(e) => e.stopPropagation()} /* Chặn click ra ngoài để không tự tắt modal */
      >
        
        {/* ========= LOGIN FORM ========= */}
        <div className={`${styles.formBox} ${styles.login} ${isLight ? styles.lightFormBox : ""}`}>
          <form onSubmit={handleLoginSubmit(onLogin)}>
            <h1>{tr("auth.signIn")}</h1>
            {errMsg && !isRegisterMode && <p className={`${styles.globalError} ${isLight ? styles.lightError : ""}`}>{errMsg}</p>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="email" placeholder={tr("auth.email")} disabled={isSubmitting} {...registerLogin("email")} />
              <i className={`bx bxs-envelope ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {loginErrors.email && <span className={styles.errorText}>{loginErrors.email.message}</span>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="password" placeholder={tr("auth.password")} disabled={isSubmitting} {...registerLogin("password")} />
              <i className={`bx bxs-lock-alt ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {loginErrors.password && <span className={styles.errorText}>{loginErrors.password.message}</span>}

            <div className={`${styles.forgotLink} ${isLight ? styles.lightForgotLink : ""}`}>
              <a href="#" onClick={openForgotPassword}>{tr("auth.forgotPassword")}</a>
            </div>

            <button type="submit" className={`${styles.btn} ${isLight ? styles.lightBtn : ""}`} disabled={isSubmitting}>
              {isSubmitting ? tr("common.loading") : tr("auth.signIn")}
            </button>

            <p style={{ marginTop: "15px" }}>{tr("common.or")}</p>
            <div className={`${styles.socialIcons} ${isLight ? styles.lightSocialIcons : ""}`}>
              <GoogleAuthButton
                disabled={isSubmitting}
                onSuccess={async () => { await refreshUser(); handleClose(); navigate(resolvedRedirectUrl, { replace: true }); }}
                onError={() => setErrMsg(tr("ERROR.GOOGLE_VERIFICATION_FAILED"))}
              />
              <WalletAuthButton
                disabled={isSubmitting}
                onSuccess={async () => { await refreshUser(); handleClose(); navigate(resolvedRedirectUrl, { replace: true }); }}
                onError={(err) => setErrMsg(err)}
              />
            </div>
          </form>
        </div>

        {/* ========= REGISTER FORM ========= */}
        <div className={`${styles.formBox} ${styles.register} ${isLight ? styles.lightFormBox : ""}`}>
          <form onSubmit={handleRegisterSubmit(onSignup)}>
            <h1>{tr("auth.signUp")}</h1>
            {errMsg && isRegisterMode && <p className={`${styles.globalError} ${isLight ? styles.lightError : ""}`}>{errMsg}</p>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="email" placeholder={tr("auth.email")} disabled={isSubmitting} {...registerSignup("email")} />
              <i className={`bx bxs-envelope ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {registerErrors.email && <span className={styles.errorText}>{registerErrors.email.message}</span>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="text" placeholder={tr("auth.displayName")} disabled={isSubmitting} {...registerSignup("displayName")} />
              <i className={`bx bxs-user ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {registerErrors.displayName && <span className={styles.errorText}>{registerErrors.displayName.message}</span>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="password" placeholder={tr("auth.password")} disabled={isSubmitting} {...registerSignup("password")} />
              <i className={`bx bxs-lock-alt ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {registerErrors.password && <span className={styles.errorText}>{registerErrors.password.message}</span>}

            <div className={`${styles.inputBox} ${isLight ? styles.lightInputBox : ""}`}>
              <input className={isLight ? styles.lightInput : undefined} type="password" placeholder={tr("auth.confirmPassword")} disabled={isSubmitting} {...registerSignup("retypePassword")} />
              <i className={`bx bxs-lock-alt ${isLight ? styles.lightIcon : ""}`}></i>
            </div>
            {registerErrors.retypePassword && <span className={styles.errorText}>{registerErrors.retypePassword.message}</span>}

            <button type="submit" className={`${styles.btn} ${isLight ? styles.lightBtn : ""}`} disabled={isSubmitting}>
              {isSubmitting ? tr("common.loading") : tr("auth.signUp")}
            </button>

            <p style={{ marginTop: "15px" }}>{tr("common.or")}</p>
            <div className={`${styles.socialIcons} ${isLight ? styles.lightSocialIcons : ""}`}>
              <GoogleAuthButton
                disabled={isSubmitting}
                onSuccess={async () => { await refreshUser(); handleClose(); navigate(resolvedRedirectUrl, { replace: true }); }}
                onError={() => setErrMsg(tr("ERROR.GOOGLE_VERIFICATION_FAILED"))}
              />
              <WalletAuthButton
                disabled={isSubmitting}
                onSuccess={async () => { await refreshUser(); handleClose(); navigate(resolvedRedirectUrl, { replace: true }); }}
                onError={(err) => setErrMsg(err)}
              />
            </div>
          </form>
        </div>

        {/* ========= ANIMATION TOGGLE BOX ========= */}
        <div className={`${styles.toggleBox} ${isLight ? styles.lightToggleBox : ""}`}>
          <div className={`${styles.togglePanel} ${styles.toggleLeft} ${isLight ? styles.lightTogglePanel : ""}`}>
            <h1><b>Welcome!</b></h1>
            <p>Don't have an account?</p>
            <button className={`${styles.btn} ${styles.registerBtn} ${isLight ? styles.lightBtn : ""}`} onClick={toggleMode}>
              Register
            </button>
          </div>

          <div className={`${styles.togglePanel} ${styles.toggleRight} ${isLight ? styles.lightTogglePanel : ""}`}>
            <h1><b>Welcome to Yoca!</b></h1>
            <p>Already have an account?</p>
            <button className={`${styles.btn} ${styles.loginBtn} ${isLight ? styles.lightBtn : ""}`} onClick={toggleMode}>
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==== EXPORT WRAPPERS ĐỂ KHÔNG LÀM HỎNG CÁC IMPORT CŨ ====
export const SignInModal = (props: Omit<AuthModalProps, "initialMode">) => (
  <AuthModalBase {...props} initialMode="login" />
);

export const SignUpModal = (props: Omit<AuthModalProps, "initialMode">) => (
  <AuthModalBase {...props} initialMode="register" />
);
