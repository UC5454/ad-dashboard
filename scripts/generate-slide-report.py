#!/usr/bin/env python3
"""
広告レポートスライド生成スクリプト
標準入力からJSONデータを受け取り、Excel風の表・グラフを画像化 → Google Slidesに貼り付け
結果のURLをJSON形式で標準出力に返す

使い方:
  echo '{"projectName":"...", ...}' | python3 generate-slide-report.py
"""

import json
import os
import subprocess
import sys
import tempfile

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

plt.rcParams["font.family"] = "Hiragino Sans"
plt.rcParams["axes.unicode_minus"] = False

# --- カラーパレット ---
NAVY = "#1B2A4A"
BLUE = "#2C5282"
LIGHT_BLUE = "#4299E1"
LIGHT_GRAY = "#F8FAFE"
MID_GRAY = "#667A8A"
WHITE = "#FFFFFF"
GREEN = "#059669"
AMBER = "#D97706"
RED = "#DC2626"

NAVY_RGB = {"red": 0.106, "green": 0.165, "blue": 0.29}
BLUE_RGB = {"red": 0.173, "green": 0.322, "blue": 0.51}
WHITE_RGB = {"red": 1, "green": 1, "blue": 1}
LGRAY_RGB = {"red": 0.89, "green": 0.91, "blue": 0.96}


def fmt_currency(v):
    return f"¥{int(v):,}"

def fmt_pct(v):
    return f"{v:.1f}%"

def fmt_num(v):
    return f"{int(v):,}"


# ===== 画像生成関数 =====

