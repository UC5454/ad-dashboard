#!/usr/bin/env python3
"""
広告レポート PPTX 生成スクリプト
標準入力からJSONデータを受け取り、python-pptx + matplotlib で高品質PPTXを生成
→ Google Driveにアップロード → URLを返す

使い方:
  echo '{ ... }' | python3 generate-pptx-report.py
  python3 generate-pptx-report.py --sample   # サンプルデータで生成
"""

import json
import os
import subprocess
import sys
import tempfile
import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE

plt.rcParams["font.family"] = "Hiragino Sans"
plt.rcParams["axes.unicode_minus"] = False

# --- カラーパレット ---
NAVY = RGBColor(0x1B, 0x2A, 0x4A)
BLUE = RGBColor(0x2C, 0x52, 0x82)
LIGHT_BLUE = RGBColor(0x42, 0x99, 0xE1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF0, 0xF4, 0xF8)
MID_GRAY = RGBColor(0x66, 0x7A, 0x8A)
GREEN = RGBColor(0x05, 0x96, 0x69)
AMBER = RGBColor(0xD9, 0x77, 0x06)
RED = RGBColor(0xDC, 0x26, 0x26)
HEADER_BG = RGBColor(0x1B, 0x2A, 0x4A)
ROW_ALT = RGBColor(0xF7, 0xFA, 0xFC)
ACCENT_BLUE = RGBColor(0x3B, 0x82, 0xF6)

# matplotlib colors
M_NAVY = "#1B2A4A"
M_BLUE = "#2C5282"
M_LIGHT_BLUE = "#4299E1"
M_GREEN = "#059669"
M_AMBER = "#D97706"
M_RED = "#DC2626"
M_MID_GRAY = "#667A8A"
M_WHITE = "#FFFFFF"


def fmt_currency(v):
    return f"¥{int(v):,}"

def fmt_pct(v):
    return f"{v:.1f}%"

def fmt_num(v):
    return f"{int(v):,}"

def apply_fee(spend, fee_rate, method):
    if method == "margin":
        return spend / (1 - fee_rate / 100) if fee_rate < 100 else spend
    return spend * (1 + fee_rate / 100)


# ===== スライド構築関数 =====

def add_title_bar(slide, text, y=Inches(0.15)):
    """スライド上部にNavyのタイトルバーを追加"""
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), y, Inches(10), Inches(0.55))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()
    tf = bar.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.LEFT
    tf.margin_left = Inches(0.4)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE


def add_text_block(slide, text, left, top, width, height, font_size=10, color=NAVY, bold=False):
    """テキストボックスを追加"""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.margin_left = Pt(4)
    tf.margin_right = Pt(4)
    tf.margin_top = Pt(2)
    tf.margin_bottom = Pt(2)

    lines = text.split("\n")
    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = line
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        if i == 0 and bold:
            p.font.bold = True
    return txBox


def add_report_opinion(slide, report_text, opinion_text, y_top=Inches(5.15)):
    """報告・所感を左右2カラムで配置"""
    # 報告（左）
    add_text_block(slide, report_text, Inches(0.3), y_top, Inches(4.5), Inches(2.1),
                   font_size=9, color=NAVY, bold=False)
    # 所感（右）
    add_text_block(slide, opinion_text, Inches(5.2), y_top, Inches(4.5), Inches(2.1),
                   font_size=9, color=BLUE, bold=False)


def add_styled_table(slide, headers, rows, left, top, width, height, col_widths=None):
    """スタイル付きテーブルを追加"""
    n_rows = len(rows) + 1
    n_cols = len(headers)
    table_shape = slide.shapes.add_table(n_rows, n_cols, left, top, width, height)
    table = table_shape.table

    # 列幅設定
    if col_widths:
        total = sum(col_widths)
        for i, w in enumerate(col_widths):
            table.columns[i].width = int(width * w / total)

    # ヘッダー行
    for j, header in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = header
        cell.fill.solid()
        cell.fill.fore_color.rgb = HEADER_BG
        for p in cell.text_frame.paragraphs:
            p.font.size = Pt(9)
            p.font.bold = True
            p.font.color.rgb = WHITE
            p.alignment = PP_ALIGN.CENTER

    # データ行
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = table.cell(i + 1, j)
            cell.text = str(val)
            if i % 2 == 1:
                cell.fill.solid()
                cell.fill.fore_color.rgb = ROW_ALT
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = WHITE
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(8)
                p.font.color.rgb = NAVY
                p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    return table_shape


