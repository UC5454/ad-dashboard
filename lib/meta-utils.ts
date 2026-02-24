import type { MetaAction } from "@/types/meta";

export function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

export function actionValue(actions: MetaAction[] | undefined, actionType: string): number {
  const target = actions?.find((action) => action.action_type === actionType);
  return target ? Number.parseFloat(target.value || "0") || 0 : 0;
}

export function numeric(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}
