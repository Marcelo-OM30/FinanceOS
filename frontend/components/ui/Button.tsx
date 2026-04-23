'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import Spinner from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading,
      fullWidth,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary:
        'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500',
      danger:
        'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
      ghost:
        'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
      success:
        'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2',
    };

    return (
      <button
        ref={ref}
        className={clsx(
          base,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
