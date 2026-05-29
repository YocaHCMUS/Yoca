import client from "@/api/main";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import z from "zod";
import styles from "./AuthModal.module.scss";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { WalletAuthButton } from "./WalletAuthButton";

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
  const { theme } = useUserTheme();
  const isLight = theme === "light";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  
  // Quản lý trạng thái Animation Slide (false = Login, true = Register)
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === "register");

  useEffect(() => {
    setIsRegisterMode(initialMode === "register");
  }, [initialMode, open]);

  const resolvedRedirectUrl = typeof redirectUrl === "string" && redirectUrl.length > 0 ? redirectUrl : "/";

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


  // ====== HANDLERS ======
  function handleClose() {
    setErrMsg(null);
    clearLoginErrors();
    clearRegisterErrors();
    onClose();
  }

  function toggleMode() {
    setIsRegisterMode((prev) => !prev);
    setErrMsg(null);
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
        navigate("/");
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
              <a href="#">{tr("auth.forgotPassword")}</a>
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
                onSuccess={async () => { await refreshUser(); handleClose(); navigate("/"); }}
                onError={(msg) => setErrMsg(msg)}
              />
              <WalletAuthButton
                disabled={isSubmitting}
                onSuccess={async () => { await refreshUser(); handleClose(); navigate("/"); }}
                onError={(msg) => setErrMsg(msg)}
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