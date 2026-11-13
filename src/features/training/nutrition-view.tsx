'use client';
import { Apple, ChevronDown, Clock3, Droplets, Lightbulb, Pill, ShieldAlert, UtensilsCrossed } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { NUTRITION_EVIDENCE, nutritionGuidance, type Goal } from '@/shared/program';
import { EnergyPanel } from './energy-panel';

// Short, evidence-based eating guidance (WHO, ISSN, ACSM/AND/DC, EFSA). General advice for healthy adults only.
export function NutritionView() {
  const { data } = useApp(); const tt = useTrainingLanguage();
  const food = nutritionGuidance(data.measurements[0]?.weightKg ?? null, (data.profile?.goal ?? 'general_fitness') as Goal);
  const list = (o: Record<string, string>) => <ul className="cue-list">{Object.values(o).map(x => <li key={x}>{x}</li>)}</ul>;
  return <div className="nutrition-view">
    <EnergyPanel/>
    {/* long evidence-based guidance stays one tap away so the tab is not a wall of text */}
    <details className="tips-fold"><summary><Lightbulb size={20}/><span>{tt.ux.nutritionTips}</span><ChevronDown className="fold-chev" size={20}/></summary>
    <section className="panel"><h2><Apple size={18}/> {tt.yourNumbers}</h2>
      {food.proteinG ? <ul className="cue-list">
        <li>{fill(tt.proteinLine, { min: food.proteinG[0], max: food.proteinG[1], per: `${food.proteinPerKg[0]}–${food.proteinPerKg[1]}` })}</li>
        <li>{fill(tt.waterLine, { min: food.waterL![0], max: food.waterL![1] })}</li>
      </ul> : <p className="explain-box">{tt.nutritionNoWeight}</p>}
      <p>{tt.energy[food.energy as keyof typeof tt.energy]}</p></section>
    <div className="nutrition-grid">
      <section className="panel"><h3><UtensilsCrossed size={16}/> {tt.plateTitle}</h3>{list(tt.plate)}<p className="muted small">{tt.foodExamples}</p></section>
      <section className="panel"><h3><Clock3 size={16}/> {tt.timingTitle}</h3>{list(tt.timing)}</section>
      <section className="panel"><h3><Droplets size={16}/> {tt.limitsTitle}</h3>{list(tt.limits)}</section>
      <section className="panel"><h3><Pill size={16}/> {tt.supplementsTitle}</h3><p>{tt.supplements}</p></section>
    </div>
    <p className="explain-box"><ShieldAlert size={16}/> {tt.nutritionNote}</p>
    <details className="evidence"><summary>{tt.evidenceNutrition}</summary><ul lang="en">{NUTRITION_EVIDENCE.map(x => <li key={x}>{x}</li>)}</ul></details>
    </details>
  </div>;
}
