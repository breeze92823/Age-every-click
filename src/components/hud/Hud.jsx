import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { settings } from '../../systems/settingsState.js'
import { playButtonClick, playButtonHover } from '../../systems/sfx.js'
import { useGameStore } from '../../store/useGameStore.js'
import { canAcceptRebirth, rebirthRequirement } from '../../data/progression.js'
import { AURA_TIERS } from '../../data/aura.js'
import { SHOP_ITEMS } from '../../data/shop.js'
import { HEX_SPEED_PAD_TIERS } from '../../data/hexPowerPad.js'
import { makeStudOverlayDataURL } from '../../systems/studTexture.js'
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
// ActionPopups/TouchControls/RotatePrompt pieces, same Rebirth/Aura/Shop
// toolbar+modal pattern, same sound calls. Two things don't carry over as-is
// and are adapted rather than dropped:
//  - Ice-Skate's Aura popup opens by walking up to a merchant NPC, and its
//    Shop button is a kill-switched placeholder. Neither has an equivalent
//    prop in this template, so both are just always-available toolbar
//    buttons here instead, and Shop is left enabled.
//  - Ice-Skate's "Skates" economy (HEX_SPEED_PAD_TIERS) is bought/equipped
//    by walking up to a physical SkateRack prop. This template has no such
//    prop, so it's a new SkatesWindow toolbar button instead — everything
//    else (the tier data, the store actions) is unchanged.
// Speed is not currently earned by any in-game action — the walking-based
// gain from Ice-Skate (systems/speedGain.js) was removed since this game
// has no such mechanic, and no click-to-gain button or Set Speed badge
// exists in this HUD yet.

// 1000 -> "1K", 1500 -> "1.5K", 2_000_000 -> "2M". Trims a trailing ".0".
function formatCompact(n) {
  const abs = Math.abs(n)
  if (abs < 1000) return String(n)
  const units = [
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ]
  const { value, suffix } = units.find((u) => abs >= u.value)
  const scaled = n / value
  const text = scaled.toFixed(1).replace(/\.0$/, '')
  return `${text}${suffix}`
}

// Shared chrome for every left-center HUD popup (Rebirth, Aura, Shop,
// Skates): a transparent panel with the title floating above its top-left
// corner and the close button overhanging its top-right corner.
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

