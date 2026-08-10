export type GardenPlantType = 'seedling' | 'small-tree' | 'big-tree'

interface GardenPlantProps {
  type: GardenPlantType
  /** Sequential plant index, used for deterministic organic variation. */
  index?: number
}

/**
 * Refined inline-SVG garden plants: seedling, small tree and big tree with
 * layered canopies, trunks, soil mounds and highlights. Colors are fixed
 * natural greens/browns so the garden never follows the theme's accent
 * (e.g. cinnabar red on the China theme).
 */
export default function GardenPlant({ type, index = 0 }: GardenPlantProps) {
  const rotate = ((index * 37) % 7) - 3
  const lift = (index * 13) % 3
  const delay = Math.min((index % 8) * 60, 420)

  return (
    <span
      className={`garden-plant garden-${type}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <svg
        viewBox={
          type === 'seedling'
            ? '0 0 24 32'
            : type === 'small-tree'
              ? '0 0 40 52'
              : '0 0 64 84'
        }
        style={{ transform: `rotate(${rotate}deg) translateY(${lift}px)` }}
        aria-hidden="true"
      >
        {type === 'seedling' ? (
          <>
            <ellipse cx="12" cy="29" rx="8" ry="2.6" fill="#cbb489" />
            <ellipse cx="12" cy="29.2" rx="4.8" ry="1.3" fill="#b59a6f" />
            <path
              d="M12 28 C12 22 12 18 12 14"
              stroke="#7c9a68"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse cx="9" cy="16" rx="4.4" ry="2.6" fill="#7ecb9a" transform="rotate(-24 9 16)" />
            <ellipse cx="15" cy="12.5" rx="4.4" ry="2.6" fill="#5aab7d" transform="rotate(24 15 12.5)" />
          </>
        ) : null}
        {type === 'small-tree' ? (
          <>
            <ellipse cx="20" cy="48" rx="11" ry="3" fill="#cbb489" />
            <ellipse cx="20" cy="48.3" rx="7" ry="1.6" fill="#b59a6f" />
            <path
              d="M20 47 C20 42 20 38 20 34"
              stroke="#8a6a4a"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="20" cy="24" r="11" fill="#4c9a6e" />
            <circle cx="15" cy="27" r="8" fill="#3e8f63" />
            <circle cx="26" cy="27" r="8" fill="#5aab7d" />
            <circle cx="20" cy="20" r="9" fill="#5fae7f" />
            <ellipse cx="17" cy="17" rx="3.5" ry="2.2" fill="#a9dcb6" opacity="0.8" />
          </>
        ) : null}
        {type === 'big-tree' ? (
          <>
            <ellipse cx="32" cy="78" rx="18" ry="4.4" fill="#cbb489" />
            <ellipse cx="32" cy="78.5" rx="11" ry="2.2" fill="#b59a6f" />
            <path
              d="M32 76 C32 68 32 60 32 50"
              stroke="#7a5a3c"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="32" cy="40" r="16" fill="#3e8f63" />
            <circle cx="22" cy="46" r="12" fill="#2f7d54" />
            <circle cx="42" cy="46" r="12" fill="#4c9a6e" />
            <circle cx="32" cy="34" r="14" fill="#4f9d70" />
            <circle cx="26" cy="52" r="10" fill="#357f57" />
            <circle cx="38" cy="52" r="10" fill="#3e8f63" />
            <ellipse cx="26" cy="30" rx="5" ry="3" fill="#b3e0c0" opacity="0.85" />
          </>
        ) : null}
      </svg>
    </span>
  )
}
