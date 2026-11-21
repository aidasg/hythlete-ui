import { apiClient } from '@/services/api/client';
import type { components } from '@/services/api/types';
import { throwApiResponseError } from '@/services/api/errors';
export type AthleteGoal = components['schemas']['goals.Goal'];
export type GoalDefinition = components['schemas']['goals.Definition'];
export type GoalTarget = components['schemas']['goals.Target'];
export type GoalPortfolio = components['schemas']['goals.Portfolio'];
export type GoalCatalog = components['schemas']['goals.Catalog'];
export type GoalMutation = components['schemas']['goals.Mutation'];
export type GoalProgress = components['schemas']['goals.Progress'];
export type GoalCheckIn = components['schemas']['goals.CheckIn'];
export type CheckInInput = components['schemas']['goals.CheckInInput'];
function data<T>(result: { data?: T; error?: unknown; response: Response }): T {
 if (result.error) throwApiResponseError(result);
 if (!result.data) throw new Error('The goal response was empty. Try again.');
 return result.data;
}
export async function getGoals() { return data(await apiClient.GET('/v1/goals')); }
export async function getGoalCatalog() { return data(await apiClient.GET('/v1/goals/templates')); }
export async function getGoalProgress(id: number) { return data(await apiClient.GET('/v1/goals/{id}/progress', { params: { path: { id } } })); }
export async function getGoalHistory(id: number) { return data(await apiClient.GET('/v1/goals/{id}/history', { params: { path: { id } } })); }
export async function mutateGoal(body: GoalMutation) {
 if (body.action === 'create') return data(await apiClient.POST('/v1/goals', { body }));
 if (body.action === 'priorities') return data(await apiClient.PUT('/v1/goals/priorities', { body }));
 return data(await apiClient.PATCH('/v1/goals/{id}', { params: { path: { id: body.goal_id! } }, body }));
}
export async function saveGoalCheckIn(id: number, body: CheckInInput) {
 const options = { params: { path: { id } }, body };
 return data(body.id ? await apiClient.PATCH('/v1/goals/{id}/check-ins', options) : await apiClient.POST('/v1/goals/{id}/check-ins', options));
}
export function definitionOf(g: AthleteGoal): GoalDefinition {
 return { title: g.title, notes: g.notes, template_code: g.template_code, intent: g.intent, subject: g.subject, target: g.target, starts_on: g.starts_on, deadline: g.deadline, event_name: g.event_name, event_date: g.event_date, role: g.role, rank: g.rank, status: g.status, capabilities: g.capabilities };
}
