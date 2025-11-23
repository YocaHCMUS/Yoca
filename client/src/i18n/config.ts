import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * i18n configuration for multi-language support
 * Supported languages: English (en), Vietnamese (vi), Japanese (ja)
 */

const resources = {
  en: {
    translation: {
      // Common
      common: {
        cancel: 'Cancel',
        confirm: 'Confirm',
        submit: 'Submit',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
      },
      // Authentication
      auth: {
        signIn: 'Sign In',
        signUp: 'Sign Up',
        signOut: 'Sign Out',
        email: 'Email',
        username: 'Username',
        password: 'Password',
        retypePassword: 'Retype Password',
        forgotPassword: 'Forgot password?',
        alreadyHaveAccount: 'Already have an account?',
        wantAccount: 'Want to have an account?',
        createAccount: 'Create Account',
        continueWithGoogle: 'Continue with Google',
        signUpWithGoogle: 'Sign up with Google',
        continueWithWallet: 'Continue with a linked wallet',
        signUpWithWallet: 'Sign up with an existing wallet(s)',
        termsAndPrivacy: 'By signing up, you agree to our {{terms}} and {{privacy}}',
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
      },
      // Wallet
      wallet: {
        connectWallet: 'Connect Wallet',
        selectWallet: 'Select a wallet',
        detected: 'Detected',
        notDetected: 'No wallet detected',
        installWallet: 'Please install a Solana wallet extension',
        blockchain: 'Blockchain',
        connecting: 'Connecting...',
        connectionFailed: 'Connection Failed',
        retry: 'Retry',
        popularWallets: 'Popular Solana Wallets',
      },
      // Navigation
      nav: {
        market: 'Market',
        alert: 'Alert',
        dashboard: 'Dashboard',
        profile: 'Profile',
        settings: 'Settings',
        language: 'Language',
        theme: 'Theme',
      },
      // Validation errors
      validation: {
        required: 'This field is required',
        invalidEmail: 'Please enter a valid email address',
        passwordTooShort: 'Password must be at least {{min}} characters',
        passwordsDoNotMatch: 'Passwords do not match',
        invalidCredentials: 'Invalid username or password',
        accountExists: 'An account with this email already exists',
        networkError: 'Network error. Please try again.',
      },
      // Showcase page
      showcase: {
        title: 'Yoca Component Showcase',
        subtitle: 'Authentication & Navigation UI Components',
        signInSection: 'Sign In Component',
        signUpSection: 'Sign Up Component',
        walletSection: 'Wallet Connection',
        googleAuthSection: 'Google OAuth',
        navigationSection: 'Navigation Header',
        placeholderContent: 'This is placeholder content for demonstration.',
      },
    },
  },
  vi: {
    translation: {
      // Common
      common: {
        cancel: 'Hủy',
        confirm: 'Xác nhận',
        submit: 'Gửi',
        loading: 'Đang tải...',
        error: 'Lỗi',
        success: 'Thành công',
      },
      // Authentication
      auth: {
        signIn: 'Đăng nhập',
        signUp: 'Đăng ký',
        signOut: 'Đăng xuất',
        email: 'Email',
        username: 'Tên người dùng',
        password: 'Mật khẩu',
        retypePassword: 'Nhập lại mật khẩu',
        forgotPassword: 'Quên mật khẩu?',
        alreadyHaveAccount: 'Đã có tài khoản?',
        wantAccount: 'Muốn có tài khoản?',
        createAccount: 'Tạo tài khoản',
        continueWithGoogle: 'Tiếp tục với Google',
        signUpWithGoogle: 'Đăng ký với Google',
        continueWithWallet: 'Tiếp tục với ví đã liên kết',
        signUpWithWallet: 'Đăng ký với ví hiện có',
        termsAndPrivacy: 'Bằng việc đăng ký, bạn đồng ý với {{terms}} và {{privacy}} của chúng tôi',
        terms: 'Điều khoản dịch vụ',
        privacy: 'Chính sách bảo mật',
      },
      // Wallet
      wallet: {
        connectWallet: 'Kết nối ví',
        selectWallet: 'Chọn một ví',
        detected: 'Đã phát hiện',
        notDetected: 'Không phát hiện ví',
        installWallet: 'Vui lòng cài đặt tiện ích ví Solana',
        blockchain: 'Blockchain',
        connecting: 'Đang kết nối...',
        connectionFailed: 'Kết nối thất bại',
        retry: 'Thử lại',
        popularWallets: 'Ví Solana phổ biến',
      },
      // Navigation
      nav: {
        market: 'Thị trường',
        alert: 'Cảnh báo',
        dashboard: 'Bảng điều khiển',
        profile: 'Hồ sơ',
        settings: 'Cài đặt',
        language: 'Ngôn ngữ',
        theme: 'Giao diện',
      },
      // Validation errors
      validation: {
        required: 'Trường này là bắt buộc',
        invalidEmail: 'Vui lòng nhập địa chỉ email hợp lệ',
        passwordTooShort: 'Mật khẩu phải có ít nhất {{min}} ký tự',
        passwordsDoNotMatch: 'Mật khẩu không khớp',
        invalidCredentials: 'Tên người dùng hoặc mật khẩu không hợp lệ',
        accountExists: 'Tài khoản với email này đã tồn tại',
        networkError: 'Lỗi mạng. Vui lòng thử lại.',
      },
      // Showcase page
      showcase: {
        title: 'Bộ sưu tập component Yoca',
        subtitle: 'Xác thực & Điều hướng UI',
        signInSection: 'Component đăng nhập',
        signUpSection: 'Component đăng ký',
        walletSection: 'Kết nối ví',
        googleAuthSection: 'Xác thực Google',
        navigationSection: 'Thanh điều hướng',
        placeholderContent: 'Đây là nội dung mẫu để minh họa.',
      },
    },
  },
  ja: {
    translation: {
      // Common
      common: {
        cancel: 'キャンセル',
        confirm: '確認',
        submit: '送信',
        loading: '読み込み中...',
        error: 'エラー',
        success: '成功',
      },
      // Authentication
      auth: {
        signIn: 'ログイン',
        signUp: '登録',
        signOut: 'ログアウト',
        email: 'メール',
        username: 'ユーザー名',
        password: 'パスワード',
        retypePassword: 'パスワードを再入力',
        forgotPassword: 'パスワードをお忘れですか？',
        alreadyHaveAccount: 'すでにアカウントをお持ちですか？',
        wantAccount: 'アカウントを作成しますか？',
        createAccount: 'アカウント作成',
        continueWithGoogle: 'Googleで続ける',
        signUpWithGoogle: 'Googleで登録',
        continueWithWallet: 'リンクされたウォレットで続ける',
        signUpWithWallet: '既存のウォレットで登録',
        termsAndPrivacy: '登録することで、{{terms}}と{{privacy}}に同意したことになります',
        terms: '利用規約',
        privacy: 'プライバシーポリシー',
      },
      // Wallet
      wallet: {
        connectWallet: 'ウォレット接続',
        selectWallet: 'ウォレットを選択',
        detected: '検出済み',
        notDetected: 'ウォレットが検出されません',
        installWallet: 'Solanaウォレット拡張機能をインストールしてください',
        blockchain: 'ブロックチェーン',
        connecting: '接続中...',
        connectionFailed: '接続失敗',
        retry: '再試行',
        popularWallets: '人気のSolanaウォレット',
      },
      // Navigation
      nav: {
        market: 'マーケット',
        alert: 'アラート',
        dashboard: 'ダッシュボード',
        profile: 'プロフィール',
        settings: '設定',
        language: '言語',
        theme: 'テーマ',
      },
      // Validation errors
      validation: {
        required: 'この項目は必須です',
        invalidEmail: '有効なメールアドレスを入力してください',
        passwordTooShort: 'パスワードは{{min}}文字以上である必要があります',
        passwordsDoNotMatch: 'パスワードが一致しません',
        invalidCredentials: 'ユーザー名またはパスワードが無効です',
        accountExists: 'このメールアドレスのアカウントは既に存在します',
        networkError: 'ネットワークエラー。もう一度お試しください。',
      },
      // Showcase page
      showcase: {
        title: 'Yocaコンポーネントショーケース',
        subtitle: '認証とナビゲーションUIコンポーネント',
        signInSection: 'サインインコンポーネント',
        signUpSection: 'サインアップコンポーネント',
        walletSection: 'ウォレット接続',
        googleAuthSection: 'Google認証',
        navigationSection: 'ナビゲーションヘッダー',
        placeholderContent: 'これはデモンストレーションのプレースホルダーコンテンツです。',
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for simpler error handling
    },
  });

export default i18n;
