import React from "react";

export function FocusLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-logo.png"
      alt="Focus English"
      width={36}
      height={36}
      className={`${className} focus-logo-img object-contain select-none`}
    />
  );
}
