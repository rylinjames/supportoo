'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type BotProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    rect1: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    rect2: {
      initial: { y: 0 },
      animate: {
        y: [0, 2, 0],
        transition: { duration: 0.6, ease: 'easeInOut', delay: 0.1 },
      },
    },
    circle1: {},
    circle2: {},
    path1: {},
    path2: {},
    path3: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BotProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M12 8V4H8"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.rect
        width={16}
        height={12}
        x={4}
        y={8}
        rx={2}
        variants={variants.rect1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2 14h2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M20 14h2"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M15 13v2"
        variants={variants.rect2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M9 13v2"
        variants={variants.rect2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

export function Bot(props: BotProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export type { BotProps };