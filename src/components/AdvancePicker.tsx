import { useState } from 'react'
import { choosesDrawOrigin, skillByName, spellById, spellsFor, TREE_LABELS, type Profile } from '../data'
import RuleText from './RuleText'
import { SpellDetails } from './SpellTag'
import { ADVANCE_TABLE, describeAdvance, learnableSkills, type AdvanceInput } from '../lib/campaign'
import { isMage, memberSkills, type Member } from '../lib/crew'
import DiceInput from './DiceInput'
import { getLocked, setLocked } from '../lib/lockedRolls'

interface Props {
  factionId: string
  profile: Profile
  member: Member
  onApply: (input: AdvanceInput) => void
  /** Préfixe des jets verrouillés (rapport en cours) : jet d'évolution et pioche de sorts une seule fois. */
  lockPrefix?: string
}

/** Montée de niveau : jet sur la table d'évolution, choix éventuels, nouveau sort pour un mage. */
export default function AdvancePicker({ factionId, profile, member, onApply, lockPrefix }: Props) {
  const [roll, setRoll] = useState<number | null>(null)
  const [chosenRoll, setChosenRoll] = useState<number | undefined>()
  const [hit, setHit] = useState<'tir' | 'com' | undefined>()
  const [skill, setSkill] = useState('')
  const [spellId, setSpellId] = useState('')
  const spellsKey = lockPrefix ? `${lockPrefix}:spells:${member.id}:${member.level + 1}` : ''
  const [drawn, setDrawn] = useState<string[] | null>(() => (spellsKey ? getLocked<string[]>(spellsKey) ?? null : null))

  const level = member.level + 1
  const input: AdvanceInput = { roll: roll ?? 0, chosenRoll, hit, skill: skill || undefined, spellId: spellId || undefined }
  const { label, complete } = describeAdvance(input)
  const effective = roll === 10 ? chosenRoll : roll
  const row = ADVANCE_TABLE.find((r) => r.roll === effective)
  const mage = isMage(profile)
  const learnable = learnableSkills(profile, memberSkills(profile, member))
  const spells = spellsFor(factionId, profile.id).filter((sp) => !(member.spellIds ?? []).includes(sp.id))
  // Mage Nécromant : nombre de cartes piochées dans la liste raciale (le reste dans la liste générale).
  const originChoice = mage && choosesDrawOrigin(factionId, profile)
  const racialPool = spells.filter((sp) => sp.factions.includes(factionId))
  const generalPool = spells.filter((sp) => sp.factions.length === 0 && !sp.universal)
  const [racialCount, setRacialCount] = useState(Math.min(3, racialPool.length))
  const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5)
  const drawFive = () => {
    const five = originChoice
      ? [
          ...shuffle(racialPool).slice(0, Math.min(racialCount, racialPool.length)),
          ...shuffle(generalPool).slice(0, 5 - Math.min(racialCount, racialPool.length)),
        ].map((sp) => sp.id)
      : shuffle(spells).slice(0, 5).map((sp) => sp.id)
    if (spellsKey) setLocked(spellsKey, five)
    setDrawn(five)
    setSpellId('')
  }
  const offered = drawn ? spells.filter((sp) => drawn.includes(sp.id)) : spells
  const ready = roll !== null && complete && (!mage || !!spellId)

  return (
    <div className="advance-picker stack">
      <p className="small">
        Passage au <strong>niveau {level}</strong>
        {[4, 7, 10].includes(level) && ` : la figurine gagne une ${level === 4 ? '4e' : level === 7 ? '5e' : '6e'} action à chacune de ses activations.`}
      </p>
      <div className="row wrap">
        <span>Jet sur la table d'évolution :</span>
        <DiceInput
          value={roll}
          onChange={(v) => { if (v !== roll) { setRoll(v); setChosenRoll(undefined); setHit(undefined); setSkill('') } }}
          lockKey={lockPrefix ? `${lockPrefix}:adv:${member.id}:${level}` : undefined}
          label="Jet d'évolution"
        />
      </div>

      <ol className="advance-table">
        {ADVANCE_TABLE.map((r) => (
          <li key={r.roll} className={r.roll === roll ? 'on' : r.roll === chosenRoll ? 'chosen' : ''}>
            <span>{r.roll}</span> {r.label}
          </li>
        ))}
      </ol>

      {roll === 10 && (
        <label className="field">
          <span>Résultat choisi</span>
          <select value={chosenRoll ?? ''} onChange={(e) => { setChosenRoll(Number(e.target.value) || undefined); setHit(undefined); setSkill('') }}>
            <option value="">Choisir…</option>
            {ADVANCE_TABLE.slice(0, 9).map((r) => <option key={r.roll} value={r.roll}>{r.roll} : {r.label}</option>)}
          </select>
        </label>
      )}
      {row?.choice === 'hit' && (
        <div className={`advance-choice ${hit ? 'done' : ''}`} role="group" aria-label="Tir ou corps à corps">
          <strong>{hit ? 'Amélioration choisie :' : 'À choisir : quelle compétence de combat améliorer ?'}</strong>
          <div className="advance-choice-buttons">
            <button type="button" className={`btn ${hit === 'tir' ? 'primary' : ''}`} onClick={() => setHit('tir')}>🏹 Tir<small>-1 au résultat pour toucher au tir</small></button>
            <button type="button" className={`btn ${hit === 'com' ? 'primary' : ''}`} onClick={() => setHit('com')}>⚔ Corps à corps<small>-1 au résultat pour toucher au corps à corps</small></button>
          </div>
        </div>
      )}
      {row?.choice === 'skill' && (
        <label className="field">
          <span>Compétence ({profile.trees.map((t) => TREE_LABELS[t] ?? t).join(', ') || 'aucun arbre'})</span>
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Choisir…</option>
            {profile.trees.map((t) => (
              <optgroup key={t} label={TREE_LABELS[t] ?? t}>
                {learnable.filter((s) => s.tree === t).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {row?.choice === 'skill' && skill && (
        <div className="advance-preview">
          <strong>{skill}</strong>
          <p><RuleText text={skillByName(skill)?.description ?? 'Pas encore de description dans les règles.'} self={skill} /></p>
        </div>
      )}
      {originChoice && !drawn && (
        <div className="draw-origin">
          <p className="small">
            <strong>Mage Nécromant :</strong> choisissez d'où viennent les 5 cartes piochées, entre la liste de sorts Nécromant et la liste générale.
          </p>
          <label className="draw-origin-slider">
            <span>Liste générale : <strong>{5 - racialCount}</strong></span>
            <input
              type="range"
              min={0}
              max={Math.min(5, racialPool.length)}
              step={1}
              value={racialCount}
              onChange={(e) => setRacialCount(Number(e.target.value))}
              aria-label="Nombre de cartes de la liste Nécromant"
            />
            <span>Nécromant : <strong>{racialCount}</strong></span>
          </label>
        </div>
      )}
      {mage && (
        <label className="field">
          <span>Nouveau sort (le mage pioche 5 sorts et en garde un)</span>
          <div className="row">
            <select className="grow" value={spellId} onChange={(e) => setSpellId(e.target.value)}>
              <option value="">Choisir…</option>
              {offered.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.type}, {sp.value}+){originChoice && drawn ? (sp.factions.includes(factionId) ? ' · Nécromant' : ' · générale') : ''}</option>)}
            </select>
            {!drawn && <button type="button" className="btn small" onClick={drawFive}>Piocher 5</button>}
            {drawn && <span className="muted small" data-tip="Pioche faite par le site : elle ne peut plus être refaite.">🔒 5 sorts piochés</span>}
          </div>
        </label>
      )}
      {mage && spellId && spellById(spellId) && (
        <div className="advance-preview">
          <strong>{spellById(spellId)!.name}</strong>
          <SpellDetails spell={spellById(spellId)!} />
        </div>
      )}

      {roll !== null && label && <p className="notice small">Résultat : {label}{spellId ? ` · sort : ${spellById(spellId)?.name}` : ''}</p>}
      <div>
        <button type="button" className="btn primary" disabled={!ready} onClick={() => onApply(input)}>
          Appliquer la montée de niveau
        </button>
      </div>
    </div>
  )
}
