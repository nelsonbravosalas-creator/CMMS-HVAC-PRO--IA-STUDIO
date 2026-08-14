import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

interface LoadingIndicatorProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  color?: string;
}

const sizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
};

export default function LoadingIndicator({ 
  size = "md", 
  className = "", 
  label,
  color = "text-blue-500"
}: LoadingIndicatorProps) {
  return (
    <div className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        {/* Outer glow/pulse ring */}
        <motion.div
          className={`absolute inset-0 rounded-full bg-current opacity-20 blur-xl ${sizes[size]} ${color}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Main spinning loader */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
          className="relative z-10"
        >
          <Loader2 className={`${sizes[size]} ${color}`} />
        </motion.div>
      </div>

      {label && (
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold uppercase tracking-widest text-slate-400"
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}
