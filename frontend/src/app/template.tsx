"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// A template re-mounts on every navigation, so this is an ENTER-only fade (no exit) —
// avoids the "fade-to-blank" flash of AnimatePresence mode="wait". Opacity-only so it
// never creates a containing block (position:sticky keeps working).
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