def create_kpi_image(data, output_path):
    fig, ax = plt.subplots(figsize=(12, 3.5), facecolor=WHITE)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3.5)
    ax.axis("off")

    p = data["project"]
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    spend_fee = apply_fee(p["spend"], fee_rate, fee_method)
    cpc = p["spend"] / p["clicks"] if p.get("clicks", 0) > 0 else 0

    metrics = [
        ("消化額（Fee込）", fmt_currency(spend_fee)),
        ("CV数", f'{int(p.get("cv", 0))}件'),
        ("CPA", fmt_currency(p["cpa"]) if p.get("cv", 0) > 0 else "-"),
        ("CTR", fmt_pct(p.get("ctr", 0))),
        ("CPC", fmt_currency(cpc)),
    ]
    roas = p.get("purchase_roas")
    if isinstance(roas, (int, float)) and roas > 0:
        metrics.append(("ROAS", f"{roas:.2f}x"))

    box_w = 1.8 if len(metrics) <= 5 else 1.5
    gap = 0.15
    start_x = (12 - (box_w * len(metrics) + gap * (len(metrics) - 1))) / 2

    for i, (label, value) in enumerate(metrics):
        x = start_x + i * (box_w + gap)
        ax.add_patch(plt.Rectangle((x, 0.4), box_w, 2.6, linewidth=0, facecolor=LIGHT_GRAY))
        ax.add_patch(plt.Rectangle((x, 0.4), box_w, 2.6, linewidth=1, edgecolor="#E2E8F0", facecolor="none"))
        ax.add_patch(plt.Rectangle((x, 2.85), box_w, 0.15, linewidth=0, facecolor=BLUE))
        ax.text(x + box_w / 2, 2.3, label, ha="center", va="center", fontsize=9, color=MID_GRAY)
        ax.text(x + box_w / 2, 1.4, value, ha="center", va="center", fontsize=16, fontweight="bold", color=NAVY)

    fig.tight_layout(pad=0.3)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_budget_progress(data, output_path):
    p = data["project"]
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    budget = data.get("monthlyBudget") or 0
    spent = apply_fee(p["spend"], fee_rate, fee_method)

    if budget <= 0:
        # 予算未設定時はスキップ
        fig, ax = plt.subplots(figsize=(12, 2), facecolor=WHITE)
        ax.axis("off")
        ax.text(6, 1, "月間予算未設定", ha="center", va="center", fontsize=14, color=MID_GRAY)
        fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
        plt.close(fig)
        return

    rate = (spent / budget) * 100
    import datetime
    now = datetime.datetime.now()
    day = now.day
    days_in_month = 31  # 簡易
    ideal = (day / days_in_month) * 100

    fig, ax = plt.subplots(figsize=(12, 2.5), facecolor=WHITE)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 2.5)
    ax.axis("off")

    ax.add_patch(plt.Rectangle((0.5, 0.8), 11, 0.6, linewidth=0, facecolor="#E2E8F0"))
    bar_width = min(11 * (rate / 100), 11)
    bar_color = BLUE if rate <= ideal * 1.15 else AMBER if rate <= ideal * 1.3 else RED
    ax.add_patch(plt.Rectangle((0.5, 0.8), bar_width, 0.6, linewidth=0, facecolor=bar_color))

    ideal_x = 0.5 + 11 * (ideal / 100)
    ax.plot([ideal_x, ideal_x], [0.6, 1.6], color=MID_GRAY, linewidth=2, linestyle="--")
    ax.text(ideal_x, 1.7, f"理想 {ideal:.1f}%", ha="center", fontsize=8, color=MID_GRAY)

    ax.text(0.5, 2.1, f"月間予算: {fmt_currency(budget)}", fontsize=12, fontweight="bold", color=NAVY)
    ax.text(6, 2.1, f"消化額(Fee込): {fmt_currency(spent)}　({rate:.1f}%)", fontsize=11, color=NAVY)

    projected = spent / (day / days_in_month) if day > 0 else 0
    ax.text(0.5, 0.2, f"着地予想: {fmt_currency(int(projected))}　残予算: {fmt_currency(int(budget - spent))}", fontsize=9, color=MID_GRAY)

    fig.tight_layout(pad=0.3)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_daily_chart(data, output_path):
    daily = data.get("daily", [])
    if not daily:
        _empty_chart(output_path, "日次データなし")
        return

    dates = [d.get("date_start", "")[-5:] for d in daily]
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    spends = [apply_fee(d.get("spend", 0), fee_rate, fee_method) / 1000 for d in daily]
    cvs = [d.get("cv", 0) for d in daily]

    fig, ax1 = plt.subplots(figsize=(12, 5), facecolor=WHITE)
    x = np.arange(len(dates))

    ax1.bar(x, spends, color=LIGHT_BLUE, alpha=0.7, width=0.6, label="消化額（千円）", zorder=2)
    ax1.set_ylabel("消化額（千円）", color=NAVY, fontsize=11)
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, fontsize=9, color=MID_GRAY)
    ax1.set_facecolor(WHITE)
    ax1.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)
    for sp in ["top", "right"]:
        ax1.spines[sp].set_visible(False)
    ax1.spines["left"].set_color("#E2E8F0")
    ax1.spines["bottom"].set_color("#E2E8F0")

    ax2 = ax1.twinx()
    ax2.plot(x, cvs, color=GREEN, linewidth=2.5, marker="o", markersize=6, label="CV数", zorder=3)
    ax2.set_ylabel("CV数", color=GREEN, fontsize=11)
    ax2.tick_params(axis="y", colors=GREEN)
    ax2.spines["right"].set_color(GREEN)
    for sp in ["top", "left", "bottom"]:
        ax2.spines[sp].set_visible(False)

    for i, cv in enumerate(cvs):
        ax2.annotate(str(int(cv)), (x[i], cv), textcoords="offset points", xytext=(0, 10),
                     ha="center", fontsize=8, color=GREEN, fontweight="bold")

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=9, framealpha=0.9)

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_daily_table(data, output_path):
    daily = data.get("daily", [])
    if not daily:
        _empty_chart(output_path, "日次データなし")
        return

    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")

    headers = ["日付", "消化額", "Fee込", "IMP", "クリック", "CTR", "CV", "CPA"]
    rows = []
    for d in daily:
        spend = d.get("spend", 0)
        rows.append([
            d.get("date_start", "")[-5:],
            fmt_currency(spend),
            fmt_currency(apply_fee(spend, fee_rate, fee_method)),
            fmt_num(d.get("impressions", 0)),
            fmt_num(d.get("clicks", 0)),
            fmt_pct(d.get("ctr", 0)),
            str(int(d.get("cv", 0))),
            fmt_currency(d.get("cpa", 0)) if d.get("cv", 0) > 0 else "-",
        ])

    _render_table(output_path, headers, rows)


