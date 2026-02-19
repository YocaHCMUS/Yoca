/**
 * Sign Up Form Component
 * Provides user registration with email, username, password validation
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { TextInput, PasswordInput, Button, InlineNotification } from '@carbon/react';
import { UserFollow, Wallet } from '@carbon/icons-react';
import { signUpSchema, type SignUpFormData } from './schemas/signUpSchema';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useAuth } from '../../contexts';
import styles from './SignUpForm.module.scss';

/**
 * SignUpForm Props
 */
interface SignUpFormProps {
  /**
   * Callback function called after successful sign-up
   */
  onSuccess?: () => void;
  /**
   * Callback function to open wallet modal
   */
  onOpenWalletModal?: () => void;
  /**
   * Callback to navigate to sign-in page
   */
  onNavigateToSignIn?: () => void;
}

/**
 * SignUpForm Component
 * Handles user registration with email, username, password
 * 
 * @example
 * ```tsx
 * <SignUpForm onSuccess={() => navigate('/dashboard')} />
 * ```
 */
export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onOpenWalletModal,
  onNavigateToSignIn,
}) => {
  const { t } = useTranslation();
  const { signUp, googleSignIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to translate error messages from Zod
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    // Check if it's a translation key (starts with 'validation.')
    if (message.startsWith('validation.')) {
      return t(message, { min: message.includes('passwordTooShort') ? '8' : '3' });
    }
    return message;
  };

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur', // Validate on blur for better UX
  });

  /**
   * Handle form submission
   * Creates new user account and handles success/error states
   */
  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Pass the full form data including retypePassword for validation
      const response = await signUp(data);

      if (response.success) {
        // Call success callback if provided
        onSuccess?.();
      } else {
        // Display error message from authentication service
        setErrorMessage(response.error || t('validation.registrationFailed'));
      }
    } catch (error) {
      setErrorMessage(t('validation.networkError'));
      console.error('Sign up error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Google OAuth success
   */
  const handleGoogleSuccess = async (credential: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await googleSignIn({ credential, clientId: '' });

      if (response.success) {
        onSuccess?.();
      } else {
        setErrorMessage(response.error || t('auth.googleAuthFailed'));
      }
    } catch (error) {
      setErrorMessage(t('auth.googleAuthFailed'));
      console.error('Google sign up error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Google OAuth error
   */
  const handleGoogleError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div className={styles['sign-up-form-container']}>
      <div className={styles['sign-up-form-header']}>
        <h2 className={styles['header-title']}>{t('auth.signUp')}</h2>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <InlineNotification
          kind="error"
          title={t('common.error')}
          subtitle={errorMessage}
          onCloseButtonClick={() => setErrorMessage(null)}
          className={styles['error-notification']}
          lowContrast
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles['form']}>
        {/* Email field */}
        <TextInput
          id="email"
          labelText={t('auth.email')}
          placeholder={t('auth.email')}
          type="email"
          {...register('email')}
          invalid={!!errors.email}
          invalidText={translateError(errors.email?.message)}
          disabled={isSubmitting}
        />

        {/* Username field */}
        <TextInput
          id="username"
          labelText={t('auth.username')}
          placeholder={t('auth.username')}
          {...register('username')}
          invalid={!!errors.username}
          invalidText={translateError(errors.username?.message)}
          disabled={isSubmitting}
        />

        {/* Password field */}
        <PasswordInput
          id="password"
          labelText={t('auth.password')}
          placeholder={t('auth.password')}
          {...register('password')}
          invalid={!!errors.password}
          invalidText={translateError(errors.password?.message)}
          disabled={isSubmitting}
        />

        {/* Confirm password field */}
        <PasswordInput
          id="retypePassword"
          labelText={t('auth.confirmPassword')}
          placeholder={t('auth.confirmPassword')}
          {...register('retypePassword')}
          invalid={!!errors.retypePassword}
          invalidText={translateError(errors.retypePassword?.message)}
          disabled={isSubmitting}
        />

        {/* Terms and Privacy Policy */}
        <div className={styles['terms-text']}>
          {t('auth.termsPrefix')}{' '}
          <a
            href="/terms"
            tabIndex={isSubmitting ? -1 : 0}
          >
            {t('auth.termsOfService')}
          </a>{' '}
          {t('common.and')}{' '}
          <a
            href="/privacy"
            tabIndex={isSubmitting ? -1 : 0}
          >
            {t('auth.privacyPolicy')}
          </a>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          renderIcon={UserFollow}
        >
          {isSubmitting ? t('common.loading') : t('auth.createAccount')}
        </Button>

        {/* Divider */}
        <div className={styles['divider']}>
          <div className={styles['divider-line']}>
            <div className={styles['divider-border']}></div>
          </div>
          <div className={styles['divider-text-container']}>
            <span className={styles['divider-text']}>
              {t('auth.or')}
            </span>
          </div>
        </div>

        {/* Google OAuth button */}
        <GoogleAuthButton
          mode="signup"
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          disabled={isSubmitting}
        />

        {/* Wallet authentication button */}
        <Button
          type="button"
          kind="secondary"
          onClick={onOpenWalletModal}
          disabled={isSubmitting}
          size="lg"
          renderIcon={Wallet}
        >
          {t('auth.signUpWithWallet')}
        </Button>

        {/* Sign in link */}
        <div className={styles['sign-in-section']}>
          <span className={styles['sign-in-text']}>
            {t('auth.alreadyHaveAccount')}{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToSignIn}
            className={styles['sign-in-button']}
            disabled={isSubmitting}
          >
            {t('auth.signIn')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignUpForm;
