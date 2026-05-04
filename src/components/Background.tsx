export default function Background() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/40 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/40 blur-[150px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-indigo-900/30 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
    </div>
  );
}
