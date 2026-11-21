import { describe, expect, it } from 'vitest';
import { goalError, inputValue, measurementLabel, newGoal, storedValue } from './goalModel';
const units={weightUnit:'lb' as const,distanceUnit:'mi' as const};
describe('goal definitions',()=>{
 it('starts with an explicit athlete-owned direction',()=>{const g=newGoal('2026-11-20');expect(g.role).toBe('primary');expect(g.status).toBe('active');expect(goalError(g)).toMatch(/title/);});
 it('keeps unit conversion out of the persisted goal definition',()=>{expect(storedValue(100,'load_kg',units)).toBeCloseTo(45.359237);expect(inputValue(storedValue(100,'load_kg',units),'load_kg',units)).toBeCloseTo(100);expect(storedValue(10,'distance_m',units)).toBeCloseTo(16093.44);expect(storedValue(45,'time_seconds',units)).toBe(2700);});
 it('requires context for comparable timed efforts',()=>{const g={...newGoal('2026-11-20'),title:'Faster 10K',target:{kind:'numeric',metric:'time_seconds',value:2700}};expect(goalError(g)).toMatch(/distance/);g.target={...g.target,distance_m:10000} as typeof g.target;expect(goalError(g)).toBeUndefined();});
 it('makes manual and estimated coverage visible',()=>{expect(measurementLabel({...newGoal('2026-11-20'),target:{kind:'milestone',label:'First pull-up'}})).toBe('Manual tracking');expect(measurementLabel({...newGoal('2026-11-20'),target:{kind:'numeric',metric:'estimated_1rm_kg'}})).toMatch(/Estimated/);expect(measurementLabel({...newGoal('2026-11-20'),target:{kind:'weekly',metric:'sessions',value:3}})).toMatch(/Automatic/);});
 it('allows maintenance without an arbitrary target',()=>{expect(goalError({...newGoal('2026-11-20','maintenance'),title:'Maintain strength',intent:'maintain'})).toBeUndefined();});
});
