"use client";

export default function Background() {
  return (
    <div className="nebulosa-container">
      <div className="blob left-0 top-0" />
      <div className="blob blob-2 right-0 bottom-0" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent" />
    </div>
  );
}
