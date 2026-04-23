type LoadingSpinnerProps = {
  className?: string;
};

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
