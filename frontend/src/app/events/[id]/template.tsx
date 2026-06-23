"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Scoped to the [id] segment so it RE-MOUNTS when navigating event → event (the root
// template doesn't, because the segment shape is unchanged). Opacity-only → keeps the
// page's position:sticky elements working.
export default function EventDetailTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
