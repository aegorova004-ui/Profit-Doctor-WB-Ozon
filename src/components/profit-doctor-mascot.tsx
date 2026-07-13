"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ProfitDoctorMascotProps = {
  className?: string;
};

export function ProfitDoctorMascot({
  className = "",
}: ProfitDoctorMascotProps) {
  const [isRaised, setIsRaised] = useState(false);
  const raiseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (raiseTimer.current) {
        clearTimeout(raiseTimer.current);
      }
    };
  }, []);

  function raiseOnce() {
    if (raiseTimer.current) {
      clearTimeout(raiseTimer.current);
    }

    setIsRaised(true);
    raiseTimer.current = setTimeout(() => setIsRaised(false), 700);
  }

  return (
    <button
      type="button"
      className={[className, "doctor-mascot-button", isRaised && "is-raised"]
        .filter(Boolean)
        .join(" ")}
      onClick={raiseOnce}
      aria-label="Profit Doctor поднимает руку"
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