def add_kpi_card(slide, label, value, x, y, w=Inches(1.45), h=Inches(1.1)):
    """KPIカード（角丸ボックス）を追加"""
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = LIGHT_GRAY
    box.line.color.rgb = RGBColor(0xE2, 0xE8, 0xF0)
    box.line.width = Pt(1)

    # 上部アクセントライン
    accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, Inches(0.06))
    accent.fill.solid()
    accent.fill.fore_color.rgb = ACCENT_BLUE
    accent.line.fill.background()

    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Pt(6)
    tf.margin_right = Pt(6)
    tf.margin_top = Pt(16)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE

    p_label = tf.paragraphs[0]
    p_label.text = label
    p_label.font.size = Pt(8)
    p_label.font.color.rgb = MID_GRAY
    p_label.alignment = PP_ALIGN.CENTER

    p_value = tf.add_paragraph()
    p_value.text = value
    p_value.font.size = Pt(16)
    p_value.font.bold = True
    p_value.font.color.rgb = NAVY
    p_value.alignment = PP_ALIGN.CENTER


# ===== matplotlib グラフ生成 =====

def create_daily_chart(data, output_path):
    daily = data.get("daily", [])
    if not daily:
        return None
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")

    dates = [d.get("date_start", "")[-5:] for d in daily]
    spends = [apply_fee(d.get("spend", 0), fee_rate, fee_method) / 1000 for d in daily]
    cvs = [d.get("cv", 0) for d in daily]

    fig, ax1 = plt.subplots(figsize=(9, 3.2), facecolor=M_WHITE)
    x = np.arange(len(dates))

    ax1.bar(x, spends, color=M_LIGHT_BLUE, alpha=0.7, width=0.6, label="消化額（千円）", zorder=2)
    ax1.set_ylabel("消化額（千円）", color=M_NAVY, fontsize=9)
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, fontsize=7, color=M_MID_GRAY, rotation=45 if len(dates) > 14 else 0)
    ax1.set_facecolor(M_WHITE)
    ax1.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)
    for sp in ["top", "right"]:
        ax1.spines[sp].set_visible(False)
    ax1.spines["left"].set_color("#E2E8F0")
    ax1.spines["bottom"].set_color("#E2E8F0")

    ax2 = ax1.twinx()
    ax2.plot(x, cvs, color=M_GREEN, linewidth=2, marker="o", markersize=4, label="CV数", zorder=3)
    ax2.set_ylabel("CV数", color=M_GREEN, fontsize=9)
    ax2.tick_params(axis="y", colors=M_GREEN)
    for sp in ["top", "left", "bottom"]:
        ax2.spines[sp].set_visible(False)
    ax2.spines["right"].set_color(M_GREEN)

    for i, cv in enumerate(cvs):
        ax2.annotate(str(int(cv)), (x[i], cv), textcoords="offset points", xytext=(0, 8),
                     ha="center", fontsize=6, color=M_GREEN, fontweight="bold")

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=7, framealpha=0.9)

    fig.tight_layout(pad=0.5)
    fig.savefig(output_path, dpi=250, bbox_inches="tight", facecolor=M_WHITE)
    plt.close(fig)
    return output_path