def create_campaign_table(data, output_path):
    campaigns = data.get("campaigns", [])
    if not campaigns:
        _empty_chart(output_path, "キャンペーンデータなし")
        return

    headers = ["キャンペーン名", "消化額", "IMP", "クリック", "CTR", "CV", "CPA"]
    rows = []
    for c in sorted(campaigns, key=lambda x: x.get("spend", 0), reverse=True)[:10]:
        rows.append([
            c.get("campaign_name", ""),
            fmt_currency(c.get("spend", 0)),
            fmt_num(c.get("impressions", 0)),
            fmt_num(c.get("clicks", 0)),
            fmt_pct(c.get("ctr", 0)),
            str(int(c.get("cv", 0))),
            fmt_currency(c.get("cpa", 0)) if c.get("cv", 0) > 0 else "-",
        ])

    _render_table(output_path, headers, rows, col_widths=[0.24, 0.13, 0.13, 0.1, 0.1, 0.08, 0.13])


def create_campaign_chart(data, output_path):
    campaigns = data.get("campaigns", [])
    if not campaigns:
        _empty_chart(output_path, "キャンペーンデータなし")
        return

    top = sorted(campaigns, key=lambda x: x.get("spend", 0), reverse=True)[:8]
    names = [c.get("campaign_name", "")[:20] for c in top]
    spends = [c.get("spend", 0) / 1000 for c in top]
    cvs = [c.get("cv", 0) for c in top]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5), facecolor=WHITE)
    y = np.arange(len(names))

    ax1.barh(y, spends, color=BLUE, alpha=0.8, height=0.6)
    ax1.set_yticks(y)
    ax1.set_yticklabels(names, fontsize=9, color=NAVY)
    ax1.set_xlabel("消化額（千円）", fontsize=10, color=NAVY)
    ax1.set_title("消化額比較", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax1.invert_yaxis()
    for sp in ["top", "right"]:
        ax1.spines[sp].set_visible(False)
    ax1.grid(axis="x", color="#E2E8F0", linewidth=0.5)
    for i, v in enumerate(spends):
        ax1.text(v + 3, i, f"¥{int(v)}K", va="center", fontsize=8, color=NAVY)

    colors = [GREEN if c.get("cpa", 99999) < 8000 else AMBER if c.get("cpa", 99999) < 10000 else RED for c in top]
    ax2.barh(y, cvs, color=colors, alpha=0.8, height=0.6)
    ax2.set_yticks(y)
    ax2.set_yticklabels(names, fontsize=9, color=NAVY)
    ax2.set_xlabel("CV数", fontsize=10, color=NAVY)
    ax2.set_title("CV数比較", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax2.invert_yaxis()
    for sp in ["top", "right"]:
        ax2.spines[sp].set_visible(False)
    ax2.grid(axis="x", color="#E2E8F0", linewidth=0.5)
    for i, v in enumerate(cvs):
        ax2.text(v + 0.3, i, str(int(v)), va="center", fontsize=8, color=NAVY)

    fig.tight_layout(pad=1.5)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_device_chart(data, output_path):
    devices = data.get("deviceBreakdown", [])
    if not devices:
        _empty_chart(output_path, "デバイスデータなし")
        return

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4), facecolor=WHITE, gridspec_kw={"width_ratios": [1, 1.5]})

    labels = [d.get("device", "") for d in devices]
    total_spend = sum(d.get("spend", 0) for d in devices)
    shares = [(d.get("spend", 0) / total_spend * 100) if total_spend > 0 else 0 for d in devices]
    colors_pie = [BLUE, LIGHT_BLUE, "#90CDF4", "#BEE3F8", "#E2E8F0"][:len(devices)]

    wedges, texts, autotexts = ax1.pie(
        shares, labels=labels, autopct="%1.1f%%", startangle=90,
        colors=colors_pie, textprops={"fontsize": 10, "color": NAVY},
        pctdistance=0.7, wedgeprops={"edgecolor": WHITE, "linewidth": 2})
    for t in autotexts:
        t.set_fontweight("bold")
        t.set_color(WHITE)
    ax1.set_title("デバイス構成比", fontsize=12, fontweight="bold", color=NAVY, pad=10)

    ax2.axis("off")
    headers = ["デバイス", "消化額", "CV", "CPA", "構成比"]
    rows = []
    for i, d in enumerate(devices):
        rows.append([
            d.get("device", ""),
            fmt_currency(d.get("spend", 0)),
            str(int(d.get("cv", 0))),
            fmt_currency(d.get("cpa", 0)) if d.get("cv", 0) > 0 else "-",
            fmt_pct(shares[i]),
        ])
    table = ax2.table(cellText=rows, colLabels=headers, loc="center", cellLoc="center",
                      colWidths=[0.2, 0.2, 0.1, 0.2, 0.15])
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2.0)
    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#E2E8F0")
        if row == 0:
            cell.set_facecolor(NAVY)
            cell.set_text_props(color=WHITE, fontweight="bold")
        else:
            cell.set_facecolor(WHITE if row % 2 == 1 else "#F7FAFC")

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_demographics_chart(data, output_path):
    demo = data.get("demographicBreakdown", [])
    if not demo:
        _empty_chart(output_path, "属性データなし")
        return

    # 年齢×性別のCV集計
    age_gender_cv = {}
    for d in demo:
        age = d.get("age", "unknown")
        gender = d.get("gender", "unknown")
        cv = d.get("cv", 0)
        if age not in age_gender_cv:
            age_gender_cv[age] = {}
        age_gender_cv[age][gender] = age_gender_cv[age].get(gender, 0) + cv

    ages = sorted(age_gender_cv.keys())
    genders = sorted(set(g for a in age_gender_cv.values() for g in a.keys()))

    fig, ax = plt.subplots(figsize=(10, 5), facecolor=WHITE)
    x = np.arange(len(ages))
    width = 0.5
    bottom = np.zeros(len(ages))
    colors_g = [BLUE, "#F687B3", GREEN, AMBER]

    for gi, gender in enumerate(genders):
        vals = [age_gender_cv.get(age, {}).get(gender, 0) for age in ages]
        ax.bar(x, vals, width, bottom=bottom, label=gender, color=colors_g[gi % len(colors_g)], alpha=0.85, zorder=2)
        bottom += np.array(vals)

    ax.set_ylabel("CV数", fontsize=11, color=NAVY)
    ax.set_xlabel("年齢層", fontsize=11, color=NAVY)
    ax.set_xticks(x)
    ax.set_xticklabels(ages, fontsize=10, color=NAVY)
    ax.legend(fontsize=10, framealpha=0.9)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)

    for i in range(len(ages)):
        total = int(bottom[i])
        ax.text(x[i], total + 0.5, str(total), ha="center", fontsize=9, fontweight="bold", color=NAVY)

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


