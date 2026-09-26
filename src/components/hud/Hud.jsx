import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { settings } from '../../systems/settingsState.js'
import { playButtonClick, playButtonHover } from '../../systems/sfx.js'
import { useGameStore } from '../../store/useGameStore.js'
import { canAcceptRebirth, rebirthRequirement } from '../../data/progression.js'
import { SHOP_ITEMS } from '../../data/shop.js'
import { formatCompact } from '../../systems/format.js'
import { resetPlayer } from '../../systems/playerState.js'
import { syncYawToPlayer } from '../../systems/cameraOrbit.js'
import { SPAWN, SPAWN_FACING, ISLAND_SCALE } from '../../data/world.js'
import { OBBY } from '../../data/island.js'
import { ageMachineSpot } from '../../data/area2.js'
import { AGE_BOOST_MULTIPLIER } from '../../data/luckyWheel.js'
import { AGE_MACHINE_RADIUS } from '../../systems/ageMachineCollision.js'
import TouchControls from './TouchControls.jsx'
import RotatePrompt from './RotatePrompt.jsx'
import LevelBar from './LevelBar.jsx'
import RebirthLevelBar from './RebirthLevelBar.jsx'
import LevelUpPopup from './LevelUpPopup.jsx'
import NetStatus from './NetStatus.jsx'
import AuthPanel from './AuthPanel.jsx'
import IdentityChip from './IdentityChip.jsx'
import ActionResult from './ActionResult.jsx'
import ActionPopups from './ActionPopups.jsx'
import BonusTimer from './BonusTimer.jsx'
import InteractPrompt from './InteractPrompt.jsx'
import LuckyWheel from './LuckyWheel.jsx'
import GenderPicker from './GenderPicker.jsx'
import { actionResultState } from '../../systems/actionResult.js'
import { useSettings, useTouchMode } from './hooks.js'

// This Hud is ported from Ice-Skate's components/hud/Hud.jsx: same LevelBar/
// RebirthLevelBar/LevelUpPopup/ActionResult/NetStatus/IdentityChip/AuthPanel/
// ActionPopups/TouchControls/RotatePrompt pieces, same Rebirth/Shop
// toolbar+modal pattern, same sound calls. Ice-Skate's Shop button is a
// kill-switched placeholder; it has no equivalent prop in this template, so
// it's just an always-available toolbar button here instead, left enabled.
// Speed is not currently earned by any in-game action — the walking-based
// gain from Ice-Skate (systems/speedGain.js) was removed since this game
// has no such mechanic, and no click-to-gain button or Set Speed badge
// exists in this HUD yet.

