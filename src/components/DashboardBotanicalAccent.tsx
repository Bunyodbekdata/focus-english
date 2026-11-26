import React from "react";

/**
 * Subtle botanical leaf sprig shown ONLY near the Dashboard header,
 * adapting cleanly to all five themes via CSS variables.
 */
export function DashboardBotanicalAccent() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none select-none w-[290px] sm:w-[340px] h-auto opacity-100"
    >
      {/* Delicate curved stem */}
      <path
        d="M360 10C305 18 242 28 178 44C128 56 84 52 44 38"
        stroke="var(--botanical-stem)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M275 24C244 48 214 68 186 84"
        stroke="var(--botanical-stem)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />

      {/* Rich botanical leaves along branch */}
      <path
        d="M326 15C308 2 282 10 274 27C294 34 316 28 326 15Z"
        fill="var(--botanical-leaf-2)"
        opacity="0.88"
      />
      <path
        d="M286 24C296 48 320 62 344 58C336 36 312 22 286 24Z"
        fill="var(--botanical-leaf-1)"
        opacity="0.82"
      />
      <path
        d="M242 32C222 14 192 18 178 36C198 46 226 44 242 32Z"
        fill="var(--botanical-leaf-1)"
        opacity="0.88"
      />
      <path
        d="M226 42C224 68 240 88 262 94C266 70 250 48 226 42Z"
        fill="var(--botanical-leaf-2)"
        opacity="0.78"
      />
      <path
        d="M178 44C158 26 128 28 112 44C132 56 160 56 178 44Z"
        fill="var(--botanical-leaf-3)"
        opacity="0.92"
      />
      <path
        d="M196 76C174 72 152 84 144 102C166 106 188 94 196 76Z"
        fill="var(--botanical-leaf-1)"
        opacity="0.82"
      />
      <path
        d="M126 48C108 66 108 86 122 98C136 82 138 62 126 48Z"
        fill="var(--botanical-leaf-3)"
        opacity="0.84"
      />
      <path
        d="M84 44C66 28 40 30 26 42C44 54 68 54 84 44Z"
        fill="var(--botanical-leaf-2)"
        opacity="0.68"
      />
    </svg>
  );
}