// One row of the Aura popup's tier list: icon on the left, name + strength
// multiplier in the middle, one action button on the right.
function AuraEntry({ tier, index, isTouch }) {
  const wins = useGameStore((s) => s.wins)
  const owned = useGameStore((s) => s.ownedAuras.has(index))
  const equipped = useGameStore((s) => s.equippedAura === index)
  const buyAuraTier = useGameStore((s) => s.buyAuraTier)
  const equipAuraTier = useGameStore((s) => s.equipAuraTier)
  const unequipAuraTier = useGameStore((s) => s.unequipAuraTier)
  const canAfford = wins >= tier.winsRequired
  const textOutlineLocal = { WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }
  return (
    <div
      className={`flex w-full shrink-0 items-center rounded-lg border-2 border-black bg-slate-800/80 ${isTouch ? 'gap-2 p-2' : 'gap-3 p-3'}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-slate-500 bg-slate-950 ${isTouch ? 'h-11 w-11' : 'h-16 w-16'}`}
      >
        <img src={tier.iconUrl} alt="" className="h-full w-full object-cover" draggable={false} loading="lazy" decoding="async" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className={`font-black text-white ${isTouch ? 'text-sm' : 'text-xl'}`} style={textOutlineLocal}>
          {tier.name}
        </span>
        <span className={`font-black text-amber-400 ${isTouch ? 'text-xs' : 'text-lg'}`} style={textOutlineLocal}>
          x{tier.strengthMult} Speed
        </span>
      </div>

      <div className={`flex shrink-0 flex-col ${isTouch ? 'gap-0.5' : 'gap-1'}`}>
        {!owned && (
          <button
            type="button"
            onClick={() => {
              playButtonClick()
              buyAuraTier(index)
            }}
            disabled={!canAfford}
            className={`flex items-center justify-center gap-1 rounded-md border-2 border-black bg-gradient-to-b from-amber-300 to-amber-500 font-black text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'px-1.5 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
            style={textOutlineLocal}
          >
            <span>🏆</span>
            <span>{formatCompact(tier.winsRequired)}</span>
          </button>
        )}
        {owned && !equipped && (
          <button
            type="button"
            onClick={() => {
              playButtonClick()
              equipAuraTier(index)
            }}
            className={`flex items-center justify-center rounded-md border-2 border-black bg-gradient-to-b from-lime-400 to-green-600 font-black text-white transition hover:brightness-110 active:brightness-95 ${isTouch ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
            style={textOutlineLocal}
          >
            Equip
          </button>
        )}
        {owned && equipped && (
          <>
            <button
              type="button"
              disabled
              className={`flex cursor-default items-center gap-1 rounded-md border-2 border-black bg-gradient-to-b from-sky-400 to-blue-600 font-black text-white ${isTouch ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
              style={textOutlineLocal}
            >
              <span>✓</span>
              <span>Equipped</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playButtonClick()
                unequipAuraTier(index)
              }}
              className={`flex items-center justify-center rounded-md border-2 border-black bg-gradient-to-b from-rose-400 to-rose-600 font-black text-white transition hover:brightness-110 active:brightness-95 ${isTouch ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
              style={textOutlineLocal}
            >
              Unequip
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AuraWindow({ onClose, isTouch }) {
  return (
    <HudModal title="Aura" onClose={onClose} isTouch={isTouch}>
      <div className={`w-full overflow-y-auto ${isTouch ? 'max-h-[38vh] pr-1' : 'max-h-[26rem] pr-2'}`}>
        <div className={`flex flex-col ${isTouch ? 'gap-1.5' : 'gap-2.5'}`}>
          {AURA_TIERS.map((tier, index) => (
            <AuraEntry key={tier.name} tier={tier} index={index} isTouch={isTouch} />
          ))}
        </div>
      </div>
    </HudModal>
  )
}

// One row of the Skates popup's tier list — same shape as AuraEntry, over
// HEX_SPEED_PAD_TIERS instead. This is this template's stand-in for
// Ice-Skate's physical SkateRack prop.
function SkateEntry({ tier, index, isTouch }) {
  const wins = useGameStore((s) => s.wins)
  const owned = useGameStore((s) => s.ownedHexPads.has(index))
  const equipped = useGameStore((s) => s.equippedHexPad === index)
  const buyHexPad = useGameStore((s) => s.buyHexPad)
  const equipHexPad = useGameStore((s) => s.equipHexPad)
  const canAfford = wins >= tier.winsRequired
  const textOutlineLocal = { WebkitTextStroke: isTouch ? '1px black' : '1.5px black', paintOrder: 'stroke fill' }
  return (
    <div
      className={`flex w-full shrink-0 items-center rounded-lg border-2 border-black bg-slate-800/80 ${isTouch ? 'gap-2 p-2' : 'gap-3 p-3'}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-md border-2 border-slate-500 ${isTouch ? 'h-11 w-11' : 'h-16 w-16'}`}
        style={{ background: tier.beamColor }}
      />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className={`font-black text-white ${isTouch ? 'text-sm' : 'text-xl'}`} style={textOutlineLocal}>
          Skate Tier {index + 1}
        </span>
        <span className={`font-black text-amber-400 ${isTouch ? 'text-xs' : 'text-lg'}`} style={textOutlineLocal}>
          +{formatCompact(tier.speedPerGain)} Speed/click
        </span>
      </div>

      <div className={`flex shrink-0 flex-col ${isTouch ? 'gap-0.5' : 'gap-1'}`}>
        {!owned && (
          <button
            type="button"
            onClick={() => {
              playButtonClick()
              buyHexPad(index)
            }}
            disabled={!canAfford}
            className={`flex items-center justify-center gap-1 rounded-md border-2 border-black bg-gradient-to-b from-amber-300 to-amber-500 font-black text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${isTouch ? 'px-1.5 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
            style={textOutlineLocal}
          >
            <span>🏆</span>
            <span>{formatCompact(tier.winsRequired)}</span>
          </button>
        )}
        {owned && !equipped && (
          <button
            type="button"
            onClick={() => {
              playButtonClick()
              equipHexPad(index)
            }}
            className={`flex items-center justify-center rounded-md border-2 border-black bg-gradient-to-b from-lime-400 to-green-600 font-black text-white transition hover:brightness-110 active:brightness-95 ${isTouch ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
            style={textOutlineLocal}
          >
            Equip
          </button>
        )}
        {owned && equipped && (
          <button
            type="button"
            disabled
            className={`flex cursor-default items-center gap-1 rounded-md border-2 border-black bg-gradient-to-b from-sky-400 to-blue-600 font-black text-white ${isTouch ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'}`}
            style={textOutlineLocal}
          >
            <span>✓</span>
            <span>Equipped</span>
          </button>
        )}
      </div>
    </div>
  )
}

function SkatesWindow({ onClose, isTouch }) {
  return (
    <HudModal title="Skates" onClose={onClose} isTouch={isTouch}>
      <div className={`w-full overflow-y-auto ${isTouch ? 'max-h-[38vh] pr-1' : 'max-h-[26rem] pr-2'}`}>
        <div className={`flex flex-col ${isTouch ? 'gap-1.5' : 'gap-2.5'}`}>
          {HEX_SPEED_PAD_TIERS.map((tier, index) => (
            <SkateEntry key={index} tier={tier} index={index} isTouch={isTouch} />
          ))}
        </div>
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
const AURA_BUTTON_GRADIENT = 'linear-gradient(180deg, #a4fad4 0%, #1fbf7a 100%)'
const SHOP_BUTTON_GRADIENT = 'linear-gradient(180deg, #ffe9a4 0%, #ff9d00 100%)'
const SKATES_BUTTON_GRADIENT = 'linear-gradient(180deg, #a4d8fa 0%, #1f8dbf 100%)'

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

// Left-edge, vertically centred stack: wins count above, a small toolbar of
// economy panels below (Rebirth/Aura/Shop/Skates).
function LeftCenterControls() {
  const wins = useGameStore((s) => s.wins)
  const level = useGameStore((s) => s.level)
  const rebirth = useGameStore((s) => s.rebirth)
  const canRebirth = useGameStore((s) => canAcceptRebirth(s.level, s.rebirth))
  const acceptRebirth = useGameStore((s) => s.acceptRebirth)
  const [openWindow, setOpenWindow] = useState(null) // null | 'rebirth' | 'aura' | 'shop' | 'skates'
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
    aura: <AuraWindow isTouch={isTouch} onClose={() => setOpenWindow(null)} />,
    shop: <ShopWindow isTouch={isTouch} onClose={() => setOpenWindow(null)} />,
    skates: <SkatesWindow isTouch={isTouch} onClose={() => setOpenWindow(null)} />,
  }[openWindow]

  const portal = modal && createPortal(modal, document.body)

  const winsPill = (
    <div className={`flex items-center gap-1 text-slate-100 ${isTouch ? 'px-2 py-1.5' : 'gap-2 px-3 py-2'}`}>
      <img src="/ui/xp_cup.png" alt="" className={isTouch ? 'h-5 w-5' : 'h-8 w-8'} draggable={false} />
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
        gradient={AURA_BUTTON_GRADIENT}
        studOverlay={studOverlay}
        icon="✨"
        label="Aura"
        onClick={() => setOpenWindow('aura')}
        isTouch={isTouch}
      />
      <ToolbarButton
        gradient={SKATES_BUTTON_GRADIENT}
        studOverlay={studOverlay}
        icon="⛸️"
        label="Skates"
        onClick={() => setOpenWindow('skates')}
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
        {winsPill}
        {buttons}
        {portal}
      </div>
    )
  }

  return (
    <div data-hud="left-center" className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
      {winsPill}
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
