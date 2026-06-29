import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  withText?: boolean;
}

export function Logo({ className, withText = true, ...props }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        {...props}
      >
        <path
          d="M16 2L2 9.5V22.5L16 30L30 22.5V9.5L16 2Z"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />
        <path
          d="M16 22L16 10M11 16L21 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          style={{ transform: 'rotate(45deg)', transformOrigin: 'center' }}
        />
        <circle cx="16" cy="16" r="4" fill="currentColor" className="text-primary" />
      </svg>
      {withText && (
        <span className="font-semibold tracking-tight text-lg leading-none mt-0.5 text-foreground">
          ClassFlow
        </span>
      )}
    </div>
  );
}
