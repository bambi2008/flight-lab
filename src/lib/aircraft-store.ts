import { db } from './db';
import { aircraftProfiles, type AircraftProfile } from './aircraft';
import { parseAircraftProfile } from './aircraft-validation';

export type AircraftRecord = {
  id: string;
  profile: AircraftProfile;
  status: 'draft' | 'published';
  display_order: number;
  revision: number;
};

export async function getAircraftProfiles(): Promise<AircraftProfile[]> {
  if (!db) return aircraftProfiles;
  const { data, error } = await db
    .from('aircraft_profiles')
    .select('profile')
    .eq('status', 'published')
    .order('display_order')
    .order('id')
    .limit(200);
  if (error) throw new Error('机型档案暂时无法加载，请稍后重试。');
  return (data ?? []).map((row) => parseAircraftProfile(row.profile));
}

export async function getAdminAircraftProfiles(): Promise<AircraftRecord[]> {
  if (!db)
    return aircraftProfiles.map((profile, display_order) => ({
      id: profile.id,
      profile,
      status: 'published',
      display_order,
      revision: 1,
    }));
  const { data, error } = await db
    .from('aircraft_profiles')
    .select('id,profile,status,display_order,revision')
    .order('display_order')
    .order('id')
    .limit(200);
  if (error) throw new Error('机型档案加载失败，请检查管理员权限。');
  return ((data ?? []) as AircraftRecord[]).map((row) => ({
    ...row,
    profile: parseAircraftProfile(row.profile, row.status === 'published'),
  }));
}

export async function saveAircraftProfile(
  profile: AircraftProfile,
  status: AircraftRecord['status'],
  displayOrder: number,
  current: AircraftRecord | null,
) {
  if (!db) throw new Error('当前是后台预览，修改不会保存。');
  const validated = parseAircraftProfile(profile, status === 'published');
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000)
    throw new Error('列表顺序应为 0 至 10000 的整数。');
  const values = { id: validated.id, profile: validated, status, display_order: displayOrder };
  const result = current
    ? await db
        .from('aircraft_profiles')
        .update(values)
        .eq('id', current.id)
        .eq('revision', current.revision)
        .select('id')
    : await db.from('aircraft_profiles').insert(values).select('id');
  if (result.error?.code === '23505')
    throw new Error('这个网址名称已经使用，请更换名称或编辑已有档案。');
  if (result.error) throw new Error('档案保存失败，请检查资料完整性和管理员权限。');
  if (!result.data?.length)
    throw new Error('档案已在另一处修改。请先保留当前内容，再重新打开最新版编辑。');
}
