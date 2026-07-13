type ProfitDoctorMascotProps = {
  className?: string;
  gradientId: string;
  label?: string;
};

export function ProfitDoctorMascot({
  className,
  gradientId,
  label,
}: ProfitDoctorMascotProps) {
  const bodyGradientId = `doctor-body-${gradientId}`;
  const boardGradientId = `doctor-board-${gradientId}`;

  return (
    <svg
      className={className}
      viewBox="0 0 180 190"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="35" y1="20" x2="140" y2="164">
          <stop stopColor="#d9ff9f" />
          <stop offset="1" stopColor="#9fe449" />
        </linearGradient>
        <linearGradient id={boardGradientId} x1="116" y1="96" x2="157" y2="154">
          <stop stopColor="#bcaeff" />
          <stop offset="1" stopColor="#8e77ef" />
        </linearGradient>
      </defs>

      <path
        d="M45 42C56 18 83 10 107 18c24 8 38 33 34 57-2 14-9 23-16 32-7 10-11 21-11 36H54c0-16-5-27-13-38-8-11-14-22-13-37 1-10 7-20 17-26Z"
        fill={`url(#${bodyGradientId})`}
        stroke="#10221c"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M43 52c-7-7-13-15-11-25 13 0 23 7 28 18"
        fill="#b8f36b"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M126 46c8-8 18-11 28-8-1 11-8 20-18 24"
        fill="#b8f36b"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="70" cy="67" r="5" fill="#10221c" />
      <circle cx="111" cy="67" r="5" fill="#10221c" />
      <path
        d="M78 81c7 7 18 7 25 0"
        fill="none"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="56" cy="79" r="7" fill="#ffab74" opacity=".72" />
      <circle cx="125" cy="79" r="7" fill="#ffab74" opacity=".72" />

      <path
        d="M50 112c9-12 20-18 34-18h13c14 0 27 7 35 20l12 25-9 37H42l-8-37 16-27Z"
        fill="#f8fff9"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="m70 99 20 24 20-24M90 123v52"
        fill="none"
        stroke="#cdd8d1"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M62 101c-3 26 2 44 17 51 10 4 22-2 22-13 0-7-5-12-12-12s-12 5-12 12"
        fill="none"
        stroke="#16755a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle
        cx="77"
        cy="140"
        r="7"
        fill="#b8f36b"
        stroke="#10221c"
        strokeWidth="4"
      />

      <path
        d="M28 115c-9-8-13-19-9-29 11 3 18 11 20 22"
        fill="#b8f36b"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 87c-4-3-6-7-6-11M29 89c-1-6 1-11 4-15"
        fill="none"
        stroke="#10221c"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <rect
        x="112"
        y="108"
        width="51"
        height="58"
        rx="9"
        fill={`url(#${boardGradientId})`}
        stroke="#10221c"
        strokeWidth="5"
        transform="rotate(5 112 108)"
      />
      <path
        d="M126 145v8m10-18v18m10-28v28"
        fill="none"
        stroke="#f8fff9"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M126 114h23"
        fill="none"
        stroke="#10221c"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M57 175c-1 7-7 11-15 11M123 175c1 7 7 11 15 11"
        fill="none"
        stroke="#10221c"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
