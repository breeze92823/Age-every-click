import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { settings } from '../../systems/settingsState.js'
import { playButtonClick, playButtonHover } from '../../systems/sfx.js'
import { useGameStore } from '../../store/useGameStore.js'
import { canAcceptRebirth, rebirthRequirement } from '../../data/progression.js'
import { SHOP_ITEMS } from '../../data/shop.js'
import { makeStudOverlayDataURL } from '../../systems/studTexture.js'
import { formatCompact } from '../../systems/format.js'
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
        <img
          src="/ui/action_popup.png"
          alt=""
          className={isTouch ? 'h-9 w-9' : 'h-[5.5rem] w-[5.5rem]'}
          draggable={false}
        />
        <span className="font-bold text-amber-300">X{rebirth}</span>
        <span
          className={`inline-block font-black leading-none text-white ${isTouch ? 'text-2xl' : 'text-[4.5rem]'}`}
          style={{ WebkitTextStroke: isTouch ? '2px #7dd3fc' : '3px #7dd3fc', paintOrder: 'stroke fill' }}
        >
          ▶
        </span>
        <img
          src="/ui/action_popup.png"
          alt=""
          className={isTouch ? 'h-9 w-9' : 'h-[5.5rem] w-[5.5rem]'}
          draggable={false}
        />
        <span className="font-bold text-amber-300">X{rebirth + 1}</span>
      </div>

      <div
        className={`text-center font-bold text-red-500 ${isTouch ? 'text-sm' : 'text-[1.625rem]'}`}
        style={{ WebkitTextStroke: isTouch ? '1.5px black' : '3px black', paintOrder: 'stroke fill' }}
      >
        Rebirth resets your Speed and Level!
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
  const wins = useGameStore((s) => s.wins)
  const buyShopItemWithWins = useGameStore((s) => s.buyShopItemWithWins)
  const canAffordWins = wins >= item.winsRequired
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
            buyShopItemWithWins(item.id)
          }}
          disabled={!canAffordWins}
          className={`flex w-full items-center justify-center gap-1 rounded-lg border-2 border-black bg-gradient-to-b from-amber-300 to-amber-500 font-black text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'py-1 text-sm' : 'py-2 text-lg'}`}
          style={textOutlineLocal}
        >
          <span>🏆</span>
          <span>{formatCompact(item.winsRequired)}</span>
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

// Tile size (CSS px) for the toolbar buttons' stud overlay.
const TOOLBAR_BUTTON_STUD_PITCH = 14

const REBIRTH_BUTTON_GRADIENT = 'linear-gradient(180deg, #FFA4FA 0%, #FF4BC2 100%)'
const SHOP_BUTTON_GRADIENT = 'linear-gradient(180deg, #ffe9a4 0%, #ff9d00 100%)'

function ToolbarButton({ gradient, studOverlay, icon, label, onClick, isTouch }) {
  return (
    <button
      type="button"
      onClick={() => {
        playButtonClick()
        onClick()
      }}
      onMouseEnter={playButtonHover}
      title={`Open ${label}`}
      className={`pointer-events-auto flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-black text-slate-100 shadow-lg transition hover:scale-110 hover:brightness-110 ${
        isTouch ? 'h-12 w-12' : 'h-20 w-20'
      }`}
      style={{
        backgroundImage: `${studOverlay}, ${gradient}`,
        backgroundRepeat: 'repeat, no-repeat',
        backgroundSize: `${TOOLBAR_BUTTON_STUD_PITCH}px ${TOOLBAR_BUTTON_STUD_PITCH}px, 100% 100%`,
      }}
    >
      <span className={isTouch ? 'text-lg leading-none' : 'text-2xl leading-none'}>{icon}</span>
      <span
        className={isTouch ? 'text-[7px] font-semibold leading-none tracking-wide' : 'text-xs font-semibold tracking-wide'}
        style={{ WebkitTextStroke: isTouch ? '1px black' : '2px black', paintOrder: 'stroke fill' }}
      >
        {label}
      </span>
    </button>
  )
}

