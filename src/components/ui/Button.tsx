import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `outlineLight` is the secondary action on dark (navy) backgrounds. */
  variant?: 'primary' | 'secondary' | 'outline' | 'outlineLight' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: 'bg-secondary-500 text-primary-900 font-semibold hover:bg-secondary-400 active:bg-secondary-600 shadow-sm',
  secondary: 'bg-primary-800 text-white font-semibold hover:bg-primary-900 active:bg-primary-900 shadow-sm',
  outline: 'border border-primary-200 bg-primary-50 text-primary-800 font-semibold hover:bg-primary-100 hover:border-primary-300 active:bg-primary-200',
  outlineLight: 'border border-white/40 bg-white/10 text-white font-semibold hover:bg-white/20 active:bg-white/25',
  ghost: 'text-primary-700 hover:bg-primary-50 active:bg-primary-100',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 shadow-sm',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2 min-h-[44px]',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2 min-h-[48px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
