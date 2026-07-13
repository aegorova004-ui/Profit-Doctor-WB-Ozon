"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ProfitDoctorMascotProps = {
  className?: string;
};

export function ProfitDoctorMascot({
  className = "",
}: ProfitDoctorMascotProps) {
  const [isWaving, setIsWaving] = useState(false);
  const waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (waveTimer.current) {
        clearTimeout(waveTimer.current);
      }
    };
  }, []);

  function wave() {
    if (waveTimer.current) {
      clearTimeout(waveTimer.current);
    }

    setIsWaving(true);
    waveTimer.current = setTimeout(() => setIsWaving(false), 3050);
  }

  return (
    <button
      type="button"
      className={`${className} doctor-mascot-button${isWaving ? "is-waving" : ""}`}
      onClick={wave}
      aria-label="Profit Doctor машет рукой"
    >
      <Image
        className="doctor-mascot-frame doctor-mascot-frame-rest"
        src="/images/profit-doctor-mascot.png"
        alt=""
        width={1254}
        height={1254}
        sizes="160px"
      />
      <Image
        className="doctor-mascot-frame doctor-mascot-frame-wave"
        src="/images/profit-doctor-mascot-wave.png"
        alt=""
        width={1254}
        height={1254}
        sizes="160px"
      />
    </button>
  );
}
