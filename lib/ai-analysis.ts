export interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
}

export interface ClientReportResult {
  summary: string;
  performance: string;
  improvements: string[];
  retrospective: string[];
}

interface OverallProjectInput {
  name: string;
  spend: number;
  cv: number;
  cpa: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

interface DailyInput {
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cv?: number;
}

interface CreativeInput {
  ad_name: string;
  creative_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface ClientProjectInput {
  id?: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface ClientDailyInput {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface ClientCreativeInput {
  ad_id?: string;
  ad_name: string;
  creative_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function n(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? 0 : date.getDay();
}

export function generateOverallAnalysis(projects: OverallProjectInput[]): AnalysisResult {
  if (projects.length === 0) {
    return {
      summary: "案件データがないため、総合分析を実行できません。",
      insights: ["対象期間内に分析対象の案件がありません。"],
      recommendations: ["期間を変更して再分析してください。"],
    };
  }

  const totalSpend = projects.reduce((sum, project) => sum + project.spend, 0);
  const totalCv = projects.reduce((sum, project) => sum + project.cv, 0);
  const overallCpa = totalCv > 0 ? totalSpend / totalCv : 0;

  const byCpa = [...projects].filter((project) => project.cv > 0).sort((a, b) => a.cpa - b.cpa);
  const byCtr = [...projects].sort((a, b) => b.ctr - a.ctr);
  const byCvEfficiency = [...projects].sort((a, b) => {
    const aEff = a.spend > 0 ? a.cv / a.spend : 0;
    const bEff = b.spend > 0 ? b.cv / b.spend : 0;
    return bEff - aEff;
  });

  const bestCpa = byCpa[0];
  const worstCpa = byCpa[byCpa.length - 1];
  const bestCtr = byCtr[0];
  const bestEfficiency = byCvEfficiency[0];

  const insights: string[] = [];
  const recommendations: string[] = [];

  projects.forEach((project) => {
    if (totalSpend <= 0) return;
    const share = (project.spend / totalSpend) * 100;
    insights.push(`${project.name}は総消化額の${formatPercent(share)}を占めています。`);
  });

  if (bestCpa) {
    insights.push(`CPA最良は${bestCpa.name}（${formatCurrency(bestCpa.cpa)}）です。`);
  }
  if (worstCpa && worstCpa !== bestCpa) {
    insights.push(`CPA最悪は${worstCpa.name}（${formatCurrency(worstCpa.cpa)}）です。`);
  }
  if (bestCtr) {
    insights.push(`CTR最高は${bestCtr.name}（${formatPercent(bestCtr.ctr)}）です。`);
  }
  if (bestEfficiency) {
    const efficiency = bestEfficiency.spend > 0 ? (bestEfficiency.cv / bestEfficiency.spend) * 10000 : 0;
    insights.push(`CV効率は${bestEfficiency.name}が最良で、1万円あたり${efficiency.toFixed(1)}件のCVです。`);
  }

  if (worstCpa && overallCpa > 0 && worstCpa.cpa > overallCpa * 1.2) {
    const diff = ((worstCpa.cpa - overallCpa) / overallCpa) * 100;
    recommendations.push(
      `${worstCpa.name}はCPA ${formatCurrency(worstCpa.cpa)}で全体平均${formatCurrency(overallCpa)}比+${formatPercent(diff)}です。` +
        " 1) 低CTRクリエイティブを停止 2) 反応が良い広告セットのオーディエンスを拡張 3) 類似オーディエンスの追加テストを実施してください。",
    );
  }

  if (bestCtr && bestEfficiency && bestCtr.name !== bestEfficiency.name) {
    recommendations.push(
      `${bestCtr.name}の高CTR訴求を${bestEfficiency.name}に横展開し、クリック後CV率を高めるABテスト（LP見出し・ファーストビュー）を実施してください。`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "全体効率は安定しています。CV効率上位案件に対し、日予算を10〜20%増額しつつCPA悪化がないかを日次で確認してください。",
    );
  }

  return {
    summary: `全${projects.length}案件の総消化額は${formatCurrency(totalSpend)}、総CVは${Math.round(totalCv).toLocaleString("ja-JP")}件、平均CPAは${overallCpa > 0 ? formatCurrency(overallCpa) : "-"}です。`,
    insights,
    recommendations,
  };
}

export function generateDailyAnalysis(daily: DailyInput[]): AnalysisResult {
  if (daily.length === 0) {
    return {
      summary: "日次データがないため、日次分析を実行できません。",
      insights: ["対象期間内に配信実績がありません。"],
      recommendations: ["期間を変更して再分析してください。"],
    };
  }

  const rows = [...daily]
    .map((row) => ({
      date_start: row.date_start,
      spend: n(row.spend),
      impressions: n(row.impressions),
      clicks: n(row.clicks),
      ctr: n(row.ctr),
      cv: row.cv ?? 0,
    }))
    .sort((a, b) => a.date_start.localeCompare(b.date_start));

  const insights: string[] = [];
  const recommendations: string[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const current = rows[i];

    if (prev.spend > 0) {
      const spendChange = ((current.spend - prev.spend) / prev.spend) * 100;
      if (Math.abs(spendChange) >= 20) {
        insights.push(`${current.date_start}の消化額は前日比${spendChange >= 0 ? "+" : ""}${formatPercent(spendChange)}です。`);
      }
    }

    if (prev.cv > 0) {
      const cvChange = ((current.cv - prev.cv) / prev.cv) * 100;
      if (Math.abs(cvChange) >= 20) {
        insights.push(`${current.date_start}のCVは前日比${cvChange >= 0 ? "+" : ""}${formatPercent(cvChange)}です。`);
      }
    }
  }

  const weekday = rows.filter((row) => {
    const d = dayOfWeek(row.date_start);
    return d >= 1 && d <= 5;
  });
  const weekend = rows.filter((row) => {
    const d = dayOfWeek(row.date_start);
    return d === 0 || d === 6;
  });

  const weekdayCvRate = weekday.reduce((sum, row) => sum + row.cv, 0) / Math.max(weekday.length, 1);
  const weekendCvRate = weekend.reduce((sum, row) => sum + row.cv, 0) / Math.max(weekend.length, 1);
  if (weekend.length > 0) {
    insights.push(`平日CV平均は${weekdayCvRate.toFixed(1)}件、週末CV平均は${weekendCvRate.toFixed(1)}件です。`);
  }

  const recent = rows.slice(-3);
  if (recent.length >= 3) {
    const diff1 = recent[1].spend - recent[0].spend;
    const diff2 = recent[2].spend - recent[1].spend;
    if (diff1 > 0 && diff2 > 0) {
      insights.push("直近3日間の消化額トレンドは上昇です。");
    } else if (diff1 < 0 && diff2 < 0) {
      insights.push("直近3日間の消化額トレンドは下降です。");
    } else {
      insights.push("直近3日間の消化額トレンドは安定しています。");
    }
  }

  const spendValues = rows.map((row) => row.spend);
  const avgSpend = avg(spendValues);
  const latestSpend = rows[rows.length - 1]?.spend || 0;
  if (avgSpend > 0) {
    const pace = (latestSpend / avgSpend) * 100;
    insights.push(`直近消化ペースは期間平均比${formatPercent(pace - 100)}です。`);
  }

  if (weekday.length > 0 && weekend.length > 0 && weekendCvRate < weekdayCvRate * 0.8) {
    const drop = ((weekdayCvRate - weekendCvRate) / weekdayCvRate) * 100;
    recommendations.push(
      `週末CV平均が平日比-${formatPercent(drop)}のため、週末入札を-15%に設定し、平日へ配信を寄せる配分テストを行ってください。`,
    );
  }

  if (insights.some((line) => line.includes("前日比"))) {
    recommendations.push(
      "前日比20%以上の変動日は、該当日の入札変更ログとクリエイティブ更新履歴を確認し、影響が大きい場合は翌日まで日予算を±10%で調整してください。",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "日次推移は安定しています。直近3日平均の消化額が期間平均比+15%を超えた場合は日予算を10%引き上げ、逆に-15%を下回る場合は入札単価を5%引き上げて検証してください。",
    );
  }

  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalCv = rows.reduce((sum, row) => sum + row.cv, 0);

  return {
    summary: `対象${rows.length}日で消化額${formatCurrency(totalSpend)}、CV${Math.round(totalCv).toLocaleString("ja-JP")}件です。`,
    insights,
    recommendations,
  };
}

export function generateCreativeAnalysis(creatives: CreativeInput[]): AnalysisResult {
  if (creatives.length === 0) {
    return {
      summary: "クリエイティブデータがないため、分析を実行できません。",
      insights: ["対象期間内に配信実績のあるクリエイティブがありません。"],
      recommendations: ["クリエイティブ配信後に再分析してください。"],
    };
  }

  const byPerformance = [...creatives].sort((a, b) => {
    if (b.cv !== a.cv) return b.cv - a.cv;
    return a.cpa - b.cpa;
  });

  const best = byPerformance[0];
  const worst = byPerformance[byPerformance.length - 1];

  const insights: string[] = [];
  const recommendations: string[] = [];

  insights.push(
    `Bestは${best.creative_name || best.ad_name}（CV ${Math.round(best.cv).toLocaleString("ja-JP")}件 / CPA ${best.cv > 0 ? formatCurrency(best.cpa) : "-"} / CTR ${formatPercent(best.ctr)}）です。`,
  );

  if (worst && worst !== best) {
    insights.push(
      `Worstは${worst.creative_name || worst.ad_name}（CV ${Math.round(worst.cv).toLocaleString("ja-JP")}件 / CPA ${worst.cv > 0 ? formatCurrency(worst.cpa) : "-"} / CTR ${formatPercent(worst.ctr)}）です。`,
    );
  }

  const noCvHighSpend = creatives.filter((creative) => creative.cv === 0 && creative.spend >= 5000);
  noCvHighSpend.forEach((creative) => {
    insights.push(`${creative.creative_name || creative.ad_name}はCV 0件で消化額${formatCurrency(creative.spend)}のため停止候補です。`);
  });

  const highCtrLowCv = creatives.filter((creative) => creative.ctr >= 1.5 && creative.cv <= 1 && creative.clicks >= 20);
  highCtrLowCv.forEach((creative) => {
    insights.push(`${creative.creative_name || creative.ad_name}は高CTR (${formatPercent(creative.ctr)}) ですがCVが伸びていません。`);
  });

  if (worst && worst !== best) {
    recommendations.push(
      `${worst.creative_name || worst.ad_name}はCPA ${formatCurrency(worst.cpa)}で成果が低いため、` +
        `クリエイティブ差し替えと同時に配信量を-30%に抑え、7日間の改善検証を実施してください。`,
    );
  }

  if (highCtrLowCv.length > 0) {
    recommendations.push(
      "高CTR低CVの広告は、LPのファーストビュー・フォーム項目数の短縮を優先してABテストを行い、クリック後CV率の改善を測定してください。",
    );
  }

  if (best) {
    recommendations.push(
      `${best.creative_name || best.ad_name}の構図・訴求軸を横展開し、派生クリエイティブを3本追加して配信比率を段階的に引き上げてください。`,
    );
  }

  return {
    summary: `対象${creatives.length}本のクリエイティブを評価し、成果差分と改善優先度を抽出しました。`,
    insights,
    recommendations,
  };
}

export function generateClientReport(
  project: ClientProjectInput,
  daily: ClientDailyInput[],
  creatives: ClientCreativeInput[],
): ClientReportResult {
  const totalSpend = project.spend || daily.reduce((sum, row) => sum + row.spend, 0);
  const totalCv = project.cv || daily.reduce((sum, row) => sum + row.cv, 0);
  const cpa = totalCv > 0 ? totalSpend / totalCv : project.cpa;

  const rankedCreatives = [...creatives].sort((a, b) => {
    if (b.cv !== a.cv) return b.cv - a.cv;
    return a.cpa - b.cpa;
  });

  const bestCreative = rankedCreatives[0];
  const worstCreative = rankedCreatives[rankedCreatives.length - 1];

  const summary =
    totalSpend > 0 || totalCv > 0
      ? `今月の広告配信の結果をご報告いたします。総消化額は${formatCurrency(totalSpend)}、CV数は${Math.round(
          totalCv,
        ).toLocaleString("ja-JP")}件でした。`
      : "今月の広告配信の結果をご報告いたします。対象期間内に配信実績が少ないため、詳細は次回集計でご報告いたします。";

  const performanceParts: string[] = [];
  if (totalCv > 0) {
    performanceParts.push(`CPAは${formatCurrency(cpa)}で推移しています。`);
  } else {
    performanceParts.push("CV獲得が少ないため、次月に向けて改善余地が大きい状況です。");
  }

  if (bestCreative) {
    performanceParts.push(
      `成果が良いクリエイティブは「${bestCreative.creative_name || bestCreative.ad_name}」で、` +
        `CPA ${bestCreative.cv > 0 ? formatCurrency(bestCreative.cpa) : "-"}でした。`,
    );
  }

  if (worstCreative && worstCreative !== bestCreative) {
    performanceParts.push(
      `一方で「${worstCreative.creative_name || worstCreative.ad_name}」はCVが伸びず、` +
        `改善優先度が高い結果です。`,
    );
  }

  const improvements: string[] = [];
  if (worstCreative && worstCreative.cv === 0 && worstCreative.spend >= 3000) {
    improvements.push(
      `CV0で消化額${formatCurrency(worstCreative.spend)}の広告は停止し、成果の良い広告へ予算を再配分いたします。`,
    );
  }
  if (bestCreative) {
    improvements.push(
      `成果の良い訴求軸を横展開し、派生クリエイティブを追加して配信比率を段階的に引き上げます。`,
    );
  }
  improvements.push("ターゲティングの配分を見直し、反応の良いオーディエンスへの配信割合を高めます。");

  const retrospective: string[] = [];
  if (totalCv > 0) {
    retrospective.push("良かった点: 成果の出る訴求軸が明確になり、CV獲得の土台が整いました。");
  } else {
    retrospective.push("良かった点: 配信データの蓄積が進み、次回の改善判断材料が揃いました。");
  }
  retrospective.push("課題: 低効率クリエイティブの整理と、LP導線の改善余地が残っています。");

  return {
    summary,
    performance: performanceParts.join(" "),
    improvements,
    retrospective,
  };
}
