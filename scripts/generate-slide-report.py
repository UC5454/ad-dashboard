#!/usr/bin/env python3
"""
広告レポートスライド生成スクリプト
Excel風の表・グラフを画像化 → Google Slidesに貼り付け
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

# --- 日本語フォント設定 ---
plt.rcParams["font.family"] = "Hiragino Sans"
plt.rcParams["axes.unicode_minus"] = False

# --- カラーパレット（Navy/Blue系） ---
NAVY = "#1B2A4A"
BLUE = "#2C5282"
LIGHT_BLUE = "#4299E1"
LIGHT_GRAY = "#F8FAFE"
MID_GRAY = "#667A8A"
WHITE = "#FFFFFF"
GREEN = "#059669"
AMBER = "#D97706"
RED = "#DC2626"

# --- サンプルデータ ---
SAMPLE_DATA = {
    "projectName": "株式会社サンプル 広告運用",
    "period": "2026/03/01 - 2026/03/13",
    "kpi": {
        "spend": 1_250_000,
        "spend_with_fee": 1_500_000,
        "impressions": 850_000,
        "clicks": 12_500,
        "ctr": 1.47,
        "cpc": 100,
        "cv": 185,
        "cpa": 8_108,
        "roas": 3.24,
        "monthly_budget": 3_000_000,
    },
    "daily": [
        {"date": "03/01", "spend": 95000, "cv": 14, "cpa": 6786, "ctr": 1.5, "imp": 65000, "clicks": 975},
        {"date": "03/02", "spend": 88000, "cv": 12, "cpa": 7333, "ctr": 1.3, "imp": 62000, "clicks": 806},
        {"date": "03/03", "spend": 102000, "cv": 16, "cpa": 6375, "ctr": 1.6, "imp": 68000, "clicks": 1088},
        {"date": "03/04", "spend": 110000, "cv": 18, "cpa": 6111, "ctr": 1.7, "imp": 72000, "clicks": 1224},
        {"date": "03/05", "spend": 98000, "cv": 13, "cpa": 7538, "ctr": 1.4, "imp": 64000, "clicks": 896},
        {"date": "03/06", "spend": 105000, "cv": 15, "cpa": 7000, "ctr": 1.5, "imp": 67000, "clicks": 1005},
        {"date": "03/07", "spend": 92000, "cv": 11, "cpa": 8364, "ctr": 1.3, "imp": 60000, "clicks": 780},
        {"date": "03/08", "spend": 115000, "cv": 19, "cpa": 6053, "ctr": 1.8, "imp": 74000, "clicks": 1332},
        {"date": "03/09", "spend": 88000, "cv": 13, "cpa": 6769, "ctr": 1.4, "imp": 63000, "clicks": 882},
        {"date": "03/10", "spend": 97000, "cv": 14, "cpa": 6929, "ctr": 1.5, "imp": 65000, "clicks": 975},
        {"date": "03/11", "spend": 108000, "cv": 17, "cpa": 6353, "ctr": 1.6, "imp": 70000, "clicks": 1120},
        {"date": "03/12", "spend": 78000, "cv": 12, "cpa": 6500, "ctr": 1.4, "imp": 58000, "clicks": 812},
        {"date": "03/13", "spend": 74000, "cv": 11, "cpa": 6727, "ctr": 1.3, "imp": 62000, "clicks": 806},
    ],
    "campaigns": [
        {"name": "リスティング_ブランド", "spend": 320000, "imp": 180000, "clicks": 4500, "ctr": 2.50, "cv": 62, "cpa": 5161, "roas": 4.2},
        {"name": "リスティング_一般KW", "spend": 280000, "imp": 220000, "clicks": 3300, "ctr": 1.50, "cv": 38, "cpa": 7368, "roas": 2.8},
        {"name": "ディスプレイ_リタゲ", "spend": 250000, "imp": 150000, "clicks": 2100, "ctr": 1.40, "cv": 45, "cpa": 5556, "roas": 3.9},
        {"name": "ディスプレイ_類似", "spend": 200000, "imp": 180000, "clicks": 1500, "ctr": 0.83, "cv": 22, "cpa": 9091, "roas": 2.1},
        {"name": "SNS_Instagram", "spend": 120000, "imp": 80000, "clicks": 700, "ctr": 0.88, "cv": 12, "cpa": 10000, "roas": 1.8},
        {"name": "SNS_Facebook", "spend": 80000, "imp": 40000, "clicks": 400, "ctr": 1.00, "cv": 6, "cpa": 13333, "roas": 1.2},
    ],
    "devices": [
        {"device": "モバイル", "spend": 750000, "cv": 115, "cpa": 6522, "share": 60.0},
        {"device": "デスクトップ", "spend": 375000, "cv": 52, "cpa": 7212, "share": 30.0},
        {"device": "タブレット", "spend": 125000, "cv": 18, "cpa": 6944, "share": 10.0},
    ],
    "demographics": [
        {"age": "18-24", "male": 8, "female": 12},
        {"age": "25-34", "male": 25, "female": 35},
        {"age": "35-44", "male": 30, "female": 28},
        {"age": "45-54", "male": 18, "female": 15},
        {"age": "55-64", "male": 8, "female": 6},
    ],
    "analysis": {
        "summary": "3月前半は順調に推移。月間予算3,000,000円に対し消化率50.0%（理想43.3%）でやや先行ペース。CPAは目標10,000円を大きく下回る8,108円で効率良好。",
        "insights": [
            "リスティング_ブランドKWが最もCPA効率が良く（¥5,161）、全体CVの33.5%を占める",
            "ディスプレイ_リタゲもCPA ¥5,556と高効率。リタゲリストの拡充で更なるCV増が期待できる",
            "SNS_Facebookは CPA ¥13,333と目標超過。クリエイティブの刷新が必要",
            "土日（03/08, 03/09）のCV効率が高い傾向。週末予算の増額を検討",
        ],
        "improvements": [
            "SNS_Facebook: CPA改善のためクリエイティブA/Bテスト実施（動画 vs 静止画）",
            "ディスプレイ_類似: ターゲティング精度向上のためオーディエンス見直し",
            "リスティング_一般KW: 除外KW追加で無駄クリック削減",
            "週末の予算配分を10%増加し、効率の良い時間帯にCV最大化",
        ],
    },
}


def fmt_currency(v):
    return f"¥{int(v):,}"


def fmt_pct(v):
    return f"{v:.1f}%"


def create_kpi_image(data, output_path):
    """KPIサマリーカード画像"""
    fig, ax = plt.subplots(figsize=(12, 3.5), facecolor=WHITE)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3.5)
    ax.axis("off")

    kpi = data["kpi"]
    metrics = [
        ("消化額（Fee込）", fmt_currency(kpi["spend_with_fee"])),
        ("CV数", f'{kpi["cv"]}件'),
        ("CPA", fmt_currency(kpi["cpa"])),
        ("CTR", fmt_pct(kpi["ctr"])),
        ("CPC", fmt_currency(kpi["cpc"])),
        ("ROAS", f'{kpi["roas"]:.2f}x'),
    ]

    box_w = 1.8
    gap = 0.15
    start_x = (12 - (box_w * len(metrics) + gap * (len(metrics) - 1))) / 2

    for i, (label, value) in enumerate(metrics):
        x = start_x + i * (box_w + gap)
        rect = plt.Rectangle((x, 0.4), box_w, 2.6, linewidth=0, facecolor=LIGHT_GRAY, zorder=1)
        ax.add_patch(rect)
        rect_border = plt.Rectangle((x, 0.4), box_w, 2.6, linewidth=1, edgecolor="#E2E8F0", facecolor="none", zorder=2)
        ax.add_patch(rect_border)
        # 上部にアクセントライン
        accent = plt.Rectangle((x, 2.85), box_w, 0.15, linewidth=0, facecolor=BLUE, zorder=3)
        ax.add_patch(accent)
        ax.text(x + box_w / 2, 2.3, label, ha="center", va="center", fontsize=9, color=MID_GRAY, zorder=4)
        ax.text(x + box_w / 2, 1.4, value, ha="center", va="center", fontsize=16, fontweight="bold", color=NAVY, zorder=4)

    fig.tight_layout(pad=0.3)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_daily_chart(data, output_path):
    """日次推移グラフ（消化額棒グラフ + CV折れ線）"""
    daily = data["daily"]
    dates = [d["date"] for d in daily]
    spends = [d["spend"] / 1000 for d in daily]
    cvs = [d["cv"] for d in daily]

    fig, ax1 = plt.subplots(figsize=(12, 5), facecolor=WHITE)

    x = np.arange(len(dates))
    bars = ax1.bar(x, spends, color=LIGHT_BLUE, alpha=0.7, width=0.6, label="消化額（千円）", zorder=2)
    ax1.set_ylabel("消化額（千円）", color=NAVY, fontsize=11)
    ax1.set_xlabel("")
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, fontsize=9, color=MID_GRAY)
    ax1.tick_params(axis="y", colors=NAVY)
    ax1.set_facecolor(WHITE)
    ax1.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.spines["left"].set_color("#E2E8F0")
    ax1.spines["bottom"].set_color("#E2E8F0")

    ax2 = ax1.twinx()
    ax2.plot(x, cvs, color=GREEN, linewidth=2.5, marker="o", markersize=6, label="CV数", zorder=3)
    ax2.set_ylabel("CV数", color=GREEN, fontsize=11)
    ax2.tick_params(axis="y", colors=GREEN)
    ax2.spines["top"].set_visible(False)
    ax2.spines["left"].set_visible(False)
    ax2.spines["right"].set_color(GREEN)
    ax2.spines["bottom"].set_visible(False)

    # CV数の値ラベル
    for i, cv in enumerate(cvs):
        ax2.annotate(str(cv), (x[i], cv), textcoords="offset points", xytext=(0, 10),
                     ha="center", fontsize=8, color=GREEN, fontweight="bold")

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=9, framealpha=0.9)

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_daily_table(data, output_path):
    """日次推移テーブル画像"""
    daily = data["daily"]
    headers = ["日付", "消化額", "Fee込", "IMP", "クリック", "CTR", "CV", "CPA"]
    rows = []
    fee_rate = 1.2
    for d in daily:
        rows.append([
            d["date"],
            fmt_currency(d["spend"]),
            fmt_currency(int(d["spend"] * fee_rate)),
            f'{d["imp"]:,}',
            f'{d["clicks"]:,}',
            fmt_pct(d["ctr"]),
            str(d["cv"]),
            fmt_currency(d["cpa"]),
        ])

    fig, ax = plt.subplots(figsize=(12, 5.5), facecolor=WHITE)
    ax.axis("off")

    col_widths = [0.08, 0.13, 0.13, 0.12, 0.1, 0.08, 0.08, 0.12]
    table = ax.table(
        cellText=rows,
        colLabels=headers,
        colWidths=col_widths,
        loc="center",
        cellLoc="center",
    )
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
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_campaign_table(data, output_path):
    """キャンペーン別テーブル画像"""
    campaigns = data["campaigns"]
    headers = ["キャンペーン名", "消化額", "IMP", "クリック", "CTR", "CV", "CPA", "ROAS"]
    rows = []
    for c in campaigns:
        rows.append([
            c["name"],
            fmt_currency(c["spend"]),
            f'{c["imp"]:,}',
            f'{c["clicks"]:,}',
            fmt_pct(c["ctr"]),
            str(c["cv"]),
            fmt_currency(c["cpa"]),
            f'{c["roas"]:.1f}x',
        ])

    fig, ax = plt.subplots(figsize=(12, 4), facecolor=WHITE)
    ax.axis("off")

    col_widths = [0.22, 0.11, 0.11, 0.1, 0.08, 0.08, 0.11, 0.09]
    table = ax.table(
        cellText=rows,
        colLabels=headers,
        colWidths=col_widths,
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.8)

    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#E2E8F0")
        if row == 0:
            cell.set_facecolor(NAVY)
            cell.set_text_props(color=WHITE, fontweight="bold", fontsize=9)
        elif row % 2 == 0:
            cell.set_facecolor("#F7FAFC")
        else:
            cell.set_facecolor(WHITE)
        # キャンペーン名は左寄せ
        if col == 0 and row > 0:
            cell.set_text_props(ha="left")

    fig.tight_layout(pad=0.5)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_campaign_chart(data, output_path):
    """キャンペーン別パフォーマンス横棒グラフ"""
    campaigns = data["campaigns"]
    names = [c["name"] for c in campaigns]
    spends = [c["spend"] / 1000 for c in campaigns]
    cvs = [c["cv"] for c in campaigns]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5), facecolor=WHITE)

    y = np.arange(len(names))

    # 消化額
    ax1.barh(y, spends, color=BLUE, alpha=0.8, height=0.6)
    ax1.set_yticks(y)
    ax1.set_yticklabels(names, fontsize=9, color=NAVY)
    ax1.set_xlabel("消化額（千円）", fontsize=10, color=NAVY)
    ax1.set_title("消化額比較", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax1.invert_yaxis()
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.spines["left"].set_color("#E2E8F0")
    ax1.spines["bottom"].set_color("#E2E8F0")
    ax1.grid(axis="x", color="#E2E8F0", linewidth=0.5)
    for i, v in enumerate(spends):
        ax1.text(v + 5, i, f"¥{int(v)}K", va="center", fontsize=8, color=NAVY)

    # CV数
    colors = [GREEN if c["cpa"] < 8000 else AMBER if c["cpa"] < 10000 else RED for c in campaigns]
    ax2.barh(y, cvs, color=colors, alpha=0.8, height=0.6)
    ax2.set_yticks(y)
    ax2.set_yticklabels(names, fontsize=9, color=NAVY)
    ax2.set_xlabel("CV数", fontsize=10, color=NAVY)
    ax2.set_title("CV数比較", fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax2.invert_yaxis()
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    ax2.spines["left"].set_color("#E2E8F0")
    ax2.spines["bottom"].set_color("#E2E8F0")
    ax2.grid(axis="x", color="#E2E8F0", linewidth=0.5)
    for i, v in enumerate(cvs):
        ax2.text(v + 0.5, i, str(v), va="center", fontsize=8, color=NAVY)

    fig.tight_layout(pad=1.5)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_device_chart(data, output_path):
    """デバイス別パイチャート + テーブル"""
    devices = data["devices"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4), facecolor=WHITE, gridspec_kw={"width_ratios": [1, 1.5]})

    # パイチャート
    labels = [d["device"] for d in devices]
    shares = [d["share"] for d in devices]
    colors_pie = [BLUE, LIGHT_BLUE, "#90CDF4"]
    wedges, texts, autotexts = ax1.pie(
        shares, labels=labels, autopct="%1.1f%%", startangle=90,
        colors=colors_pie, textprops={"fontsize": 10, "color": NAVY},
        pctdistance=0.7, wedgeprops={"edgecolor": WHITE, "linewidth": 2},
    )
    for t in autotexts:
        t.set_fontweight("bold")
        t.set_color(WHITE)
    ax1.set_title("デバイス構成比", fontsize=12, fontweight="bold", color=NAVY, pad=10)

    # テーブル
    ax2.axis("off")
    headers = ["デバイス", "消化額", "CV", "CPA", "構成比"]
    rows = []
    for d in devices:
        rows.append([d["device"], fmt_currency(d["spend"]), str(d["cv"]), fmt_currency(d["cpa"]), fmt_pct(d["share"])])

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
    """属性別（年齢×性別）積み上げ棒グラフ"""
    demo = data["demographics"]
    ages = [d["age"] for d in demo]
    males = [d["male"] for d in demo]
    females = [d["female"] for d in demo]

    fig, ax = plt.subplots(figsize=(10, 5), facecolor=WHITE)
    x = np.arange(len(ages))
    width = 0.5

    bars1 = ax.bar(x, males, width, label="男性", color=BLUE, alpha=0.85, zorder=2)
    bars2 = ax.bar(x, females, width, bottom=males, label="女性", color="#F687B3", alpha=0.85, zorder=2)

    ax.set_ylabel("CV数", fontsize=11, color=NAVY)
    ax.set_xlabel("年齢層", fontsize=11, color=NAVY)
    ax.set_xticks(x)
    ax.set_xticklabels(ages, fontsize=10, color=NAVY)
    ax.legend(fontsize=10, framealpha=0.9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#E2E8F0")
    ax.spines["bottom"].set_color("#E2E8F0")
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)

    # 値ラベル
    for i in range(len(ages)):
        total = males[i] + females[i]
        ax.text(x[i], total + 1, str(total), ha="center", fontsize=9, fontweight="bold", color=NAVY)

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def create_budget_progress(data, output_path):
    """予算進捗ゲージ画像"""
    kpi = data["kpi"]
    budget = kpi["monthly_budget"]
    spent = kpi["spend_with_fee"]
    rate = (spent / budget) * 100
    ideal = (13 / 31) * 100  # 3/13時点の理想進捗

    fig, ax = plt.subplots(figsize=(12, 2.5), facecolor=WHITE)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 2.5)
    ax.axis("off")

    # 背景バー
    bg_bar = plt.Rectangle((0.5, 0.8), 11, 0.6, linewidth=0, facecolor="#E2E8F0", zorder=1)
    ax.add_patch(bg_bar)

    # 進捗バー
    bar_width = min(11 * (rate / 100), 11)
    bar_color = BLUE if rate <= ideal * 1.15 else AMBER if rate <= ideal * 1.3 else RED
    progress_bar = plt.Rectangle((0.5, 0.8), bar_width, 0.6, linewidth=0, facecolor=bar_color, zorder=2)
    ax.add_patch(progress_bar)

    # 理想ライン
    ideal_x = 0.5 + 11 * (ideal / 100)
    ax.plot([ideal_x, ideal_x], [0.6, 1.6], color=MID_GRAY, linewidth=2, linestyle="--", zorder=3)
    ax.text(ideal_x, 1.7, f"理想 {ideal:.1f}%", ha="center", fontsize=8, color=MID_GRAY, zorder=4)

    # テキスト
    ax.text(0.5, 2.1, f"月間予算: {fmt_currency(budget)}", fontsize=12, fontweight="bold", color=NAVY)
    ax.text(6, 2.1, f"消化額(Fee込): {fmt_currency(spent)}　({rate:.1f}%)", fontsize=11, color=NAVY)

    projected = spent / (13 / 31)
    ax.text(0.5, 0.2, f"着地予想: {fmt_currency(int(projected))}　残予算: {fmt_currency(int(budget - spent))}", fontsize=9, color=MID_GRAY)

    fig.tight_layout(pad=0.3)
    fig.savefig(output_path, dpi=200, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def upload_to_drive(file_path, folder_id=None):
    """Google Driveに画像をアップロードし、URLを返す"""
    cmd = ["gws", "drive", "files", "create",
           "--params", json.dumps({
               "uploadType": "multipart",
               "fields": "id,webContentLink",
           }),
           "--upload", file_path]
    if folder_id:
        cmd.extend(["--json", json.dumps({"parents": [folder_id]})])

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Drive upload error: {result.stderr}", file=sys.stderr)
        return None

    data = json.loads(result.stdout)
    file_id = data.get("id")
    if not file_id:
        return None

    # 画像を公開アクセス可能にする
    perm_cmd = ["gws", "drive", "permissions", "create",
                "--params", json.dumps({"fileId": file_id}),
                "--json", json.dumps({"role": "reader", "type": "anyone"})]
    subprocess.run(perm_cmd, capture_output=True, text=True)

    return f"https://lh3.googleusercontent.com/d/{file_id}"


def create_slides_presentation(title, image_urls_with_titles):
    """Google Slidesプレゼンテーションを作成し、画像を各スライドに配置"""

    # 1. プレゼンテーション作成
    create_cmd = ["gws", "slides", "presentations", "create",
                  "--json", json.dumps({"title": title})]
    result = subprocess.run(create_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Slides create error: {result.stderr}", file=sys.stderr)
        return None
    pres_data = json.loads(result.stdout)
    pres_id = pres_data.get("presentationId")
    if not pres_id:
        return None

    # 2. 既存スライドのID取得
    get_cmd = ["gws", "slides", "presentations", "get",
               "--params", json.dumps({"presentationId": pres_id})]
    result = subprocess.run(get_cmd, capture_output=True, text=True)
    pres_info = json.loads(result.stdout)
    cover_slide_id = pres_info.get("slides", [{}])[0].get("objectId", "")

    # 3. batchUpdateリクエスト構築
    requests = []

    # 表紙スライドの背景色
    requests.append({
        "updatePageProperties": {
            "objectId": cover_slide_id,
            "pageProperties": {
                "pageBackgroundFill": {
                    "solidFill": {"color": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}}
                }
            },
            "fields": "pageBackgroundFill.solidFill.color",
        }
    })

    # 表紙タイトル
    cover_title_id = "cover_title_box"
    requests.extend([
        {
            "createShape": {
                "objectId": cover_title_id,
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": cover_slide_id,
                    "size": {"width": {"magnitude": 8250000, "unit": "EMU"}, "height": {"magnitude": 1000000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 900000, "translateY": 1800000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": cover_title_id, "text": title}},
        {
            "updateTextStyle": {
                "objectId": cover_title_id,
                "textRange": {"type": "ALL"},
                "style": {
                    "bold": True,
                    "fontSize": {"magnitude": 28, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 1, "green": 1, "blue": 1}}},
                },
                "fields": "bold,fontSize,foregroundColor",
            }
        },
        {
            "updateParagraphStyle": {
                "objectId": cover_title_id,
                "textRange": {"type": "ALL"},
                "style": {"alignment": "CENTER"},
                "fields": "alignment",
            }
        },
    ])

    # 表紙サブタイトル
    cover_sub_id = "cover_sub_box"
    sub_text = f'{SAMPLE_DATA["period"]} | 提出日: 2026/03/13'
    requests.extend([
        {
            "createShape": {
                "objectId": cover_sub_id,
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": cover_slide_id,
                    "size": {"width": {"magnitude": 7850000, "unit": "EMU"}, "height": {"magnitude": 600000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 1100000, "translateY": 3000000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": cover_sub_id, "text": sub_text}},
        {
            "updateTextStyle": {
                "objectId": cover_sub_id,
                "textRange": {"type": "ALL"},
                "style": {
                    "fontSize": {"magnitude": 14, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.85, "green": 0.87, "blue": 0.92}}},
                },
                "fields": "fontSize,foregroundColor",
            }
        },
        {
            "updateParagraphStyle": {
                "objectId": cover_sub_id,
                "textRange": {"type": "ALL"},
                "style": {"alignment": "CENTER"},
                "fields": "alignment",
            }
        },
    ])

    # 各コンテンツスライド作成
    for i, (slide_title, image_url) in enumerate(image_urls_with_titles):
        slide_id = f"content_slide_{i}"
        title_id = f"slide_title_{i}"
        img_id = f"slide_img_{i}"

        requests.append({
            "createSlide": {
                "objectId": slide_id,
                "slideLayoutReference": {"predefinedLayout": "BLANK"},
            }
        })

        # スライドタイトル
        requests.extend([
            {
                "createShape": {
                    "objectId": title_id,
                    "shapeType": "TEXT_BOX",
                    "elementProperties": {
                        "pageObjectId": slide_id,
                        "size": {"width": {"magnitude": 8000000, "unit": "EMU"}, "height": {"magnitude": 550000, "unit": "EMU"}},
                        "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 200000, "unit": "EMU"},
                    },
                }
            },
            {"insertText": {"objectId": title_id, "text": slide_title}},
            {
                "updateTextStyle": {
                    "objectId": title_id,
                    "textRange": {"type": "ALL"},
                    "style": {
                        "bold": True,
                        "fontSize": {"magnitude": 22, "unit": "PT"},
                        "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}},
                    },
                    "fields": "bold,fontSize,foregroundColor",
                }
            },
        ])

        # 画像挿入
        if image_url:
            requests.append({
                "createImage": {
                    "objectId": img_id,
                    "url": image_url,
                    "elementProperties": {
                        "pageObjectId": slide_id,
                        "size": {
                            "width": {"magnitude": 8800000, "unit": "EMU"},
                            "height": {"magnitude": 4200000, "unit": "EMU"},
                        },
                        "transform": {
                            "scaleX": 1, "scaleY": 1,
                            "translateX": 350000, "translateY": 800000,
                            "unit": "EMU",
                        },
                    },
                }
            })

    # 分析・改善施策スライド（テキストのみ）
    analysis_slide_id = "slide_analysis"
    requests.append({
        "createSlide": {
            "objectId": analysis_slide_id,
            "slideLayoutReference": {"predefinedLayout": "BLANK"},
        }
    })

    analysis = SAMPLE_DATA["analysis"]

    # タイトル
    requests.extend([
        {
            "createShape": {
                "objectId": "analysis_title",
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": analysis_slide_id,
                    "size": {"width": {"magnitude": 8000000, "unit": "EMU"}, "height": {"magnitude": 550000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 200000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": "analysis_title", "text": "分析・総評"}},
        {
            "updateTextStyle": {
                "objectId": "analysis_title",
                "textRange": {"type": "ALL"},
                "style": {
                    "bold": True,
                    "fontSize": {"magnitude": 22, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}},
                },
                "fields": "bold,fontSize,foregroundColor",
            }
        },
    ])

    # サマリー
    requests.extend([
        {
            "createShape": {
                "objectId": "analysis_summary",
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": analysis_slide_id,
                    "size": {"width": {"magnitude": 9000000, "unit": "EMU"}, "height": {"magnitude": 700000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 900000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": "analysis_summary", "text": analysis["summary"]}},
        {
            "updateTextStyle": {
                "objectId": "analysis_summary",
                "textRange": {"type": "ALL"},
                "style": {
                    "fontSize": {"magnitude": 13, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}},
                },
                "fields": "fontSize,foregroundColor",
            }
        },
    ])

    # 示唆
    insights_text = "■ 示唆\n" + "\n".join(f"・{item}" for item in analysis["insights"])
    requests.extend([
        {
            "createShape": {
                "objectId": "analysis_insights",
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": analysis_slide_id,
                    "size": {"width": {"magnitude": 9000000, "unit": "EMU"}, "height": {"magnitude": 1800000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 1700000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": "analysis_insights", "text": insights_text}},
        {
            "updateTextStyle": {
                "objectId": "analysis_insights",
                "textRange": {"type": "ALL"},
                "style": {
                    "fontSize": {"magnitude": 12, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}},
                },
                "fields": "fontSize,foregroundColor",
            }
        },
    ])

    # 改善施策スライド
    action_slide_id = "slide_actions"
    requests.append({
        "createSlide": {
            "objectId": action_slide_id,
            "slideLayoutReference": {"predefinedLayout": "BLANK"},
        }
    })

    requests.extend([
        {
            "createShape": {
                "objectId": "action_title",
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": action_slide_id,
                    "size": {"width": {"magnitude": 8000000, "unit": "EMU"}, "height": {"magnitude": 550000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 200000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": "action_title", "text": "改善施策・次月アクション"}},
        {
            "updateTextStyle": {
                "objectId": "action_title",
                "textRange": {"type": "ALL"},
                "style": {
                    "bold": True,
                    "fontSize": {"magnitude": 22, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.106, "green": 0.165, "blue": 0.29}}},
                },
                "fields": "bold,fontSize,foregroundColor",
            }
        },
    ])

    improvements_text = "\n".join(f"→ {item}" for item in analysis["improvements"])
    requests.extend([
        {
            "createShape": {
                "objectId": "action_body",
                "shapeType": "TEXT_BOX",
                "elementProperties": {
                    "pageObjectId": action_slide_id,
                    "size": {"width": {"magnitude": 9000000, "unit": "EMU"}, "height": {"magnitude": 3500000, "unit": "EMU"}},
                    "transform": {"scaleX": 1, "scaleY": 1, "translateX": 500000, "translateY": 1000000, "unit": "EMU"},
                },
            }
        },
        {"insertText": {"objectId": "action_body", "text": improvements_text}},
        {
            "updateTextStyle": {
                "objectId": "action_body",
                "textRange": {"type": "ALL"},
                "style": {
                    "fontSize": {"magnitude": 14, "unit": "PT"},
                    "foregroundColor": {"opaqueColor": {"rgbColor": {"red": 0.173, "green": 0.322, "blue": 0.51}}},
                },
                "fields": "fontSize,foregroundColor",
            }
        },
    ])

    # 4. batchUpdate実行
    batch_cmd = ["gws", "slides", "presentations", "batchUpdate",
                 "--params", json.dumps({"presentationId": pres_id}),
                 "--json", json.dumps({"requests": requests})]
    result = subprocess.run(batch_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Slides batchUpdate error: {result.stderr}", file=sys.stderr)
        # エラーでもURLは返す（部分的に成功している可能性）

    return f"https://docs.google.com/presentation/d/{pres_id}/edit"


def main():
    print("📊 広告レポートスライド生成を開始...")

    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. 画像生成
        print("  [1/7] KPIサマリー画像を生成...")
        kpi_path = os.path.join(tmpdir, "kpi_summary.png")
        create_kpi_image(SAMPLE_DATA, kpi_path)

        print("  [2/7] 予算進捗画像を生成...")
        budget_path = os.path.join(tmpdir, "budget_progress.png")
        create_budget_progress(SAMPLE_DATA, budget_path)

        print("  [3/7] 日次推移グラフを生成...")
        daily_chart_path = os.path.join(tmpdir, "daily_chart.png")
        create_daily_chart(SAMPLE_DATA, daily_chart_path)

        print("  [4/7] 日次テーブルを生成...")
        daily_table_path = os.path.join(tmpdir, "daily_table.png")
        create_daily_table(SAMPLE_DATA, daily_table_path)

        print("  [5/7] キャンペーン別テーブルを生成...")
        campaign_table_path = os.path.join(tmpdir, "campaign_table.png")
        create_campaign_table(SAMPLE_DATA, campaign_table_path)

        print("  [6/7] キャンペーン別グラフを生成...")
        campaign_chart_path = os.path.join(tmpdir, "campaign_chart.png")
        create_campaign_chart(SAMPLE_DATA, campaign_chart_path)

        print("  [7/7] デバイス・属性グラフを生成...")
        device_path = os.path.join(tmpdir, "device_breakdown.png")
        create_device_chart(SAMPLE_DATA, device_path)
        demo_path = os.path.join(tmpdir, "demographics.png")
        create_demographics_chart(SAMPLE_DATA, demo_path)

        # 2. Google Driveにアップロード
        print("\n📤 Google Driveにアップロード...")
        slides_content = []
        uploads = [
            ("パフォーマンスサマリー", kpi_path),
            ("予算進捗", budget_path),
            ("日次推移グラフ", daily_chart_path),
            ("日次推移テーブル", daily_table_path),
            ("キャンペーン別パフォーマンス", campaign_table_path),
            ("キャンペーン別比較グラフ", campaign_chart_path),
            ("デバイス別パフォーマンス", device_path),
            ("属性別パフォーマンス（年齢×性別）", demo_path),
        ]

        for title, path in uploads:
            print(f"  アップロード: {title}...")
            url = upload_to_drive(path)
            if url:
                slides_content.append((title, url))
                print(f"    ✅ {url}")
            else:
                print(f"    ❌ アップロード失敗")
                slides_content.append((title, None))

        # 3. Google Slidesに構成
        print("\n📑 Googleスライドを作成...")
        pres_title = f"{SAMPLE_DATA['projectName']} 広告運用レポート"
        slides_url = create_slides_presentation(pres_title, slides_content)

        if slides_url:
            print(f"\n✅ スライド作成完了!")
            print(f"🔗 URL: {slides_url}")
        else:
            print("\n❌ スライド作成に失敗しました")

        return slides_url


if __name__ == "__main__":
    url = main()
    if url:
        sys.exit(0)
    else:
        sys.exit(1)
