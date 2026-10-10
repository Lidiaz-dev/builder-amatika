import { useState } from 'react'
import { spellById, spellsFor, TREE_LABELS, type Profile } from '../data'
import { ADVANCE_TABLE, describeAdvance, learnableSkills, type AdvanceInput } from '../lib/campaign'
import { isMage, memberSkills, type Member } from '../lib/crew'
import DiceInput from './DiceInput'

interface Props {
  factionId: string
  profile: Profile
  member: Member
  onApply: (input: AdvanceInput) => void
}

/** Montée de niveau : jet sur la table d'évolution, choix éventuels, nouveau sort pour un mage. */
export default function AdvancePicker({ factionId, profile, member, onApply }: Props) {
  const [roll, setRoll] = useState<number | null>(null)
  const [chosenRoll, setChosenRoll] = useState<number | undefined>()
  const [hit, setHit] = useState<'tir' | 'com' | undefined>()
  const [skill, setSkill] = useState('')
  const [spellId, setSpellId] = useState('')
  const [drawn, setDrawn] = useState<string[] | null>(null)

  const level = member.level + 1
  const input: AdvanceInput = { roll: roll ?? 0, chosenRoll, hit, skill: skill || undefined, spellId: spellId || undefined }
  const { label, complete } = describeAdvance(input)
  const effective = roll === 10 ? chosenRoll : roll
  const row = ADVANCE_TABLE.find((r) => r.roll === effective)
  const mage = isMage(profile)
  const learnable = learnableSkills(profile, memberSkills(profile, member))
  const spells = spellsFor(factionId, profile.id).filter((sp) => !(member.spellIds ?? []).includes(sp.id))
  const drawFive = () => {
    setDrawn([...spells].sort(() => Math.random() - 0.5).slice(0, 5).map((sp) => sp.id))
    setSpellId('')
  }
  const offered = drawn ? spells.filter((sp) => drawn.includes(sp.id)) : spells
  const ready = roll !== null && complete && (!mage || !!spellId)

  return (
    <div className="advance-picker stack">
      <p className="small">
        Passage au <strong>niveau {level}</strong>
        {level === 6 && ' : la figurine gagne une 4e action à chacune de ses activations.'}
      </p>
      <div className="row wrap">
        <span>Jet sur la table d'évolution :</span>
        <DiceInput value={roll} onChange={(v) => { setRoll(v); setChosenRoll(undefined); setHit(undefined); setSkill('') }} />
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
        <div className="segmented" role="group" aria-label="Tir ou corps à corps">
          <button type="button" className={hit === 'tir' ? 'on' : ''} onClick={() => setHit('tir')}>Tir</button>
          <button type="button" className={hit === 'com' ? 'on' : ''} onClick={() => setHit('com')}>Corps à corps</button>
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
      {mage && (
        <label className="field">
          <span>Nouveau sort (le mage pioche 5 sorts et en garde un)</span>
          <div className="row">
            <select className="grow" value={spellId} onChange={(e) => setSpellId(e.target.value)}>
              <option value="">Choisir…</option>
              {offered.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.type}, {sp.value}+)</option>)}
            </select>
            <button type="button" className="btn small" onClick={drawFive}>{drawn ? 'Repiocher 5' : 'Piocher 5'}</button>
            {drawn && <button type="button" className="btn small ghost" onClick={() => setDrawn(null)}>Tous</button>}
          </div>
        </label>
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
