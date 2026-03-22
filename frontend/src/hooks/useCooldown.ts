import { useMemo } from "react";
import { BigNumber } from "ethers";

export const useCooldown = (cooldown: number | BigNumber) => {
  const value = typeof cooldown === "number" ? cooldown : cooldown.toNumber();

  const formatted = useMemo(() => {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}m ${seconds}s`;
  }, [value]);

  return { formatted };
};