// Right-edge, vertically centred: the wins count pill on its own.
function RightCenterWins() {
  const wins = useGameStore((s) => s.wins)
  const isTouch = useTouchMode()

  const winsPill = (
    <div className={`flex items-center gap-1 text-slate-100 ${isTouch ? 'px-2 py-1.5' : 'gap-2 px-3 py-2'}`}>
      <span aria-hidden="true" className={isTouch ? 'text-xl leading-none' : 'text-3xl leading-none'}>
        🪙
      </span>
      <span
        className="font-bold tabular-nums"
        style={{
          fontSize: isTouch ? '0.85rem' : '1.125rem',
          lineHeight: 1,
          color: '#ffd21e',
          letterSpacing: '-0.02em',
          WebkitTextStroke: isTouch ? '1.5px #000000' : '2px #000000',
          paintOrder: 'stroke fill',
        }}
      >
        {formatCompact(wins)}
      </span>
    </div>
  )

  if (isTouch) {
    return (
      <div data-hud="right-center" className="pointer-events-none absolute right-4 top-24 flex flex-col items-end gap-2">
        {winsPill}
      </div>
    )
  }

  return (
    <div data-hud="right-center" className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
      {winsPill}
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
  const studOverlay = useMemo(() => `url(${makeStudOverlayDataURL(TOOLBAR_BUTTON_STUD_PITCH)})`, [])

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

  const buttons = (
    <div className={`flex items-center ${isTouch ? 'gap-1.5' : 'flex-wrap justify-center gap-2'}`}>
      <ToolbarButton
        gradient={REBIRTH_BUTTON_GRADIENT}
        studOverlay={studOverlay}
        icon="⭐"
        label="Rebirth"
        onClick={() => setOpenWindow('rebirth')}
        isTouch={isTouch}
      />
      <ToolbarButton
        gradient={SHOP_BUTTON_GRADIENT}
        studOverlay={studOverlay}
        icon="🛒"
        label="Shop"
        onClick={() => setOpenWindow('shop')}
        isTouch={isTouch}
      />
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

// DOM siblings of the canvas, never drei <Html>. Ported from Ice-Skate's
// components/hud/Hud.jsx; its merchant/hexPad/afk "Press E" proximity
// prompts and death prompt are dropped — this template has no such props,
// no PVP zone, and no held-E interaction system.
export default function Hud() {
  useSettings()

  // background_transparency (0.2–1.0, default 0.9) scales the panel backing
  // rather than replacing it, so the default lands on the 0.4 alpha the HUD
  // was designed with instead of a hard black slab.
  const panelStyle = {
    backgroundColor: `rgba(0, 0, 0, ${(settings.background_transparency * 0.4).toFixed(3)})`,
  }

  return (
    <div className="pointer-events-none absolute inset-0 p-4 font-mono text-xs leading-5 text-slate-200">
      {/* First child: the touch look-zone/stick paint beneath the
         interactive HUD elements below so their taps still land. */}
      <TouchControls />

      <LeftCenterControls />

      <RightCenterWins />

      {/* Top-left identity chip: dev-only diagnostic — renders null
         otherwise. Event-driven, never per frame. */}
      <IdentityChip panelStyle={panelStyle} />

      <AuthPanel panelStyle={panelStyle} />

      {/* Top-centre buy/equip result popup — green on success, red with the
         reason on failure. Driven imperatively; nothing calls it yet in
         this template (no gated purchase can fail silently the way
         Ice-Skate's held-E actions could), kept wired for parity. */}
      <ActionResult />

      {/* Bottom-centre level progress bar. DOM sibling of the canvas. */}
      <LevelBar />

      {/* Top-centre "LEVEL UP!" banner. */}
      <LevelUpPopup />

      {/* Top-centre multiplayer status pill — renders nothing while
         systems/net.js's stub stays 'idle' (no backend configured). */}
      <NetStatus />

      {/* Per-walk-tick "+N" speed badges around the player. Owns its own
         rAF loop and never re-renders. */}
      <ActionPopups />

      {/* Full-screen "rotate to landscape" gate for touch sessions. Last
         child + highest z-index so it covers the touch controls while up. */}
      <RotatePrompt />
    </div>
  )
}