// Shared chrome for every left-center HUD popup (Rebirth, Shop): a
// transparent panel with the title floating above its top-left corner and
// the close button overhanging its top-right corner.
function HudModal({ title, onClose, isTouch, children }) {
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="relative w-[min(800px,78vw)]">
        <span
          className="pointer-events-none absolute -top-5 left-6 z-10 text-4xl font-black text-white"
          style={{ WebkitTextStroke: '1.5px black', paintOrder: 'stroke fill' }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={() => {
            playButtonClick()
            onClose()
          }}
          aria-label="Close"
          className="absolute -top-4 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border-2 border-black bg-red-600 font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.4)] transition hover:bg-red-500"
        >
          X
        </button>
        <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-lg border-2 border-black bg-slate-900/60 shadow-2xl">
          <div className="h-6 shrink-0 border-b-2 border-black bg-slate-900/60" />
          <div
            className={`flex flex-col items-center overflow-y-auto text-slate-100 ${isTouch ? 'gap-2 p-2' : 'gap-3 p-4'}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Opened by the Rebirth button. Confirms the trade of current Speed for a
// rebirth point rather than firing it on a single click.
function RebirthWindow({ rebirth, canRebirth, onConfirm, onClose, isTouch }) {
  const requirement = rebirthRequirement(rebirth)
  return (
    <HudModal title="Rebirth" onClose={onClose} isTouch={isTouch}>
      <div className={`flex items-center justify-center ${isTouch ? 'gap-2 text-2xl' : 'gap-6 text-[3.625rem]'}`}>
        <span className="font-bold text-amber-300">X{rebirth}</span>
        <span
          className={`inline-block font-black leading-none text-white ${isTouch ? 'text-2xl' : 'text-[4.5rem]'}`}
          style={{ WebkitTextStroke: isTouch ? '2px #7dd3fc' : '3px #7dd3fc', paintOrder: 'stroke fill' }}
        >
          ▶
        </span>
        <span className="font-bold text-amber-300">X{rebirth + 1}</span>
      </div>

      <div
        className={`text-center font-bold text-red-500 ${isTouch ? 'text-sm' : 'text-[1.625rem]'}`}
        style={{ WebkitTextStroke: isTouch ? '1.5px black' : '3px black', paintOrder: 'stroke fill' }}
      >
        Rebirth resets your Age and Level!
      </div>

      <div className="w-full">
        <RebirthLevelBar compact={isTouch} />
      </div>

      <div className={`flex w-full items-stretch justify-center ${isTouch ? 'mb-3 gap-2' : 'mb-5 mt-2 gap-3'}`}>
        <button
          type="button"
          onClick={() => {
            playButtonClick()
            onConfirm()
          }}
          disabled={!canRebirth}
          className={`flex-1 self-center rounded-lg border-2 border-black bg-gradient-to-b from-lime-400 to-green-600 font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'px-2 py-2 text-sm' : 'px-4 py-3 text-lg'}`}
          style={{ WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }}
        >
          {canRebirth ? 'Rebirth' : `Level ${requirement} needed`}
        </button>
      </div>
    </HudModal>
  )
}

function BuxIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// Kill switch for the Bux buy button below: visual-only until a backend can
// fulfil SDK.bux.requestPurchase (server-to-server webhook).
const BUX_BUY_ENABLED = false

function ShopItemCard({ item, isTouch }) {
  const coins = useGameStore((s) => s.coins)
  const buyShopItemWithCoins = useGameStore((s) => s.buyShopItemWithCoins)
  const canAffordCoins = coins >= item.coinsRequired
  const textOutlineLocal = { WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-black shadow-[0_4px_0_rgba(0,0,0,0.4)] ${
        item.featured ? 'bg-gradient-to-b from-amber-300 to-yellow-500' : 'bg-gradient-to-b from-slate-500 to-slate-700'
      }`}
    >
      <div className={`text-center font-black text-white ${isTouch ? 'py-1.5 text-xs' : 'py-2.5 text-lg'}`} style={textOutlineLocal}>
        {item.name}
      </div>

      <div
        className={`flex items-center justify-center ${isTouch ? 'h-16' : 'h-28'}`}
        style={{
          background: item.featured
            ? 'radial-gradient(circle, rgba(255,240,150,0.9), rgba(230,170,20,0.5))'
            : 'radial-gradient(circle, rgba(203,213,225,0.5), rgba(71,85,105,0.4))',
        }}
      >
        {item.iconUrl && <img src={item.iconUrl} alt="" className={isTouch ? 'h-10 w-10' : 'h-16 w-16'} draggable={false} />}
      </div>

      <div className={`flex flex-col items-center ${isTouch ? 'gap-1 p-1.5' : 'gap-1.5 p-2.5'}`}>
        {BUX_BUY_ENABLED && (
          <>
            <button
              type="button"
              disabled
              onClick={() => playButtonClick()}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-black bg-gradient-to-b from-lime-400 to-green-600 font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.4)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'py-1 text-sm' : 'py-2 text-lg'}`}
              style={textOutlineLocal}
            >
              <BuxIcon className={isTouch ? 'h-4 w-4' : 'h-5 w-5'} />
              <span>{formatCompact(item.priceBux)}</span>
            </button>

            <span className={`font-black text-slate-300 ${isTouch ? 'text-[10px]' : 'text-xs'}`}>or</span>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            playButtonClick()
            buyShopItemWithCoins(item.id)
          }}
          disabled={!canAffordCoins}
          className={`flex w-full items-center justify-center gap-1 rounded-lg border-2 border-black bg-gradient-to-b from-amber-300 to-amber-500 font-black text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'py-1 text-sm' : 'py-2 text-lg'}`}
          style={textOutlineLocal}
        >
          <span>🪙</span>
          <span>{formatCompact(item.coinsRequired)}</span>
        </button>
      </div>
    </div>
  )
}

function ShopWindow({ onClose, isTouch }) {
  return (
    <HudModal title="Shop" onClose={onClose} isTouch={isTouch}>
      <div className={`flex w-full ${isTouch ? 'gap-2' : 'gap-4'}`}>
        {SHOP_ITEMS.map((item) => (
          <ShopItemCard key={item.id} item={item} isTouch={isTouch} />
        ))}
      </div>

      <div
        className={`text-center font-black text-white ${isTouch ? 'text-sm' : 'text-xl'}`}
        style={{ WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }}
      >
        Thanks for supporting our game 💖
      </div>
    </HudModal>
  )
}

// Glossy rounded-tile backgrounds for ToolbarButton's optional `tile` prop:
// [top, bottom, border] of the fill gradient.
const TOOLBAR_TILES = {
  pink: ['#ff6fae', '#d63384', '#7a1245'],
  green: ['#6fdc6f', '#2ea043', '#124a1e'],
  purple: ['#a78bfa', '#7c3aed', '#3b1a78'],
  blue: ['#5ec8ff', '#1f8fe0', '#0d3f73'],
}

function ToolbarButton({ icon, label, onClick, isTouch, tile }) {
  const colors = tile ? TOOLBAR_TILES[tile] : null
  const tileStyle = colors
    ? {
        background: `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
        border: `${isTouch ? 2 : 3}px solid ${colors[2]}`,
        boxShadow:
          'inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -4px 0 rgba(0,0,0,0.2), 0 3px 6px rgba(0,0,0,0.4)',
      }
    : undefined

  return (
    <button
      type="button"
      onClick={() => {
        playButtonClick()
        onClick()
      }}
      onMouseEnter={playButtonHover}
      title={`Open ${label}`}
      style={tileStyle}
      className={`pointer-events-auto flex flex-col items-center justify-center gap-1 text-slate-100 transition hover:scale-110 hover:brightness-110 ${
        colors ? 'rounded-xl' : 'rounded-lg'
      } ${isTouch ? (colors ? 'h-16 w-16' : 'h-12 w-12') : colors ? 'h-28 w-28' : 'h-20 w-20'}`}
    >
      <span
        className="leading-none"
        style={{
          fontSize: isTouch ? '2.25rem' : '3rem',
          WebkitTextStroke: '5px black',
          paintOrder: 'stroke fill',
          filter: 'brightness(1.35) saturate(1.3) drop-shadow(0 0 6px rgba(255,255,255,0.5))',
        }}
      >
        {icon}
      </span>
      <span
        className="font-semibold leading-none tracking-wide"
        style={{
          fontSize: isTouch ? '14px' : '1.5rem',
          WebkitTextStroke: '2px black',
          paintOrder: 'stroke fill',
        }}
      >
        {label}
      </span>
    </button>
  )
}

