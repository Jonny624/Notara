export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5 stripe-bg"
      style={{
        backgroundImage: [
          "repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(255,255,255,0.05) 31px, rgba(255,255,255,0.05) 32px)",
          "repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(255,255,255,0.025) 18px, rgba(255,255,255,0.025) 20px)",
          "linear-gradient(160deg, #2a3f70 0%, #314a82 60%, #395791 100%)",
        ].join(", "),
      }}
    >
      <span className="text-base font-bold tracking-tight text-mist/80">Notara</span>
      <div className="loading-spinner" />
    </div>
  );
}
