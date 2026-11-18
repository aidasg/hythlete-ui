import { useContext } from 'react';
import { AuthContext } from '@/features/auth/context/authContextValue';
import type { UnitPreferences } from './units';

export function useUnits(): UnitPreferences {
  const profile = useContext(AuthContext)?.session?.profile;
  return { weightUnit: profile?.weight_unit === 'lb' ? 'lb' : 'kg', distanceUnit: profile?.distance_unit === 'mi' ? 'mi' : 'km' };
}
