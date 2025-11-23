/**
 * Sign In Form Component
 * Provides email/username and password authentication with validation
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { TextInput, PasswordInput, Button, InlineNotification } from '@carbon/react';
import { signInSchema, type SignInFormData } from './schemas/signInSchema';
import { useAuth } from '../../contexts';
import './SignInForm.module.scss';

/**
 * SignInForm Props
 */
interface SignInFormProps {
  /**
   * Callback function called after successful sign-in
   */
  onSuccess?: () => void;
  /**
   * Callback function to open wallet modal
   */
  onOpenWalletModal?: () => void;
  /**
   * Callback to navigate to sign-up page
   */
  onNavigateToSignUp?: () => void;
}

/**
 * SignInForm Component
 * Handles user authentication with email/username and password
 * 
 * @example
 * ```tsx
 * <SignInForm onSuccess={() => navigate('/dashboard')} />
 * ```
 */
export const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onOpenWalletModal,
  onNavigateToSignUp,
}) => {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur', // Validate on blur for better UX
  });

  /**
   * Handle form submission
   * Authenticates user and handles success/error states
   */
  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Map our form data to the auth context expected format
      const authData = {
        usernameOrEmail: data.identifier,
        password: data.password,
      };
      
      const response = await signIn(authData);

      if (response.success) {
        // Call success callback if provided
        onSuccess?.();
      } else {
        // Display error message from authentication service
        setErrorMessage(response.error || t('validation.invalidCredentials'));
      }
    } catch (error) {
      setErrorMessage(t('validation.networkError'));
      console.error('Sign in error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sign-in-form-container">
      <div className="sign-in-form-header">
        <h2 className="text-2xl font-semibold mb-2">{t('auth.signIn')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('showcase.signInSection')}
        </p>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <InlineNotification
          kind="error"
          title={t('common.error')}
          subtitle={errorMessage}
          onCloseButtonClick={() => setErrorMessage(null)}
          className="mb-4"
          lowContrast
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username/Email field */}
        <TextInput
          id="identifier"
          labelText={`${t('auth.username')} / ${t('auth.email')}`}
          placeholder={`${t('auth.username')} / ${t('auth.email')}`}
          {...register('identifier')}
          invalid={!!errors.identifier}
          invalidText={errors.identifier?.message}
          disabled={isSubmitting}
        />

        {/* Password field */}
        <PasswordInput
          id="password"
          labelText={t('auth.password')}
          placeholder={t('auth.password')}
          {...register('password')}
          invalid={!!errors.password}
          invalidText={errors.password?.message}
          disabled={isSubmitting}
        />

        {/* Forgot password link */}
        <div className="flex justify-end">
          <a
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            tabIndex={isSubmitting ? -1 : 0}
          >
            {t('auth.forgotPassword')}
          </a>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? t('common.loading') : t('auth.signIn')}
        </Button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">
              {t('common.or')}
            </span>
          </div>
        </div>

        {/* Wallet authentication button */}
        <Button
          kind="secondary"
          className="w-full"
          onClick={onOpenWalletModal}
          disabled={isSubmitting}
          size="lg"
        >
          {t('auth.continueWithWallet')}
        </Button>

        {/* Sign up link */}
        <div className="text-center mt-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.wantAccount')}{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToSignUp}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            disabled={isSubmitting}
          >
            {t('auth.signUp')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignInForm;