def create_campaign_chart(data, output_path):
    campaigns = data.get("campaigns", [])
    if not campaigns:
        return None

    top = sorted(campaigns, key=lambda x: x.get("spend", 0), reverse=True)[:8]
    names = [c.get("campaign_name", "")[:18] for c in top]
    spends = [c.get("spend", 0) / 1000 for c in top]
    cvs = [c.get("cv", 0) for c in top]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3), facecolor=M_WHITE)
    y = np.arange(len(names))

    ax1.barh(y, spends, color=M_BLUE, alpha=0.8, height=0.55)
    ax1.set_yticks(y)
    ax1.set_yticklabels(names, fontsize=7, color=M_NAVY)
    ax1.set_xlabel("消化額（千円）", fontsize=8, color=M_NAVY)
    ax1.set_title("消化額", fontsize=10, fontweight="bold", color=M_NAVY)
    ax1.invert_yaxis()
    for sp in ["top", "right"]:
        ax1.spines[sp].set_visible(False)
    ax1.grid(axis="x", color="#E2E8F0", linewidth=0.5)

    colors = [M_GREEN if c.get("cpa", 99999) < 8000 else M_AMBER if c.get("cpa", 99999) < 10000 else M_RED for c in top]
    ax2.barh(y, cvs, color=colors, alpha=0.8, height=0.55)
    ax2.set_yticks(y)
    ax2.set_yticklabels(names, fontsize=7, color=M_NAVY)
    ax2.set_xlabel("CV数", fontsize=8, color=M_NAVY)
    ax2.set_title("CV数（色=CPA効率）", fontsize=10, fontweight="bold", color=M_NAVY)
    ax2.invert_yaxis()
    for sp in ["top", "right"]:
        ax2.spines[sp].set_visible(False)
    ax2.grid(axis="x", color="#E2E8F0", linewidth=0.5)

    fig.tight_layout(pad=1.0)
    fig.savefig(output_path, dpi=250, bbox_inches="tight", facecolor=M_WHITE)
    plt.close(fig)
    return output_path


def create_device_pie(data, output_path):
    devices = data.get("deviceBreakdown", [])
    if not devices:
        return None

    labels = [d.get("device", "") for d in devices]
    total = sum(d.get("spend", 0) for d in devices)
    shares = [(d.get("spend", 0) / total * 100) if total > 0 else 0 for d in devices]
    colors_pie = [M_BLUE, M_LIGHT_BLUE, "#90CDF4", "#BEE3F8"][:len(devices)]

    fig, ax = plt.subplots(figsize=(4, 3), facecolor=M_WHITE)
    wedges, texts, autotexts = ax.pie(
        shares, labels=labels, autopct="%1.1f%%", startangle=90,
        colors=colors_pie, textprops={"fontsize": 9, "color": M_NAVY},
        pctdistance=0.7, wedgeprops={"edgecolor": M_WHITE, "linewidth": 2})
    for t in autotexts:
        t.set_fontweight("bold")
        t.set_fontsize(8)
        t.set_color(M_WHITE)

    fig.tight_layout(pad=0.3)
    fig.savefig(output_path, dpi=250, bbox_inches="tight", facecolor=M_WHITE)
    plt.close(fig)
    return output_path


def create_demo_chart(data, output_path):
    demo = data.get("demographicBreakdown", [])
    if not demo:
        return None

    age_gender = {}
    for d in demo:
        age = d.get("age", "?")
        gender = d.get("gender", "?")
        cv = d.get("cv", 0)
        if age not in age_gender:
            age_gender[age] = {}
        age_gender[age][gender] = age_gender[age].get(gender, 0) + cv

    ages = sorted(age_gender.keys())
    genders = sorted(set(g for a in age_gender.values() for g in a.keys()))

    fig, ax = plt.subplots(figsize=(6, 3.2), facecolor=M_WHITE)
    x = np.arange(len(ages))
    width = 0.5
    bottom = np.zeros(len(ages))
    g_colors = [M_BLUE, "#F687B3", M_GREEN, M_AMBER]

    for gi, g in enumerate(genders):
        vals = [age_gender.get(a, {}).get(g, 0) for a in ages]
        ax.bar(x, vals, width, bottom=bottom, label=g, color=g_colors[gi % len(g_colors)], alpha=0.85, zorder=2)
        bottom += np.array(vals)

    ax.set_ylabel("CV数", fontsize=9, color=M_NAVY)
    ax.set_xticks(x)
    ax.set_xticklabels(ages, fontsize=8, color=M_NAVY)
    ax.legend(fontsize=8)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.5, zorder=0)

    for i in range(len(ages)):
        ax.text(x[i], int(bottom[i]) + 0.3, str(int(bottom[i])), ha="center", fontsize=7, fontweight="bold", color=M_NAVY)

    fig.tight_layout(pad=0.5)
    fig.savefig(output_path, dpi=250, bbox_inches="tight", facecolor=M_WHITE)
    plt.close(fig)
    return output_path