// Duration of the "pop" scale animation played on the coin icon/count
// whenever the coin total goes up.
const COIN_POP_MS = 260

// "x2 Age 0:29" countdown for the Lucky Wheel's Age boost prize — renders
// nothing once the store's ageBoostUntil has passed.
function AgeBoostBadge() {
  const until = useGameStore((s) => s.ageBoostUntil)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (Date.now() >= until) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [until])

  const remaining = Math.ceil((until - now) / 1000)
  if (remaining <= 0) return null
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border-2 border-black bg-black/60 px-3 py-1 text-base font-black text-lime-300"
      style={{ WebkitTextStroke: '1px black', paintOrder: 'stroke fill' }}
    >
      <span aria-hidden="true">🚀</span>
      <span>
        x{AGE_BOOST_MULTIPLIER} Age {mm}:{ss}
      </span>
    </div>
  )
}

// Right-edge, vertically centred: the coins count pill on its own.
function RightCenterCoins() {
  const coins = useGameStore((s) => s.coins)
  const isTouch = useTouchMode()

  const iconRef = useRef(null)
  const numberRef = useRef(null)
  const prevCoinsRef = useRef(coins)

  useEffect(() => {
    if (prevCoinsRef.current !== null && coins !== prevCoinsRef.current) {
      for (const el of [iconRef.current, numberRef.current]) {
        if (!el) continue
        el.style.animation = 'none'
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight // force reflow so the animation restarts
        el.style.animation = `coin-pop ${COIN_POP_MS}ms ease-out`
      }
    }
    prevCoinsRef.current = coins
  }, [coins])

  const coinsPill = (
    <div className={`flex items-center gap-1 text-slate-100 ${isTouch ? 'px-2 py-1.5' : 'gap-2 px-3 py-2'}`}>
      <span
        ref={iconRef}
        aria-hidden="true"
        className={isTouch ? 'text-[2.5rem] leading-none' : 'text-[3.75rem] leading-none'}
        style={{
          display: 'inline-block',
          filter: 'brightness(1.35) saturate(1.3) drop-shadow(0 0 6px rgba(255,210,30,0.6))',
        }}
      >
        🪙
      </span>
      <span
        ref={numberRef}
        className="font-bold tabular-nums"
        style={{
          display: 'inline-block',
          fontSize: isTouch ? '1.7rem' : '2.25rem',
          lineHeight: 1,
          color: '#ffd21e',
          letterSpacing: '-0.02em',
          WebkitTextStroke: isTouch ? '1.5px #000000' : '2px #000000',
          paintOrder: 'stroke fill',
        }}
      >
        {formatCompact(coins)}
      </span>

      <style>{`
        @keyframes coin-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )

  if (isTouch) {
    return (
      <div data-hud="right-center" className="pointer-events-none absolute right-4 top-24 flex flex-col items-end gap-2">
        {coinsPill}
        <AgeBoostBadge />
      </div>
    )
  }

  return (
    <div data-hud="right-center" className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
      {coinsPill}
      <AgeBoostBadge />
    </div>
  )
}

// Left-edge, vertically centred stack: a small toolbar of economy panels
// (Rebirth/Shop).
function LeftCenterControls() {
  const level = useGameStore((s) => s.level)
  const rebirth = useGameStore((s) => s.rebirth)
  const canRebirth = useGameStore((s) => canAcceptRebirth(s.level, s.rebirth))
  const acceptRebirth = useGameStore((s) => s.acceptRebirth)
  const [openWindow, setOpenWindow] = useState(null) // null | 'rebirth' | 'shop'
  const isTouch = useTouchMode()

  const modal = {
    rebirth: (
      <RebirthWindow
        rebirth={rebirth}
        canRebirth={canRebirth}
        isTouch={isTouch}
        onConfirm={() => {
          acceptRebirth()
          setOpenWindow(null)
        }}
        onClose={() => setOpenWindow(null)}
      />
    ),
    shop: <ShopWindow isTouch={isTouch} onClose={() => setOpenWindow(null)} />,
  }[openWindow]

  const portal = modal && createPortal(modal, document.body)

  const goToObby = () => {
    useGameStore.getState().setScene('island')
    resetPlayer({ x: OBBY.x * ISLAND_SCALE, y: SPAWN.y, z: OBBY.signZ * ISLAND_SCALE })
  }

  const goToSpawn = () => {
    useGameStore.getState().setScene('island')
    resetPlayer(SPAWN, SPAWN_FACING)
    syncYawToPlayer()
  }

  const rowClassName = `flex items-center ${isTouch ? 'gap-1.5' : 'flex-wrap justify-center gap-2'}`

  const buttons = (
    <div className="flex flex-col items-center gap-2">
      <div className={rowClassName}>
        <ToolbarButton
          icon="⭐"
          label="Rebirth"
          tile="pink"
          onClick={() => setOpenWindow('rebirth')}
          isTouch={isTouch}
        />
        <ToolbarButton
          icon="🛒"
          label="Shop"
          tile="green"
          onClick={() => setOpenWindow('shop')}
          isTouch={isTouch}
        />
      </div>
      <div className={rowClassName}>
        <ToolbarButton
          icon="🌌"
          label="Obby"
          tile="purple"
          onClick={goToObby}
          isTouch={isTouch}
        />
        <ToolbarButton
          icon="🚩"
          label="Spawn"
          tile="blue"
          onClick={goToSpawn}
          isTouch={isTouch}
        />
      </div>
    </div>
  )

  if (isTouch) {
    return (
      <div data-hud="left-center" className="pointer-events-none absolute left-4 top-24 flex flex-col items-start gap-2">
        {buttons}
        {portal}
      </div>
    )
  }

  return (
    <div data-hud="left-center" className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
      {buttons}
      {portal}
    </div>
  )
}

// Bottom-center, only while riding an Age Machine (see useGameStore's
// ridingAgeMachine) — the sole way out once playerMovement.js has frozen
// the player on the machine's stand.
// Cleared past AGE_MACHINE_RADIUS so the exit spot sits outside the
// machine's own collision circle — landing exactly on it (margin 0) would
// still work since it's non-zero, but this keeps the player from spawning
// right on the boundary.
const RETURN_EXIT_MARGIN = 0.5

function ReturnButton() {
  const riding = useGameStore((s) => s.ridingAgeMachine)
  const exitAgeMachine = useGameStore((s) => s.exitAgeMachine)
  const isTouch = useTouchMode()

  if (riding == null) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center">
      <button
        type="button"
        onClick={() => {
          playButtonClick()
          // Places the player just outside the glass, on the machine's +Z
          // (camera-facing) side — the same side they walked up from to hit
          // Use — rather than leaving them dead-center, where
          // resolveAgeMachineCollision's push-out no-ops (distSq ~ 0).
          const spot = ageMachineSpot(riding)
          const z = spot.z + AGE_MACHINE_RADIUS + RETURN_EXIT_MARGIN
          resetPlayer({ x: spot.x * ISLAND_SCALE, y: spot.topY, z: z * ISLAND_SCALE })
          exitAgeMachine()
        }}
        onMouseEnter={playButtonHover}
        className={`pointer-events-auto rounded-full border-2 border-black bg-gradient-to-b from-sky-400 to-blue-600 font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] transition hover:brightness-110 active:brightness-95 ${
          isTouch ? 'px-6 py-2 text-base' : 'px-10 py-3 text-xl'
        }`}
        style={{ WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }}
      >
        Return
      </button>
    </div>
  )
}

// DOM siblings of the canvas, never drei <Html>. Ported from Ice-Skate's
// components/hud/Hud.jsx; its merchant/hexPad/afk "Press E" proximity
// prompts and death prompt are dropped (this template has no such props and
// no PVP zone) — but entering the Impossible Bridge/Stud Jumps/Tsunami
// Escape obby scenes does reuse the "Press E" mechanism, via InteractPrompt
// below (see systems/scenePortals.js).
export default function Hud() {
  useSettings()

  // background_transparency (0.2–1.0, default 0.9) scales the panel backing
  // rather than replacing it, so the default lands on the 0.4 alpha the HUD
  // was designed with instead of a hard black slab.
  const panelStyle = {
    backgroundColor: `rgba(0, 0, 0, ${(settings.background_transparency * 0.4).toFixed(3)})`,
  }

  const actionResultRef = useRef(null)
  useEffect(() => {
    let lastId = actionResultState.id
    const intervalId = setInterval(() => {
      if (actionResultState.id === lastId) return
      lastId = actionResultState.id
      actionResultRef.current?.show(actionResultState.text, actionResultState.success)
    }, 100)
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 p-4 font-mono text-xs leading-5 text-slate-200">
      {/* First child: the touch look-zone/stick paint beneath the
         interactive HUD elements below so their taps still land. */}
      <TouchControls />

      <LeftCenterControls />

      <RightCenterCoins />

      {/* Top-left identity chip: dev-only diagnostic — renders null
         otherwise. Event-driven, never per frame. */}
      <IdentityChip panelStyle={panelStyle} />

      <AuthPanel panelStyle={panelStyle} />

      {/* Bottom-centre buy/equip result popup — green on success, red with the
         reason on failure. Driven imperatively via actionResultRef; used by
         IslandLandmarks.jsx's Age Machine BuyButton to report "Need N Coins
         to Buy" when a purchase is attempted without enough coins. */}
      <ActionResult ref={actionResultRef} />

      {/* Top-centre level progress bar. DOM sibling of the canvas. */}
      <LevelBar />

      {/* Top-centre "LEVEL UP!" banner. */}
      <LevelUpPopup />

      {/* Top-centre glass-bridge countdown, Bonus Scene only. */}
      <BonusTimer />

      {/* Top-centre multiplayer status pill — renders nothing while
         systems/net.js's stub stays 'idle' (no backend configured). */}
      <NetStatus />

      {/* Per-walk-tick "+N" speed badges around the player. Owns its own
         rAF loop and never re-renders. */}
      <ActionPopups />

      {/* Bottom-center "Return" button — only visible while riding an Age
         Machine, the sole way out of its movement freeze. */}
      <ReturnButton />

      {/* Bottom-center "Press E to ..." pill — armed while standing on one
         of the island's obby entry pads (see systems/scenePortals.js). */}
      <InteractPrompt />

      {/* Lucky Wheel popup — opened with E at the Statue (see
         systems/statueInteract.js). Portals itself to document.body. */}
      <LuckyWheel />

      {/* Start-of-session "Pick your gender!" window over a blurred game.
         Portals itself to document.body and renders nothing once chosen. */}
      <GenderPicker />

      {/* Full-screen "rotate to landscape" gate for touch sessions. Last
         child + highest z-index so it covers the touch controls while up. */}
      <RotatePrompt />
    </div>
  )
}
