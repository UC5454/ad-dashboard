"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AlertThresholds,
  type BudgetSetting,
} from "@/lib/settings";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function percentValue(rate: number): string {
  return Number.isFinite(rate) ? String(Math.round(rate * 1000) / 10) : "";
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SettingsPage() {
  const [budgets, setBudgets] = useState<BudgetSetting[]>(DEFAULT_SETTINGS.budgets);
  const [defaultFeeRate, setDefaultFeeRate] = useState<number>(DEFAULT_SETTINGS.defaultFeeRate);
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(DEFAULT_SETTINGS.alertThresholds);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const settings = loadSettings();
    setBudgets(settings.budgets);
    setDefaultFeeRate(settings.defaultFeeRate);
    setAlertThresholds(settings.alertThresholds);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const hasEditing = useMemo(() => editingIndex !== null, [editingIndex]);

  const onSaveAll = () => {
    saveSettings({
      budgets,
      defaultFeeRate,
      alertThresholds,
    });
    setToast("保存しました");
    setEditingIndex(null);
  };

  const onAddBudget = () => {
    setBudgets((prev) => [
      ...prev,
      { projectName: "", monthlyBudget: 0, feeRate: defaultFeeRate },
    ]);
    setEditingIndex(budgets.length);
  };

  const onDeleteBudget = (index: number) => {
    setBudgets((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const updateBudget = (index: number, next: Partial<BudgetSetting>) => {
    setBudgets((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const onResetThresholds = () => {
    setAlertThresholds(DEFAULT_SETTINGS.alertThresholds);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {toast}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy">案件別予算設定</h2>
            <p className="mt-1 text-xs text-gray-500">案件名はMeta広告のキャンペーン名に合わせて管理してください。</p>
          </div>
          <button
            type="button"
            onClick={onAddBudget}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + 新規案件追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">案件名</th>
                <th className="px-3 py-2 text-left font-medium">月間予算</th>
                <th className="px-3 py-2 text-left font-medium">手数料率</th>
                <th className="px-3 py-2 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((row, index) => {
                const isEditing = editingIndex === index;
                return (
                  <tr key={`${row.projectName}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={row.projectName}
                          onChange={(event) => updateBudget(index, { projectName: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="案件名を入力"
                        />
                      ) : (
                        <span className={row.projectName ? "text-navy" : "text-gray-400"}>
                          {row.projectName || "未入力"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">¥</span>
                          <input
                            type="number"
                            min={0}
                            value={row.monthlyBudget}
                            onChange={(event) => updateBudget(index, { monthlyBudget: parseNumber(event.target.value) })}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="tabular-nums">{formatCurrency(row.monthlyBudget)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={percentValue(row.feeRate)}
                            onChange={(event) =>
                              updateBudget(index, { feeRate: parseNumber(event.target.value) / 100 })
                            }
                            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          <span className="text-gray-500">%</span>
                        </div>
                      ) : (
                        <span className="tabular-nums">{percentValue(row.feeRate)}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingIndex(isEditing ? null : index)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {isEditing ? "完了" : "編集"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBudget(index)}
                          className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {budgets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    予算設定がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          ※ 案件名はMeta広告のキャンペーン名から自動抽出されます。ここで案件名を追加すると、予算管理の対象になります。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSaveAll}
            className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
          >
            保存
          </button>
          {hasEditing && <span className="text-xs text-gray-500">編集中の行があります</span>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-navy">デフォルト手数料率</h3>
        <p className="mt-1 text-sm text-gray-500">予算未設定の案件に適用される手数料率</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={0}
            step={0.1}
            value={percentValue(defaultFeeRate)}
            onChange={(event) => setDefaultFeeRate(parseNumber(event.target.value) / 100)}
            className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-600">%</span>
          <button
            type="button"
            onClick={onSaveAll}
            className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
          >
            保存
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-navy">アラート閾値設定</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">項目</th>
                <th className="px-3 py-2 text-left font-medium">閾値</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-3 py-2">予算超過アラート（消化率 %）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.budgetOverRate}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          budgetOverRate: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2">予算ペース遅れ（理想の %）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.budgetPaceLagRate}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          budgetPaceLagRate: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-white">
                <td className="px-3 py-2">着地予想超過（予算の倍率）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={alertThresholds.projectedOverMultiplier}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          projectedOverMultiplier: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">x</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2">CPA高騰（平均の倍率）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={alertThresholds.cpaHighMultiplier}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          cpaHighMultiplier: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">x</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-white">
                <td className="px-3 py-2">CV急減（3日平均の %）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.cvDropRate}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          cvDropRate: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2">CPC急騰（3日平均の倍率）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={alertThresholds.cpcSpikeMultiplier}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          cpcSpikeMultiplier: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">x</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-white">
                <td className="px-3 py-2">CPC急落（3日平均の %）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.cpcDropRate}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          cpcDropRate: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2">CPM急騰（3日平均の倍率）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={alertThresholds.cpmSpikeMultiplier}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          cpmSpikeMultiplier: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">x</span>
                  </div>
                </td>
              </tr>
              <tr className="bg-white">
                <td className="px-3 py-2">CV0クリエイティブ消化閾値</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">¥</span>
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.zeroConvSpendThreshold}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          zeroConvSpendThreshold: parseNumber(event.target.value),
                        })
                      }
                      className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </td>
              </tr>
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2">配信停滞（前日IMP比 %）</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={alertThresholds.impDropRate}
                      onChange={(event) =>
                        setAlertThresholds({
                          ...alertThresholds,
                          impDropRate: parseNumber(event.target.value),
                        })
                      }
                      className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onResetThresholds}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            デフォルトに戻す
          </button>
          <button
            type="button"
            onClick={onSaveAll}
            className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
          >
            保存
          </button>
        </div>
      </section>
    </div>
  );
}
