import { Activity, Bike, Dumbbell, Footprints, MountainSnow, PersonStanding, Waves } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { resolveActivityIdentity } from './activityIdentity';

describe('activity identity', () => {
  it('keeps the catalog variant name and inherits its family icon', () => {
    const activities = [{code:'running',name:'Running'}, {code:'offroad_run',name:'Trail Running',parent_code:'running'}];
    expect(resolveActivityIdentity('offroad_run',activities)).toEqual({name:'Trail Running',Icon:Footprints});
    expect(resolveActivityIdentity('commuting_cycling',[{code:'commuting_cycling',name:'Bike Commuting',parent_code:'cycling'}]))
      .toEqual({name:'Bike Commuting',Icon:Bike});
  });
  it('maps supported families and remains readable without a catalog', () => {
    for (const [code,Icon] of [['cycling',Bike],['trail_running',Footprints],['inline_skating',PersonStanding],['swimming',Waves],['strength_training',Dumbbell],['alpine_skiing',MountainSnow]] as const) {
      expect(resolveActivityIdentity(code).Icon).toBe(Icon);
    }
    expect(resolveActivityIdentity('inline_skating').name).toBe('Inline Skating');
    expect(resolveActivityIdentity('custom_sport')).toEqual({name:'Custom Sport',Icon:Activity});
    expect(resolveActivityIdentity(undefined)).toEqual({name:'Unspecified activity',Icon:Activity});
  });
  it('tolerates malformed parent cycles', () => {
    expect(resolveActivityIdentity('one',[{code:'one',parent_code:'two'},{code:'two',parent_code:'one'}]).Icon).toBe(Activity);
  });
});
