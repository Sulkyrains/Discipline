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
  const swayDelay = `${(index % 5) * 0.45}s`

  return (
    <span
      className={`garden-plant garden-${type}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`garden-sway${type === 'seedling' ? '' : ' garden-sway-tree'}`}
        style={{ animationDelay: swayDelay }}
      >
        <svg
          viewBox={
            type === 'seedling'
              ? '0 0 28 36'
              : type === 'small-tree'
                ? '0 0 46 60'
                : '0 0 72 96'
          }
          style={{ transform: `rotate(${rotate}deg) translateY(${lift}px)` }}
          aria-hidden="true"
        >
          {type === 'seedling' ? (
            <>
              <ellipse cx="14" cy="32" rx="9" ry="2.8" fill="#cbb489" />
              <ellipse cx="14" cy="32.3" rx="5.5" ry="1.4" fill="#b59a6f" />
              <path
                d="M14 31 C14 25 14 20 14 16"
                stroke="#7c9a68"
                strokeWidth="1.7"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse cx="10.5" cy="18" rx="5" ry="3" fill="#7ecb9a" transform="rotate(-26 10.5 18)" />
              <ellipse cx="18" cy="14.5" rx="5" ry="3" fill="#5aab7d" transform="rotate(26 18 14.5)" />
              <ellipse cx="14" cy="11.5" rx="3.2" ry="2" fill="#8fd6a5" transform="rotate(8 14 11.5)" />
            </>
          ) : null}
          {type === 'small-tree' ? (
            <>
              <ellipse cx="23" cy="55" rx="12" ry="3.2" fill="#cbb489" />
              <ellipse cx="23" cy="55.4" rx="7.5" ry="1.6" fill="#b59a6f" />
              <path
                d="M23 54 C23 48 23 43 23 38"
                stroke="#8a6a4a"
                strokeWidth="3.6"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="23" cy="28" r="12" fill="#4c9a6e" />
              <circle cx="17" cy="32" r="9" fill="#3e8f63" />
              <circle cx="29" cy="32" r="9" fill="#5aab7d" />
              <circle cx="23" cy="22" r="10" fill="#5fae7f" />
              <circle cx="19" cy="26" r="6" fill="#72bd8e" />
              <circle cx="18" cy="20" r="1.6" fill="#e0b04a" />
              <circle cx="28" cy="30" r="1.4" fill="#e0b04a" />
              <ellipse cx="20" cy="18" rx="3.5" ry="2.2" fill="#a9dcb6" opacity="0.8" />
            </>
          ) : null}
          {type === 'big-tree' ? (
            <>
              <ellipse cx="36" cy="88" rx="20" ry="4.6" fill="rgba(46, 42, 37, 0.14)" />
              <ellipse cx="36" cy="89" rx="12" ry="2.4" fill="#cbb489" />
              <path
                d="M36 87 C36 77 36 66 36 56"
                stroke="#7a5a3c"
                strokeWidth="6.5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M36 68 C42 64 47 62 50 58"
                stroke="#7a5a3c"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="36" cy="44" r="18" fill="#3e8f63" />
              <circle cx="24" cy="52" r="13" fill="#2f7d54" />
              <circle cx="48" cy="52" r="13" fill="#4c9a6e" />
              <circle cx="36" cy="34" r="15" fill="#4f9d70" />
              <circle cx="28" cy="58" r="11" fill="#357f57" />
              <circle cx="44" cy="58" r="11" fill="#3e8f63" />
              <circle cx="31" cy="44" r="9" fill="#63b384" />
              <circle cx="24" cy="50" r="2" fill="#e0b04a" />
              <circle cx="47" cy="46" r="2" fill="#e0b04a" />
              <circle cx="39" cy="60" r="1.8" fill="#f0e6c8" />
              <ellipse cx="29" cy="30" rx="5.5" ry="3.2" fill="#b3e0c0" opacity="0.85" />
            </>
          ) : null}
        </svg>
      </span>
    </span>
  )
}
