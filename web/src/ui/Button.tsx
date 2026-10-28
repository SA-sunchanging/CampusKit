import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

// Buttons (role A). Use ButtonLink when the action only navigates.
export type ButtonVariant = 'primary' | 'ghost';
export type ButtonSize = 'normal' | 'small';

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function lookClass({ variant = 'primary', size = 'normal' }: Look, extra = '') {
  return [
    'btn',
    variant === 'ghost' && 'btn-ghost',
    size === 'small' && 'btn-small',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={lookClass({ variant, size }, className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: Look & LinkProps) {
  return <Link className={lookClass({ variant, size }, className)} {...rest} />;
}
