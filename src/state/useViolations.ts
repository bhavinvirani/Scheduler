import { useMemo } from 'react';
import { evaluateRules } from '../lib/rules.ts';
import type { Violation } from '../lib/rules.ts';
import { useSchedule } from './ScheduleContext.tsx';
import { useRules } from './RulesContext.tsx';

/**
 * The current rule violations, recomputed only when the schedule or the rules
 * change. The engine is pure, so this memo is the single evaluation point the
 * whole UI (warnings panel, cell markers) reads from.
 */
export function useViolations(): Violation[] {
  const { schedule } = useSchedule();
  const { rules } = useRules();
  return useMemo(() => evaluateRules(schedule, rules), [schedule, rules]);
}
