import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export function PageTransition({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Lightweight CSS 3D-inspired floating architectural planes for the Admin Login backdrop.
 * Uses strictly compositor-only transforms and respects prefers-reduced-motion.
 */
export function LoginSpatialBackdrop() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0F1113]"
    >
      {/* Subtle radial studio illumination */}
      <div
        className="absolute -top-1/3 left-1/4 h-[680px] w-[680px] rounded-full opacity-35 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(27,67,50,0.45) 0%, rgba(17,19,21,0) 70%)',
        }}
      />
      <div
        className="absolute -bottom-1/4 right-1/5 h-[560px] w-[560px] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(161,130,82,0.28) 0%, rgba(17,19,21,0) 72%)',
        }}
      />

      {/* 3D Perspective Plane Layer */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [-10, 10, -10],
                  rotateX: [16, 20, 16],
                  rotateY: [-18, -12, -18],
                }
          }
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
          className="absolute top-[14%] left-[8%] hidden h-56 w-56 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent shadow-2xl backdrop-blur-sm lg:block"
        >
          <div className="absolute inset-4 rounded-2xl border border-white/[0.06]" />
        </motion.div>

        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [12, -12, 12],
                  rotateX: [-14, -18, -14],
                  rotateY: [22, 16, 22],
                }
          }
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
          className="absolute right-[9%] bottom-[14%] hidden h-64 w-64 rounded-3xl border border-[#2D6A4F]/30 bg-gradient-to-tr from-[#1B4332]/25 to-white/[0.03] shadow-2xl backdrop-blur-sm lg:block"
        >
          <div className="absolute inset-5 rounded-2xl border border-white/[0.07]" />
        </motion.div>

        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [-6, 8, -6],
                  rotateZ: [-8, -4, -8],
                }
          }
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[18%] top-[16%] hidden h-28 w-28 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm md:block"
        />
      </div>
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-[#E6E4DF] bg-white p-5 ${className}`}
    >
      <div className="h-3.5 w-24 rounded bg-zinc-200" />
      <div className="mt-3 h-7 w-16 rounded bg-zinc-200" />
    </div>
  );
}
