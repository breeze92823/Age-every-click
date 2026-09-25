import { useGameStore } from '../../store/useGameStore.js'
import { useBonusTimer } from '../../systems/bonusBridge.js'

// Top-centre countdown for the Bonus Scene's glass bridge — orange/yellow
// gradient digits with a dark outline. Hidden everywhere else.
export default function BonusTimer() {
  const inBonus = useGameStore((s) => s.currentScene === 'bonus')
  const timeLeft = useBonusTimer((s) => s.timeLeft)
  if (!inBonus) return null

  const text = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
  return (
    <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 select-none">
      <span
        className="block tabular-nums leading-none"
        style={{
          fontFamily: '"Arial Black", "Segoe UI Black", system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          backgroundImage: 'linear-gradient(180deg, #ffe45c 0%, #ffb300 55%, #ff7a00 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextStroke: '3px #2a1600',
          filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.45))',
        }}
      >
        {text}
      </span>
    </div>
  )
}