# ===== メイン =====

def build_report(data):
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6]  # Blank

    p = data.get("project", {})
    fee_rate = data.get("feeRate", 1.0)
    fee_method = data.get("feeCalcMethod", "markup")
    spend_fee = apply_fee(p.get("spend", 0), fee_rate, fee_method)
    cpc = p.get("spend", 0) / p.get("clicks", 1) if p.get("clicks", 0) > 0 else 0
    project_name = data.get("projectName", "広告運用")
    daily = data.get("daily", [])
    dates = sorted(d.get("date_start", "") for d in daily if d.get("date_start"))
    period = f"{dates[0]} - {dates[-1]}" if dates else ""
    today = datetime.date.today().strftime("%Y/%m/%d")

    analysis = data.get("analysis", {})
    overall = analysis.get("overall", {})
    client_report = analysis.get("clientReport", {})
    summary = client_report.get("summary") or overall.get("summary") or ""
    insights = overall.get("insights", [])
    improvements = client_report.get("improvements", overall.get("recommendations", []))

    with tempfile.TemporaryDirectory() as tmpdir:

        # ========== Slide 1: 表紙 ==========
        slide = prs.slides.add_slide(blank_layout)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = NAVY

        # 中央タイトル
        add_text_block(slide, f"{project_name}\n広告運用レポート",
                       Inches(1), Inches(2.2), Inches(8), Inches(1.5),
                       font_size=32, color=WHITE, bold=True)
        # 期間
        sub = f"{period}  |  提出日: {today}" if period else f"提出日: {today}"
        tb = add_text_block(slide, sub,
                       Inches(1), Inches(4.0), Inches(8), Inches(0.6),
                       font_size=14, color=RGBColor(0xCB, 0xD5, 0xE0))
        for p_elem in tb.text_frame.paragraphs:
            p_elem.alignment = PP_ALIGN.LEFT
        # 装飾ライン
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(3.9), Inches(3), Inches(0.04))
        line.fill.solid()
        line.fill.fore_color.rgb = ACCENT_BLUE
        line.line.fill.background()

        # ========== Slide 2: KPIサマリー ==========
        slide = prs.slides.add_slide(blank_layout)
        add_title_bar(slide, "パフォーマンスサマリー")

        kpi_data = [
            ("消化額（Fee込）", fmt_currency(spend_fee)),
            ("CV数", f'{int(p.get("cv", 0))}件'),
            ("CPA", fmt_currency(p.get("cpa", 0)) if p.get("cv", 0) > 0 else "-"),
            ("CTR", fmt_pct(p.get("ctr", 0))),
            ("CPC", fmt_currency(cpc)),
        ]
        roas = p.get("purchase_roas")
        if isinstance(roas, (int, float)) and roas > 0:
            kpi_data.append(("ROAS", f"{roas:.2f}x"))

        card_w = Inches(1.45)
        gap = Inches(0.12)
        total_w = len(kpi_data) * card_w + (len(kpi_data) - 1) * gap
        start_x = int((Inches(10) - total_w) / 2)

        for i, (label, value) in enumerate(kpi_data):
            x = start_x + i * int(card_w + gap)
            add_kpi_card(slide, label, value, x, Inches(1.0))

        # 予算進捗バー
        budget = data.get("monthlyBudget") or 0
        if budget > 0:
            rate = spend_fee / budget * 100
            bar_bg = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.5), Inches(2.4), Inches(9), Inches(0.3))
            bar_bg.fill.solid()
            bar_bg.fill.fore_color.rgb = RGBColor(0xE2, 0xE8, 0xF0)
            bar_bg.line.fill.background()

            bar_w = min(Inches(9) * rate / 100, Inches(9))
            bar_fg = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.5), Inches(2.4), int(bar_w), Inches(0.3))
            bar_fg.fill.solid()
            bar_fg.fill.fore_color.rgb = ACCENT_BLUE if rate <= 60 else AMBER if rate <= 80 else RED
            bar_fg.line.fill.background()

            add_text_block(slide, f"月間予算 {fmt_currency(budget)}　|　消化率 {rate:.1f}%　|　着地予想 {fmt_currency(int(spend_fee / max((datetime.date.today().day / 31), 0.01)))}",
                          Inches(0.5), Inches(2.8), Inches(9), Inches(0.35), font_size=9, color=MID_GRAY)

        report = f"【報告】\n消化額（Fee込）{fmt_currency(spend_fee)}に対しCV {int(p.get('cv',0))}件、CPA {fmt_currency(p.get('cpa',0))}。"
        if isinstance(roas, (int, float)) and roas > 0:
            report += f" ROAS {roas:.2f}x。"
        opinion = f"【所感】\n{summary}" if summary else "【所感】\n全体として安定した運用実績。"
        add_report_opinion(slide, report, opinion)

        # ========== Slide 3: 日次推移 ==========
        slide = prs.slides.add_slide(blank_layout)
        add_title_bar(slide, "日次推移")

        chart_path = os.path.join(tmpdir, "daily_chart.png")
        if create_daily_chart(data, chart_path):
            slide.shapes.add_picture(chart_path, Inches(0.3), Inches(0.85), Inches(9.4), Inches(3.5))

        # 日次テーブル（直近7日）
        recent = sorted(daily, key=lambda x: x.get("date_start", ""))[-7:]
        if recent:
            headers = ["日付", "消化額", "Fee込", "IMP", "Click", "CTR", "CV", "CPA"]
            rows = []
            for d in recent:
                sp = d.get("spend", 0)
                rows.append([
                    d.get("date_start", "")[-5:],
                    fmt_currency(sp), fmt_currency(apply_fee(sp, fee_rate, fee_method)),
                    fmt_num(d.get("impressions", 0)), fmt_num(d.get("clicks", 0)),
                    fmt_pct(d.get("ctr", 0)), str(int(d.get("cv", 0))),
                    fmt_currency(d.get("cpa", 0)) if d.get("cv", 0) > 0 else "-",
                ])
            add_styled_table(slide, headers, rows, Inches(0.3), Inches(4.45), Inches(9.4), Inches(0.6),
                            col_widths=[1, 1.2, 1.2, 1, 0.8, 0.7, 0.5, 1])

        add_report_opinion(slide,
            "【報告】\n日次の消化額とCV数の推移。トレンドの変動を日次で管理中。",
            "【所感】\nCV効率の高い曜日・時間帯を分析し配信最適化を推進。",
            y_top=Inches(5.9))

        # ========== Slide 4: キャンペーン別 ==========
        slide = prs.slides.add_slide(blank_layout)
        add_title_bar(slide, "キャンペーン別パフォーマンス")

        campaigns = sorted(data.get("campaigns", []), key=lambda x: x.get("spend", 0), reverse=True)[:10]
        if campaigns:
            headers = ["キャンペーン名", "消化額", "IMP", "Click", "CTR", "CV", "CPA"]
            rows = []
            for c in campaigns:
                rows.append([
                    c.get("campaign_name", "")[:25],
                    fmt_currency(c.get("spend", 0)),
                    fmt_num(c.get("impressions", 0)), fmt_num(c.get("clicks", 0)),
                    fmt_pct(c.get("ctr", 0)), str(int(c.get("cv", 0))),
                    fmt_currency(c.get("cpa", 0)) if c.get("cv", 0) > 0 else "-",
                ])
            add_styled_table(slide, headers, rows, Inches(0.3), Inches(0.85), Inches(9.4), Inches(0.5),
                            col_widths=[2.5, 1, 1, 0.8, 0.7, 0.5, 1])

        chart_path = os.path.join(tmpdir, "campaign_chart.png")
        if create_campaign_chart(data, chart_path):
            y_chart = Inches(0.85 + 0.35 * (len(campaigns) + 1) + 0.15)
            y_chart = min(y_chart, Inches(3.5))
            slide.shapes.add_picture(chart_path, Inches(0.3), y_chart, Inches(9.4), Inches(2.8))

        best = campaigns[0] if campaigns else {}
        add_report_opinion(slide,
            f"【報告】\n{best.get('campaign_name','')}がCPA {fmt_currency(best.get('cpa',0))}で最効率。" if best else "【報告】\nキャンペーン別詳細。",
            "【所感】\n" + ("\n".join(insights[:2]) if insights else "効率の良いキャンペーンへの予算集中を検討。"))

        # ========== Slide 5: デバイス別 + 属性別 ==========
        devices = data.get("deviceBreakdown", [])
        demo = data.get("demographicBreakdown", [])

        if devices or demo:
            slide = prs.slides.add_slide(blank_layout)
            add_title_bar(slide, "デバイス・属性別パフォーマンス")

            if devices:
                # デバイスパイチャート
                pie_path = os.path.join(tmpdir, "device_pie.png")
                if create_device_pie(data, pie_path):
                    slide.shapes.add_picture(pie_path, Inches(0.3), Inches(0.85), Inches(3.5), Inches(2.5))

                # デバイステーブル
                total_spend = sum(d.get("spend", 0) for d in devices)
                headers = ["デバイス", "消化額", "CV", "CPA", "構成比"]
                rows = []
                for d in devices:
                    share = d.get("spend", 0) / total_spend * 100 if total_spend > 0 else 0
                    rows.append([
                        d.get("device", ""), fmt_currency(d.get("spend", 0)),
                        str(int(d.get("cv", 0))),
                        fmt_currency(d.get("cpa", 0)) if d.get("cv", 0) > 0 else "-",
                        fmt_pct(share),
                    ])
                add_styled_table(slide, headers, rows, Inches(4.0), Inches(0.85), Inches(5.7), Inches(0.4),
                                col_widths=[1.2, 1, 0.6, 1, 0.8])

            if demo:
                demo_path = os.path.join(tmpdir, "demo_chart.png")
                if create_demo_chart(data, demo_path):
                    slide.shapes.add_picture(demo_path, Inches(0.3), Inches(3.5), Inches(5.5), Inches(2.8))

            add_report_opinion(slide,
                "【報告】\nデバイス別構成比と年齢×性別のCV分布。",
                "【所感】\nデバイス・ターゲット層別の効率差を踏まえた配信調整を推進。",
                y_top=Inches(6.3))

        # ========== Slide 6: 分析・総評 ==========
        slide = prs.slides.add_slide(blank_layout)
        add_title_bar(slide, "分析・総評")

        if summary:
            add_text_block(slide, summary, Inches(0.4), Inches(0.9), Inches(9.2), Inches(0.8),
                          font_size=12, color=NAVY)

        if insights:
            ins_text = "■ 示唆\n" + "\n".join(f"・{x}" for x in insights)
            add_text_block(slide, ins_text, Inches(0.4), Inches(1.8), Inches(9.2), Inches(2.5),
                          font_size=11, color=NAVY, bold=False)

        # ========== Slide 7: 改善施策 ==========
        if improvements:
            slide = prs.slides.add_slide(blank_layout)
            add_title_bar(slide, "改善施策・次月アクション")

            for i, item in enumerate(improvements):
                y = Inches(0.95 + i * 0.65)
                # 番号バッジ
                badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.4), y, Inches(0.35), Inches(0.35))
                badge.fill.solid()
                badge.fill.fore_color.rgb = ACCENT_BLUE
                badge.line.fill.background()
                tf = badge.text_frame
                tf.vertical_anchor = MSO_ANCHOR.MIDDLE
                p_b = tf.paragraphs[0]
                p_b.text = str(i + 1)
                p_b.font.size = Pt(12)
                p_b.font.bold = True
                p_b.font.color.rgb = WHITE
                p_b.alignment = PP_ALIGN.CENTER

                add_text_block(slide, item, Inches(0.9), y, Inches(8.6), Inches(0.5),
                              font_size=12, color=NAVY)

    return prs


