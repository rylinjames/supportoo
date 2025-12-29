"use client";

import * as React from "react";
import { useAnimation, animationControls } from "motion/react";
import type { Variants } from "motion/react";

export type IconProps<T extends string = string> = {
  size?: number;
  strokeWidth?: number;
  color?: string;
  animation?: T;
  animateOnHover?: boolean;
  loop?: boolean;
  className?: string;
};

type AnimateIconContextType = {
  controls: ReturnType<typeof useAnimation>;
  isHovered: boolean;
};

const AnimateIconContext = React.createContext<
  AnimateIconContextType | undefined
>(undefined);

export function useAnimateIconContext() {
  const context = React.useContext(AnimateIconContext);
  if (!context) {
    throw new Error(
      "useAnimateIconContext must be used within AnimateIconProvider"
    );
  }
  return context;
}

export function getVariants<T extends Record<string, Record<string, Variants>>>(
  animations: T
): Record<string, Variants> {
  return Object.keys(animations).reduce(
    (acc, key) => {
      return { ...acc, ...animations[key] };
    },
    {} as Record<string, Variants>
  );
}

type IconWrapperProps<T extends string> = IconProps<T> & {
  icon: React.ComponentType<IconProps<T>>;
};

export function IconWrapper<T extends string>({
  icon: Icon,
  size = 24,
  strokeWidth = 2,
  color = "currentColor",
  animation = "default" as T,
  animateOnHover = false,
  loop = false,
  className,
  ...props
}: IconWrapperProps<T>) {
  const controls = useAnimation();
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    if (animateOnHover && isHovered) {
      controls.start("animate");
    } else if (animateOnHover && !isHovered) {
      controls.start("initial");
    } else if (!animateOnHover && loop) {
      controls.start("animate", { repeat: Infinity });
    } else if (!animateOnHover && !loop) {
      controls.start("animate");
    }
  }, [controls, animateOnHover, isHovered, loop]);

  return (
    <AnimateIconContext.Provider value={{ controls, isHovered }}>
      <div
        onMouseEnter={() => animateOnHover && setIsHovered(true)}
        onMouseLeave={() => animateOnHover && setIsHovered(false)}
        style={{ display: "inline-flex", color }}
        className={className}
      >
        <Icon
          size={size}
          strokeWidth={strokeWidth}
          animation={animation}
          {...props}
        />
      </div>
    </AnimateIconContext.Provider>
  );
}
