import clsx from "clsx";
import { useState } from "react";
import { useInterval } from "usehooks-ts";

export function LoadingIndicator(props: {
  className?: string;
  intervalMs?: number;
  size: number;
}) {
  const { intervalMs = 350, className } = props;
  const modNum = 3;
  const [mod, setMod] = useState(0);

  useInterval(() => {
    setMod((mod + 1) % modNum);
  }, intervalMs);

  return (
    <div className={clsx(className, "flex items-center gap-x-0.5")}>
      {Array.from({ length: modNum }).map((_, i) => (
        <div
          key={i}
          style={{
            width: `${props.size}px`,
            height: `${props.size}px`,
          }}
          className={clsx(
            "rounded-full transition",
            i === mod ? "bg-neutral-400" : "bg-neutral-600"
          )}
        />
      ))}
    </div>
  );
}