def upload_to_drive(file_path, title):
    """PPTXをGoogle Driveにアップロードし、Google Slidesとして開けるURLを返す"""
    cmd = ["gws", "drive", "files", "create",
           "--params", json.dumps({
               "uploadType": "multipart",
               "fields": "id,webViewLink",
           }),
           "--json", json.dumps({
               "name": title,
               "mimeType": "application/vnd.google-apps.presentation",
           }),
           "--upload", file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None, None
    data = json.loads(result.stdout)
    file_id = data.get("id")
    web_link = data.get("webViewLink")

    if file_id:
        subprocess.run(["gws", "drive", "permissions", "create",
                        "--params", json.dumps({"fileId": file_id}),
                        "--json", json.dumps({"role": "writer", "type": "anyone"})],
                       capture_output=True, text=True)

    url = web_link or (f"https://docs.google.com/presentation/d/{file_id}/edit" if file_id else None)
    return file_id, url


def main():
    if "--sample" in sys.argv:
        data = {
            "projectName": "株式会社サンプル 広告運用",
            "datePreset": "last_30d",
            "project": {"spend": 1250000, "impressions": 850000, "clicks": 12500, "ctr": 1.47, "cv": 185, "cpa": 8108, "purchase_roas": 3.24},
            "campaigns": [
                {"campaign_name": "リスティング_ブランド", "spend": 320000, "impressions": 180000, "clicks": 4500, "ctr": 2.50, "cv": 62, "cpa": 5161},
                {"campaign_name": "リスティング_一般KW", "spend": 280000, "impressions": 220000, "clicks": 3300, "ctr": 1.50, "cv": 38, "cpa": 7368},
                {"campaign_name": "ディスプレイ_リタゲ", "spend": 250000, "impressions": 150000, "clicks": 2100, "ctr": 1.40, "cv": 45, "cpa": 5556},
                {"campaign_name": "ディスプレイ_類似", "spend": 200000, "impressions": 180000, "clicks": 1500, "ctr": 0.83, "cv": 22, "cpa": 9091},
                {"campaign_name": "SNS_Instagram", "spend": 120000, "impressions": 80000, "clicks": 700, "ctr": 0.88, "cv": 12, "cpa": 10000},
                {"campaign_name": "SNS_Facebook", "spend": 80000, "impressions": 40000, "clicks": 400, "ctr": 1.00, "cv": 6, "cpa": 13333},
            ],
            "creatives": [],
            "daily": [
                {"date_start": "2026-03-01", "spend": 95000, "impressions": 65000, "clicks": 975, "ctr": 1.5, "cv": 14, "cpa": 6786},
                {"date_start": "2026-03-02", "spend": 88000, "impressions": 62000, "clicks": 806, "ctr": 1.3, "cv": 12, "cpa": 7333},
                {"date_start": "2026-03-03", "spend": 102000, "impressions": 68000, "clicks": 1088, "ctr": 1.6, "cv": 16, "cpa": 6375},
                {"date_start": "2026-03-04", "spend": 110000, "impressions": 72000, "clicks": 1224, "ctr": 1.7, "cv": 18, "cpa": 6111},
                {"date_start": "2026-03-05", "spend": 98000, "impressions": 64000, "clicks": 896, "ctr": 1.4, "cv": 13, "cpa": 7538},
                {"date_start": "2026-03-06", "spend": 105000, "impressions": 67000, "clicks": 1005, "ctr": 1.5, "cv": 15, "cpa": 7000},
                {"date_start": "2026-03-07", "spend": 92000, "impressions": 60000, "clicks": 780, "ctr": 1.3, "cv": 11, "cpa": 8364},
                {"date_start": "2026-03-08", "spend": 115000, "impressions": 74000, "clicks": 1332, "ctr": 1.8, "cv": 19, "cpa": 6053},
                {"date_start": "2026-03-09", "spend": 88000, "impressions": 63000, "clicks": 882, "ctr": 1.4, "cv": 13, "cpa": 6769},
                {"date_start": "2026-03-10", "spend": 97000, "impressions": 65000, "clicks": 975, "ctr": 1.5, "cv": 14, "cpa": 6929},
                {"date_start": "2026-03-11", "spend": 108000, "impressions": 70000, "clicks": 1120, "ctr": 1.6, "cv": 17, "cpa": 6353},
                {"date_start": "2026-03-12", "spend": 78000, "impressions": 58000, "clicks": 812, "ctr": 1.4, "cv": 12, "cpa": 6500},
                {"date_start": "2026-03-13", "spend": 74000, "impressions": 62000, "clicks": 806, "ctr": 1.3, "cv": 11, "cpa": 6727},
            ],
            "analysis": {
                "overall": {
                    "summary": "3月前半は順調に推移。CPAは目標10,000円を大きく下回る8,108円で効率良好。",
                    "insights": [
                        "リスティング_ブランドKWが最もCPA効率が良く（¥5,161）、全体CVの33.5%を占める",
                        "ディスプレイ_リタゲもCPA ¥5,556と高効率。リタゲリストの拡充でCV増が期待",
                        "SNS_FacebookはCPA ¥13,333と目標超過。クリエイティブの刷新が必要",
                        "土日のCV効率が高い傾向。週末予算の増額を検討",
                    ],
                    "recommendations": [],
                },
                "clientReport": {
                    "summary": "3月前半は順調に推移。月間予算3,000,000円に対し消化率50.0%でやや先行ペース。",
                    "performance": "全体好調",
                    "improvements": [
                        "SNS_Facebook: CPA改善のためクリエイティブA/Bテスト実施（動画 vs 静止画）",
                        "ディスプレイ_類似: ターゲティング精度向上のためオーディエンス見直し",
                        "リスティング_一般KW: 除外KW追加で無駄クリック削減",
                        "週末の予算配分を10%増加し、効率の良い時間帯にCV最大化",
                    ],
                    "retrospective": [],
                },
            },
            "feeRate": 20,
            "feeCalcMethod": "markup",
            "monthlyBudget": 3000000,
            "deviceBreakdown": [
                {"device": "モバイル", "spend": 750000, "impressions": 510000, "clicks": 7500, "cv": 115, "cpa": 6522, "ctr": 1.47},
                {"device": "デスクトップ", "spend": 375000, "impressions": 255000, "clicks": 3750, "cv": 52, "cpa": 7212, "ctr": 1.47},
                {"device": "タブレット", "spend": 125000, "impressions": 85000, "clicks": 1250, "cv": 18, "cpa": 6944, "ctr": 1.47},
            ],
            "demographicBreakdown": [
                {"age": "18-24", "gender": "male", "spend": 40000, "impressions": 30000, "clicks": 500, "cv": 8, "cpa": 5000},
                {"age": "18-24", "gender": "female", "spend": 50000, "impressions": 35000, "clicks": 600, "cv": 12, "cpa": 4167},
                {"age": "25-34", "gender": "male", "spend": 100000, "impressions": 70000, "clicks": 1200, "cv": 25, "cpa": 4000},
                {"age": "25-34", "gender": "female", "spend": 120000, "impressions": 80000, "clicks": 1400, "cv": 35, "cpa": 3429},
                {"age": "35-44", "gender": "male", "spend": 110000, "impressions": 75000, "clicks": 1300, "cv": 30, "cpa": 3667},
                {"age": "35-44", "gender": "female", "spend": 100000, "impressions": 70000, "clicks": 1200, "cv": 28, "cpa": 3571},
                {"age": "45-54", "gender": "male", "spend": 80000, "impressions": 55000, "clicks": 900, "cv": 18, "cpa": 4444},
                {"age": "45-54", "gender": "female", "spend": 70000, "impressions": 50000, "clicks": 800, "cv": 15, "cpa": 4667},
                {"age": "55-64", "gender": "male", "spend": 40000, "impressions": 30000, "clicks": 400, "cv": 8, "cpa": 5000},
                {"age": "55-64", "gender": "female", "spend": 30000, "impressions": 25000, "clicks": 300, "cv": 6, "cpa": 5000},
            ],
        }
    else:
        data = json.loads(sys.stdin.read())

    prs = build_report(data)

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as f:
        pptx_path = f.name
        prs.save(pptx_path)

    title = f'{data.get("projectName", "広告運用")} 広告運用レポート.pptx'
    file_id, url = upload_to_drive(pptx_path, title)
    os.unlink(pptx_path)

    if url:
        print(json.dumps({"ok": True, "presentationId": file_id, "presentationUrl": url}))
    else:
        print(json.dumps({"ok": False, "error": "Google Driveへのアップロードに失敗しました"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