# ===== ヘルパー =====

def apply_fee(spend, fee_rate, method):
    if method == "margin":
        return spend / (1 - fee_rate / 100) if fee_rate < 100 else spend
    else:
        return spend * (1 + fee_rate / 100)


def _empty_chart(path, msg):
    fig, ax = plt.subplots(figsize=(10, 3), facecolor=WHITE)
    ax.axis("off")
    ax.text(5, 1.5, msg, ha="center", va="center", fontsize=14, color=MID_GRAY)
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def _render_table(path, headers, rows, col_widths=None):
    n_rows = len(rows)
    fig_h = max(3, 1.0 + n_rows * 0.4)
    fig, ax = plt.subplots(figsize=(12, fig_h), facecolor=WHITE)
    ax.axis("off")

    if col_widths is None:
        col_widths = [1.0 / len(headers)] * len(headers)

    table = ax.table(cellText=rows, colLabels=headers, colWidths=col_widths, loc="center", cellLoc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.6)

    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#E2E8F0")
        if row == 0:
            cell.set_facecolor(NAVY)
            cell.set_text_props(color=WHITE, fontweight="bold", fontsize=9)
        elif row % 2 == 0:
            cell.set_facecolor("#F7FAFC")
        else:
            cell.set_facecolor(WHITE)

    fig.tight_layout(pad=0.5)
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def upload_to_drive(file_path):
    cmd = ["gws", "drive", "files", "create",
           "--params", json.dumps({"uploadType": "multipart", "fields": "id"}),
           "--upload", file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    data = json.loads(result.stdout)
    file_id = data.get("id")
    if not file_id:
        return None

    subprocess.run(["gws", "drive", "permissions", "create",
                    "--params", json.dumps({"fileId": file_id}),
                    "--json", json.dumps({"role": "reader", "type": "anyone"})],
                   capture_output=True, text=True)
    return f"https://lh3.googleusercontent.com/d/{file_id}"


def generate_analysis_text(data):
    """AI分析テキストがあればそれを使い、なければデータから簡易生成"""
    analysis = data.get("analysis", {})
    overall = analysis.get("overall", {})
    client = analysis.get("clientReport", {})

    summary = client.get("summary") or overall.get("summary") or ""
    insights = overall.get("insights", [])
    improvements = client.get("improvements", overall.get("recommendations", []))
    report_texts = []
    opinion_texts = []

    p = data["project"]
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    spend_fee = apply_fee(p["spend"], fee_rate, fee_method)
    cpc = p["spend"] / p["clicks"] if p.get("clicks", 0) > 0 else 0

    # KPI
    report_texts.append(f"消化額（Fee込）{fmt_currency(spend_fee)}に対しCV {int(p.get('cv',0))}件、CPA {fmt_currency(p.get('cpa',0))}。")
    roas = p.get("purchase_roas")
    if isinstance(roas, (int, float)) and roas > 0:
        report_texts[0] += f" ROAS {roas:.2f}x。"

    # 予算
    budget = data.get("monthlyBudget")
    if budget and budget > 0:
        rate = (spend_fee / budget) * 100
        report_texts.append(f"月間予算{fmt_currency(budget)}に対し消化率{rate:.1f}%。")

    # キャンペーン
    campaigns = sorted(data.get("campaigns", []), key=lambda x: x.get("spend", 0), reverse=True)
    if campaigns:
        best = campaigns[0]
        report_texts.append(f"{best.get('campaign_name','')}がCPA {fmt_currency(best.get('cpa',0))}で最効率。")

    # 所感
    if summary:
        opinion_texts.append(summary)
    if insights:
        opinion_texts.extend(insights[:3])

    return {
        "report_texts": report_texts,
        "opinion_texts": opinion_texts,
        "insights": insights,
        "improvements": improvements,
        "summary": summary,
    }


def tb(sid, oid, text, x, y, w, h, pt, color, bold_n=0, center=False):
    r = [
        {"createShape": {"objectId": oid, "shapeType": "TEXT_BOX",
            "elementProperties": {"pageObjectId": sid,
                "size": {"width": {"magnitude": w, "unit": "EMU"}, "height": {"magnitude": h, "unit": "EMU"}},
                "transform": {"scaleX":1,"scaleY":1,"shearX":0,"shearY":0,"translateX":x,"translateY":y,"unit":"EMU"}}}},
        {"insertText": {"objectId": oid, "text": text}},
        {"updateTextStyle": {"objectId": oid, "textRange": {"type": "ALL"},
            "style": {"fontSize": {"magnitude": pt, "unit": "PT"}, "foregroundColor": {"opaqueColor": {"rgbColor": color}}},
            "fields": "fontSize,foregroundColor"}},
    ]
    if bold_n > 0:
        r.append({"updateTextStyle": {"objectId": oid,
            "textRange": {"type": "FIXED_RANGE", "startIndex": 0, "endIndex": bold_n},
            "style": {"bold": True, "fontSize": {"magnitude": pt + 1, "unit": "PT"},
                      "foregroundColor": {"opaqueColor": {"rgbColor": color}}},
            "fields": "bold,fontSize,foregroundColor"}})
    if center:
        r.append({"updateParagraphStyle": {"objectId": oid, "textRange": {"type":"ALL"},
            "style": {"alignment": "CENTER"}, "fields": "alignment"}})
    return r


def build_slide_comments(data, analysis_info):
    """各スライドの報告・所感テキストをデータから生成"""
    p = data["project"]
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    spend_fee = apply_fee(p["spend"], fee_rate, fee_method)

    base_report = "\n".join(analysis_info["report_texts"])
    base_opinion = "\n".join(analysis_info["opinion_texts"][:3]) if analysis_info["opinion_texts"] else ""

    comments = {
        "kpi": {
            "report": f"【報告】\n{base_report}",
            "opinion": f"【所感】\n{base_opinion}" if base_opinion else "【所感】\n全体として安定した運用実績。",
        },
        "budget": {
            "report": "【報告】\n" + (analysis_info["report_texts"][1] if len(analysis_info["report_texts"]) > 1 else "予算進捗データ。"),
            "opinion": "【所感】\n予算ペースを注視し、後半の配分を調整。",
        },
        "daily_chart": {
            "report": "【報告】\n日次の消化額とCV数の推移。トレンドの変動を日次で管理中。",
            "opinion": "【所感】\nCV効率の高い曜日・時間帯を分析し配信最適化を推進。",
        },
        "daily_table": {
            "report": "【報告】\n日次の詳細数値。Fee込消化額ベースで月間予算との乖離を管理。",
            "opinion": "【所感】\nCPA・CTRのブレ幅から運用安定性を確認。",
        },
        "campaign_table": {
            "report": f"【報告】\nキャンペーン別詳細。{analysis_info['report_texts'][-1] if analysis_info['report_texts'] else ''}",
            "opinion": "【所感】\n" + ("\n".join(analysis_info["insights"][:2]) if analysis_info["insights"] else "効率の良いキャンペーンへの予算集中を検討。"),
        },
        "campaign_chart": {
            "report": "【報告】\n消化額・CV数の比較。緑=CPA目標内、黄=要注意、赤=目標超過。",
            "opinion": "【所感】\n投資効率の高いキャンペーンへの予算シフトを検討。",
        },
        "device": {
            "report": "【報告】\nデバイス別の構成比と各指標。",
            "opinion": "【所感】\nデバイス別の効率差を踏まえた配信調整を推進。",
        },
        "demographics": {
            "report": "【報告】\n年齢×性別のCV分布。コアターゲット層を特定。",
            "opinion": "【所感】\nターゲット層への集中配信で効率最大化。",
        },
    }
    return comments


def main():
    # 標準入力からJSONデータ読み取り
    input_data = json.loads(sys.stdin.read())

    analysis_info = generate_analysis_text(input_data)
    comments = build_slide_comments(input_data, analysis_info)
    period = input_data.get("period", "")
    project_name = input_data.get("projectName", "広告運用")

    # 日付の範囲を推定
    daily = input_data.get("daily", [])
    if daily and not period:
        dates = sorted(d.get("date_start", "") for d in daily if d.get("date_start"))
        if dates:
            period = f"{dates[0]} - {dates[-1]}"

    with tempfile.TemporaryDirectory() as tmpdir:
        # 画像生成
        image_specs = [
            ("kpi", "パフォーマンスサマリー", create_kpi_image),
            ("budget", "予算進捗", create_budget_progress),
            ("daily_chart", "日次推移グラフ", create_daily_chart),
            ("daily_table", "日次推移テーブル", create_daily_table),
            ("campaign_table", "キャンペーン別パフォーマンス", create_campaign_table),
            ("campaign_chart", "キャンペーン別比較グラフ", create_campaign_chart),
            ("device", "デバイス別パフォーマンス", create_device_chart),
            ("demographics", "属性別パフォーマンス（年齢×性別）", create_demographics_chart),
        ]

        slides_content = []
        for key, title, gen_func in image_specs:
            path = os.path.join(tmpdir, f"{key}.png")
            gen_func(input_data, path)
            url = upload_to_drive(path)
            slides_content.append((key, title, url))

        # Googleスライド作成
        pres_title = f"{project_name} 広告運用レポート"
        r = subprocess.run(["gws", "slides", "presentations", "create",
            "--json", json.dumps({"title": pres_title})], capture_output=True, text=True)
        pres = json.loads(r.stdout)
        pres_id = pres["presentationId"]

        r = subprocess.run(["gws", "slides", "presentations", "get",
            "--params", json.dumps({"presentationId": pres_id})], capture_output=True, text=True)
        cover_id = json.loads(r.stdout)["slides"][0]["objectId"]

        reqs = []

        # 表紙
        reqs.append({"updatePageProperties": {"objectId": cover_id,
            "pageProperties": {"pageBackgroundFill": {"solidFill": {"color": {"rgbColor": NAVY_RGB}}}},
            "fields": "pageBackgroundFill.solidFill.color"}})
        reqs.extend(tb(cover_id, "cover_title", pres_title,
            900000, 1800000, 8250000, 1000000, 28, WHITE_RGB, bold_n=len(pres_title), center=True))

        import datetime
        today = datetime.date.today().strftime("%Y/%m/%d")
        sub = f"{period} | 提出日: {today}" if period else f"提出日: {today}"
        reqs.extend(tb(cover_id, "cover_subtt", sub,
            1100000, 3000000, 7850000, 600000, 14, LGRAY_RGB, center=True))

        # コンテンツスライド
        for i, (key, title, img_url) in enumerate(slides_content):
            sid = f"slide_{i:02d}"
            reqs.append({"createSlide": {"objectId": sid, "slideLayoutReference": {"predefinedLayout": "BLANK"}}})

            # タイトル
            reqs.extend(tb(sid, f"title_{i:02d}", title, 400000, 50000, 9000000, 400000, 22, NAVY_RGB, bold_n=len(title)))

            # 画像
            if img_url:
                reqs.append({"createImage": {"objectId": f"image_{i:02d}", "url": img_url,
                    "elementProperties": {"pageObjectId": sid,
                        "size": {"width": {"magnitude": 9000000, "unit": "EMU"}, "height": {"magnitude": 3100000, "unit": "EMU"}},
                        "transform": {"scaleX":1,"scaleY":1,"shearX":0,"shearY":0,
                                      "translateX":580000,"translateY":480000,"unit":"EMU"}}}})

            # 報告・所感
            c = comments.get(key, {"report": "", "opinion": ""})
            if c["report"]:
                reqs.extend(tb(sid, f"reprt_{i:02d}", c["report"],
                    250000, 3650000, 4500000, 2000000, 10, NAVY_RGB, bold_n=4))
            if c["opinion"]:
                reqs.extend(tb(sid, f"opnin_{i:02d}", c["opinion"],
                    5200000, 3650000, 4500000, 2000000, 10, BLUE_RGB, bold_n=4))

        # 分析スライド
        reqs.append({"createSlide": {"objectId": "slide_analysis", "slideLayoutReference": {"predefinedLayout": "BLANK"}}})
        reqs.extend(tb("slide_analysis", "antit_00", "分析・総評", 400000, 50000, 5000000, 400000, 22, NAVY_RGB, bold_n=5))
        if analysis_info["summary"]:
            reqs.extend(tb("slide_analysis", "ansum_00", analysis_info["summary"], 400000, 550000, 9200000, 800000, 13, NAVY_RGB))
        if analysis_info["insights"]:
            ins = "■ 示唆\n" + "\n".join(f"・{x}" for x in analysis_info["insights"])
            reqs.extend(tb("slide_analysis", "anins_00", ins, 400000, 1450000, 9200000, 2500000, 12, NAVY_RGB, bold_n=4))

        # 改善施策スライド
        if analysis_info["improvements"]:
            reqs.append({"createSlide": {"objectId": "slide_actions", "slideLayoutReference": {"predefinedLayout": "BLANK"}}})
            reqs.extend(tb("slide_actions", "actit_00", "改善施策・次月アクション", 400000, 50000, 6000000, 400000, 22, NAVY_RGB, bold_n=11))
            imp = "\n".join(f"→ {x}" for x in analysis_info["improvements"])
            reqs.extend(tb("slide_actions", "acbdy_00", imp, 400000, 600000, 9200000, 4500000, 13, BLUE_RGB))

        # batchUpdate
        r = subprocess.run(["gws", "slides", "presentations", "batchUpdate",
            "--params", json.dumps({"presentationId": pres_id}),
            "--json", json.dumps({"requests": reqs})], capture_output=True, text=True)

        url = f"https://docs.google.com/presentation/d/{pres_id}/edit"

        if r.returncode != 0:
            err = ""
            try:
                err = json.loads(r.stdout).get("error", {}).get("message", r.stderr)
            except Exception:
                err = r.stderr
            print(json.dumps({"ok": False, "error": err}))
            sys.exit(1)

        print(json.dumps({"ok": True, "presentationId": pres_id, "presentationUrl": url}))


if __name__ == "__main__":
    main()
