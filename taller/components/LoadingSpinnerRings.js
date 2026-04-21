/**
 * Anillos del loader: track suave + arco con degradado (rose → rojo marca).
 * `gradientId` debe ser único si hay varios SVG en el mismo documento.
 */
export default function LoadingSpinnerRings({
  gradientId = "loader-ring-gradient",
  className = "absolute inset-0 h-full w-full",
}) {
  return (
    <svg
      className={`${className} animate-spin`}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ animationDuration: "1.05s" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="45%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#e4e4e7"
        strokeWidth="5"
        opacity="0.95"
      />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="72 205"
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}
