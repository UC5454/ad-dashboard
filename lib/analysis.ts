import type { MetaAction, MetaCampaignInsights, MetaInsights } from "@/types/meta";

function readActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  const action = actions?.find((item) => item.action_type === actionType);
  return action ? Number.parseFloat(action.value || "0") || 0 : 0;
}

export function generateAccountAnalysis(
  data: MetaInsights,
  campaigns: MetaCampaignInsights[],
): string[] {
  const comments: string[] = [];

  const ctr = Number.parseFloat(data.ctr || "0") || 0;
  if (ctr > 2) comments.push(`CTRが${ctr.toFixed(1)}%と高水準。クリエイティブの反応が良好`);
  if (ctr < 0.5) comments.push(`CTRが${ctr.toFixed(1)}%と低め。ターゲティングの見直しを推奨`);

  const spend = Number.parseFloat(data.spend || "0") || 0;
  const clicks = Number.parseFloat(data.clicks || "0") || 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  if (cpc > 200) comments.push(`CPCが¥${Math.round(cpc)}と高め。入札戦略の最適化を検討`);
  if (cpc > 0 && cpc < 80) comments.push(`CPCが¥${Math.round(cpc)}と効率的`);

  const cvCount = readActionValue(data.actions, "offsite_conversion.fb_pixel_custom");
  if (cvCount > 0) {
    const cpa = spend / cvCount;
    if (cpa < 200) comments.push(`CV単価¥${Math.round(cpa)}で非常に効率的な獲得`);
    if (cpa > 500) comments.push(`CV単価¥${Math.round(cpa)}。LP改善またはターゲット見直しを推奨`);
  }

  const freq = Number.parseFloat(data.frequency || "0") || 0;
  if (freq > 3) comments.push(`フリークエンシー${freq.toFixed(1)}回。広告疲れの可能性あり`);

  if (campaigns.length > 1) {
    const sorted = [...campaigns].sort(
      (a, b) => (Number.parseFloat(b.spend || "0") || 0) - (Number.parseFloat(a.spend || "0") || 0),
    );
    const top = sorted[0];
    comments.push(
      `最大消化: ${top.campaign_name}（¥${Math.round(Number.parseFloat(top.spend || "0") || 0).toLocaleString("ja-JP")}）`,
    );
  }

  if (comments.length === 0) {
    comments.push("現在の配信データでは大きな異常は検知されていません。");
  }

  return comments;
}
