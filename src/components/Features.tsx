"use client";

import { motion } from "framer-motion";
import {
  Infinity as InfinityIcon,
  ThumbsUp,
  Ban,
  MonitorSmartphone,
  BadgeCheck,
  Gauge,
} from "lucide-react";

const features = [
  {
    icon: InfinityIcon,
    title: "Free Unlimited Conversion",
    description:
      "Convert and download as many videos as you want. No limits, no accounts and no hidden fees.",
  },
  {
    icon: ThumbsUp,
    title: "User-Friendly Interface",
    description:
      "Paste a link and press START. The whole process takes a single click, straight from your browser.",
  },
  {
    icon: Ban,
    title: "No Software Installation",
    description:
      "Everything runs online. No apps, no extensions and no registration required.",
  },
  {
    icon: MonitorSmartphone,
    title: "Compatible With All Devices",
    description:
      "Works on phones, tablets, laptops and desktops with any modern browser: Chrome, Firefox, Safari or Edge.",
  },
  {
    icon: BadgeCheck,
    title: "High-Quality Downloads",
    description:
      "Grab your video in 1080p HD with the audio included, ready to watch anywhere.",
  },
  {
    icon: Gauge,
    title: "Very Fast Download",
    description:
      "Quick extraction and direct streaming, so your file starts downloading right away.",
  },
];

export default function Features() {
  return (
    <section className="w-full max-w-5xl z-10 mt-16 mb-16 md:mt-20 md:mb-24" aria-label="Features">
      <div className="text-center mb-8 md:mb-10 px-2">
        <h2 className="text-yellow-300 pixel-font-title text-[13px] md:text-lg tracking-wider uppercase">
          ► WHY CLIPYDROPY? ◄
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {features.map((feature, idx) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: (idx % 3) * 0.08, duration: 0.35 }}
            className="pixel-card p-4 md:p-5 flex flex-col items-center text-center gap-3 group"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 border-4 border-black bg-[#0f0a17] flex items-center justify-center shadow-[inset_2px_2px_0_#3c2a4f,inset_-2px_-2px_0_#07040a]">
              <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-cyan-300 group-hover:text-yellow-300 transition-colors" />
            </div>

            <h3 className="pixel-font-title text-xs md:text-sm leading-relaxed tracking-wide text-yellow-300 uppercase">
              {feature.title}
            </h3>

            <p className="pixel-font-body text-xs md:text-[13px] leading-relaxed text-pink-200/85">
              {feature.description}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
