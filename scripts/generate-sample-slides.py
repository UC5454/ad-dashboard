#!/usr/bin/env python3
"""
広告レポート スライド生成スクリプト v2
スプレッドシートのチャート・表をスクショとして埋め込むバージョン。
1. まずスプレッドシートを生成（generate-sample-report.py）
2. チャートIDを取得
3. createSheetsChart でスライドに埋め込み
"""
import json, os, sys
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/Library/Application Support/gws/credentials.json")

# ── Colors ──
NAVY = {"red": 0.106, "green": 0.165, "blue": 0.29}
LIGHT_GRAY = {"red": 0.973, "green": 0.98, "blue": 0.988}
MID_GRAY = {"red": 0.4, "green": 0.46, "blue": 0.54}
WHITE = {"red": 1, "green": 1, "blue": 1}
BLUE = {"red": 0.173, "green": 0.322, "blue": 0.51}
SUBTITLE_COLOR = {"red": 0.89, "green": 0.91, "blue": 0.96}


def get_creds():
    with open(CREDS_PATH) as f:
        d = json.load(f)
    c = Credentials(
        token=d.get("token"), refresh_token=d.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=d.get("client_id"), client_secret=d.get("client_secret"),
        scopes=[
            "https://www.googleapis.com/auth/presentations",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ],
    )
    if c.expired or not c.valid:
        c.refresh(Request())
    return c


def transform(x, y):
    return {"scaleX": 1, "scaleY": 1, "shearX": 0, "shearY": 0,
            "translateX": x, "translateY": y, "unit": "EMU"}


def text_box(slide_id, obj_id, text, x, y, w, h, font_pt, bold=False, color=None, center=False):
    color = color or NAVY
    reqs = [
        {"createShape": {
            "objectId": obj_id, "shapeType": "TEXT_BOX",
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "EMU"}, "height": {"magnitude": h, "unit": "EMU"}},
                "transform": transform(x, y),
            },
        }},
        {"insertText": {"objectId": obj_id, "text": text}},
        {"updateTextStyle": {
            "objectId": obj_id, "textRange": {"type": "ALL"},
            "style": {
                "bold": bold,
                "fontSize": {"magnitude": font_pt, "unit": "PT"},
                "foregroundColor": {"opaqueColor": {"rgbColor": color}},
            },
            "fields": "bold,fontSize,foregroundColor",
        }},
    ]
    if center:
        reqs.append({"updateParagraphStyle": {
            "objectId": obj_id, "textRange": {"type": "ALL"},
            "style": {"alignment": "CENTER"}, "fields": "alignment",
        }})
    return reqs


def sheets_chart(slide_id, obj_id, ss_id, chart_id, x, y, w, h):
    """Embed a Sheets chart into a slide via createSheetsChart."""
    return [{
        "createSheetsChart": {
            "objectId": obj_id,
            "spreadsheetId": ss_id,
            "chartId": chart_id,
            "linkingMode": "NOT_LINKED_IMAGE",
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "EMU"}, "height": {"magnitude": h, "unit": "EMU"}},
                "transform": transform(x, y),
            },
        },
    }]


def kpi_box(slide_id, obj_id, label, value, x, y, w, h):
    text = f"{label}\n{value}"
    val_start = len(label) + 1
    return [
        {"createShape": {
            "objectId": obj_id, "shapeType": "ROUND_RECTANGLE",
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "EMU"}, "height": {"magnitude": h, "unit": "EMU"}},
                "transform": transform(x, y),
            },
        }},
        {"updateShapeProperties": {
            "objectId": obj_id,
            "shapeProperties": {
                "shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": LIGHT_GRAY}}},
                "outline": {"outlineFill": {"solidFill": {"color": {"rgbColor": LIGHT_GRAY}}},
                             "weight": {"magnitude": 1, "unit": "PT"}},
            },
            "fields": "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
        }},
        {"insertText": {"objectId": obj_id, "text": text}},
        {"updateTextStyle": {
            "objectId": obj_id, "textRange": {"type": "ALL"},
            "style": {"bold": False, "fontSize": {"magnitude": 10, "unit": "PT"},
                      "foregroundColor": {"opaqueColor": {"rgbColor": MID_GRAY}}},
            "fields": "bold,fontSize,foregroundColor",
        }},
        {"updateTextStyle": {
            "objectId": obj_id,
            "textRange": {"type": "FIXED_RANGE", "startIndex": val_start, "endIndex": len(text)},
            "style": {"bold": True, "fontSize": {"magnitude": 20, "unit": "PT"},
                      "foregroundColor": {"opaqueColor": {"rgbColor": NAVY}}},
            "fields": "bold,fontSize,foregroundColor",
        }},
        {"updateParagraphStyle": {
            "objectId": obj_id, "textRange": {"type": "ALL"},
            "style": {"alignment": "CENTER"}, "fields": "alignment",
        }},
    ]


def table(slide_id, table_id, headers, rows, x, y, w, h):
    all_rows = [headers] + rows
    col_count = len(headers)
    reqs = [
        {"createTable": {
            "objectId": table_id, "rows": len(all_rows), "columns": col_count,
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {"width": {"magnitude": w, "unit": "EMU"}, "height": {"magnitude": h, "unit": "EMU"}},
                "transform": transform(x, y),
            },
        }},
    ]
    for ri, row in enumerate(all_rows):
        for ci, cell in enumerate(row):
            reqs.append({"insertText": {
                "objectId": table_id, "cellLocation": {"rowIndex": ri, "columnIndex": ci}, "text": str(cell),
            }})
    reqs.append({"updateTableCellProperties": {
        "objectId": table_id,
        "tableRange": {"location": {"rowIndex": 0, "columnIndex": 0}, "rowSpan": 1, "columnSpan": col_count},
        "tableCellProperties": {"tableCellBackgroundFill": {"solidFill": {"color": {"rgbColor": NAVY}}}},
        "fields": "tableCellBackgroundFill.solidFill.color",
    }})
    for ci in range(col_count):
        reqs.append({"updateTextStyle": {
            "objectId": table_id, "cellLocation": {"rowIndex": 0, "columnIndex": ci},
            "textRange": {"type": "ALL"},
            "style": {"bold": True, "fontSize": {"magnitude": 10, "unit": "PT"},
                      "foregroundColor": {"opaqueColor": {"rgbColor": WHITE}}},
            "fields": "bold,fontSize,foregroundColor",
        }})
    return reqs


def fmt_yen(v):
    return f"¥{round(v):,}"


def fmt_pct(v):
    return f"{v:.1f}%"


def main():
    creds = get_creds()
    sheets_svc = build("sheets", "v4", credentials=creds)
    slides_svc = build("slides", "v1", credentials=creds)

    # ── Step 1: Generate spreadsheet (reuse existing script) ──
    print("Step 1: Generating spreadsheet with charts...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    import importlib.util
    spec = importlib.util.spec_from_file_location("gen_report", os.path.join(script_dir, "generate-sample-report.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    ss_url = mod.main()
    ss_id = ss_url.split("/d/")[1].split("/")[0]
    print(f"Spreadsheet: {ss_url}")

    # ── Step 2: Get chart IDs from spreadsheet ──
    print("\nStep 2: Reading chart IDs from spreadsheet...")
    ss_data = sheets_svc.spreadsheets().get(spreadsheetId=ss_id, fields="sheets(properties,charts)").execute()

    chart_map = {}  # sheet_title -> [(chartId, title)]
    for sheet in ss_data.get("sheets", []):
        title = sheet["properties"]["title"]
        charts = sheet.get("charts", [])
        if charts:
            chart_map[title] = [(c["chartId"], c.get("spec", {}).get("title", "")) for c in charts]
            for cid, ctitle in chart_map[title]:
                print(f"  [{title}] chartId={cid}: {ctitle}")

    # ── Step 3: Create presentation with embedded charts ──
    print("\nStep 3: Creating presentation...")

    project_name = "サンプルクライアント"
    period_label = "2026/02/12 - 2026/03/13"
    output_date = "2026/03/13"

    pres = slides_svc.presentations().create(body={
        "title": f"{project_name} 広告運用レポート（チャート版）",
    }).execute()
    pres_id = pres["presentationId"]
    cover_id = pres["slides"][0]["objectId"]
    pres_url = f"https://docs.google.com/presentation/d/{pres_id}/edit"

    # Sample data for KPI and text sections
    total_spend = 352900
    total_cv = 45
    total_cpa = total_spend / total_cv
    total_ctr = 1.47
    total_clicks = 4200
    cpc = total_spend / total_clicks

    # Define slides
    s_kpi = "s_kpi"
    s_camp = "s_camp"
    s_camp_chart = "s_camp_chart"
    s_daily = "s_daily"
    s_daily_chart = "s_daily_chart"
    s_device = "s_device"
    s_device_chart = "s_device_chart"
    s_demo = "s_demo"
    s_heatmap = "s_heatmap"
    s_analysis = "s_analysis"
    s_action = "s_action"

    reqs = []

    # Create slides
    for sid in [s_kpi, s_camp, s_camp_chart, s_daily, s_daily_chart, s_device, s_device_chart, s_demo, s_heatmap, s_analysis, s_action]:
        reqs.append({"createSlide": {"objectId": sid, "slideLayoutReference": {"predefinedLayout": "BLANK"}}})

    # ── Cover (navy bg) ──
    reqs.append({"updatePageProperties": {
        "objectId": cover_id,
        "pageProperties": {"pageBackgroundFill": {"solidFill": {"color": {"rgbColor": NAVY}}}},
        "fields": "pageBackgroundFill.solidFill.color",
    }})
    reqs += text_box(cover_id, "cover_title", f"{project_name} 広告運用レポート",
                     900000, 1950000, 8250000, 1000000, 28, bold=True, color=WHITE, center=True)
    reqs += text_box(cover_id, "cover_sub", f"{period_label} | 提出日: {output_date}",
                     1100000, 3100000, 7850000, 600000, 14, color=SUBTITLE_COLOR, center=True)

    # ── KPI Summary ──
    reqs += text_box(s_kpi, "kpi_t", "パフォーマンスサマリー",
                     500000, 350000, 4500000, 550000, 24, bold=True, color=NAVY)
    kpis = [
        ("消化額(Fee込)", fmt_yen(total_spend * 1.2)),
        ("CV数", f"{total_cv}件"),
        ("CPA", fmt_yen(total_cpa)),
        ("CTR", fmt_pct(total_ctr)),
        ("CPC", fmt_yen(cpc)),
    ]
    bw, bh, gap = 1700000, 1450000, 120000
    tw = bw * len(kpis) + gap * (len(kpis) - 1)
    sx = max(250000, (10000000 - tw) // 2)
    for i, (label, value) in enumerate(kpis):
        reqs += kpi_box(s_kpi, f"kpi_{i}", label, value, sx + i * (bw + gap), 1650000, bw, bh)

    # ── Campaign table (from spreadsheet data) ──
    reqs += text_box(s_camp, "camp_t", "キャンペーン別パフォーマンス",
                     500000, 200000, 5200000, 450000, 22, bold=True, color=NAVY)
    campaigns = [
        ("リード獲得_検索", 151200, 22, 6873, 1.75),
        ("リード獲得_ディスプレイ", 110400, 15, 7360, 1.26),
        ("認知拡大_動画", 63000, 5, 12600, 1.2),
        ("リターゲティング", 28300, 3, 9433, 1.5),
    ]
    camp_rows = [[n, fmt_yen(s*1.2), str(cv), fmt_yen(cpa), fmt_pct(ctr), str(i+1)]
                  for i, (n, s, cv, cpa, ctr) in enumerate(campaigns)]
    reqs += table(s_camp, "camp_tbl",
                  ["キャンペーン名", "消化額(Fee込)", "CV", "CPA", "CTR", "ランク"],
                  camp_rows, 300000, 800000, 9400000, 2200000)

    # ── Campaign charts (embedded from spreadsheet) ──
    reqs += text_box(s_camp_chart, "campc_t", "キャンペーン別 チャート",
                     500000, 200000, 5200000, 450000, 22, bold=True, color=NAVY)
    camp_charts = chart_map.get("キャンペーン別", [])
    for i, (cid, ctitle) in enumerate(camp_charts[:2]):
        x = 300000 + i * 4800000
        reqs += sheets_chart(s_camp_chart, f"chart_camp_{i}", ss_id, cid, x, 750000, 4500000, 3800000)

    # ── Daily table ──
    reqs += text_box(s_daily, "daily_t", "日次推移（データテーブル）",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    import random
    random.seed(42)
    daily_data = []
    for d in range(7):
        ds = f"2026-03-{d+7:02d}"
        imp = random.randint(7000, 13000)
        cl = int(imp * random.uniform(0.012, 0.018))
        sp = int(cl * random.uniform(70, 110))
        cv = random.choice([0, 1, 1, 2, 2, 3])
        daily_data.append((ds, sp, cv, sp//cv if cv > 0 else 0, cl/imp*100 if imp > 0 else 0))
    daily_rows = [[ds, fmt_yen(sp*1.2), str(cv), fmt_yen(cpa) if cv > 0 else "-", fmt_pct(ctr)]
                   for ds, sp, cv, cpa, ctr in daily_data]
    reqs += table(s_daily, "daily_tbl",
                  ["日付", "消化額(Fee込)", "CV", "CPA", "CTR"],
                  daily_rows, 500000, 800000, 9000000, 2800000)

    # ── Daily charts (embedded from spreadsheet) ──
    reqs += text_box(s_daily_chart, "dailyc_t", "日次推移 チャート",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    daily_charts = chart_map.get("日次推移", [])
    for i, (cid, ctitle) in enumerate(daily_charts[:2]):
        x = 300000 + i * 4800000
        reqs += sheets_chart(s_daily_chart, f"chart_daily_{i}", ss_id, cid, x, 750000, 4500000, 3800000)

    # ── Device table + charts ──
    reqs += text_box(s_device, "dev_t", "デバイス別パフォーマンス",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    devices = [
        ("モバイルアプリ", 176450, 24, 7352, 50.0),
        ("モバイルWeb", 70580, 7, 10083, 20.0),
        ("デスクトップ", 88225, 11, 8020, 25.0),
        ("タブレット", 17645, 3, 5882, 5.0),
    ]
    dev_rows = [[n, fmt_yen(s*1.2), str(cv), fmt_yen(cpa), fmt_pct(share)]
                 for n, s, cv, cpa, share in devices]
    reqs += table(s_device, "dev_tbl",
                  ["デバイス", "消化額(Fee込)", "CV", "CPA", "構成比"],
                  dev_rows, 300000, 800000, 5000000, 2200000)
    # Embed device charts next to table
    dev_charts = chart_map.get("デバイス別", [])
    for i, (cid, ctitle) in enumerate(dev_charts[:2]):
        y = 800000 + i * 2200000
        reqs += sheets_chart(s_device, f"chart_dev_{i}", ss_id, cid, 5500000, y, 4200000, 2000000)

    # ── Device chart full page ──
    reqs += text_box(s_device_chart, "devc_t", "デバイス別 チャート詳細",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    for i, (cid, ctitle) in enumerate(dev_charts[:2]):
        x = 300000 + i * 4800000
        reqs += sheets_chart(s_device_chart, f"chart_devfull_{i}", ss_id, cid, x, 750000, 4500000, 3800000)

    # ── Demographics ──
    reqs += text_box(s_demo, "demo_t", "属性別パフォーマンス（年齢×性別）",
                     500000, 200000, 6000000, 450000, 22, bold=True, color=NAVY)
    reqs += text_box(s_demo, "demo_sub", "CV数マトリクス（条件付き書式ヒートマップ）",
                     500000, 600000, 5000000, 300000, 12, color=MID_GRAY)
    ages = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    demo_headers = ["性別"] + ages
    demo_rows = [
        ["女性", "3", "10", "6", "4", "2", "1"],
        ["男性", "2", "8", "5", "3", "1", "0"],
    ]
    reqs += table(s_demo, "demo_tbl", demo_headers, demo_rows,
                  500000, 1000000, 8500000, 1200000)
    # Embed demographic chart if available
    demo_charts = chart_map.get("属性別(年齢×性別)", [])
    if demo_charts:
        reqs += sheets_chart(s_demo, "chart_demo_0", ss_id, demo_charts[0][0],
                             1500000, 2500000, 7000000, 2500000)

    # ── Heatmap (曜日×時間帯) ──
    reqs += text_box(s_heatmap, "heat_t", "曜日×時間帯 配信分析",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    reqs += text_box(s_heatmap, "heat_sub",
                     "CV数・CPA・消化額のヒートマップ（条件付き書式で色分け）\n※ スプレッドシートで詳細を確認できます",
                     500000, 700000, 8000000, 400000, 11, color=MID_GRAY)
    # Summary text for heatmap since the 24-col table won't fit in slides
    random.seed(42)
    hourly_cv = {}
    for h in range(24):
        if 9 <= h <= 21:
            hourly_cv[h] = random.randint(2, 8)
        elif 6 <= h <= 23:
            hourly_cv[h] = random.randint(0, 2)
        else:
            hourly_cv[h] = 0
    sorted_h = sorted(hourly_cv.items(), key=lambda x: x[1], reverse=True)
    best3 = sorted_h[:3]
    worst3 = sorted(hourly_cv.items(), key=lambda x: x[1])[:3]
    total_hcv = sum(hourly_cv.values())
    heat_body = "\n".join([
        f"■ 時間帯別CV（全{len(hourly_cv)}時間帯・合計CV: {total_hcv}件）",
        "",
        "【CV獲得 TOP3】",
        "　" + "、".join(f"{h}時 ({v}件)" for h, v in best3),
        "",
        "【CV獲得 BOTTOM3】",
        "　" + "、".join(f"{h}時 ({v}件)" for h, v in worst3),
        "",
        "■ 曜日別傾向",
        "　平日（月～金）のCPAが土日より約15%効率的。",
        "　火・水曜の午前10-12時がCPA最安のゴールデンタイム。",
    ])
    reqs += text_box(s_heatmap, "heat_body", heat_body,
                     500000, 1200000, 9100000, 3500000, 13, color=NAVY)

    # ── Analysis ──
    reqs += text_box(s_analysis, "anl_t", "分析・総評",
                     500000, 200000, 2800000, 450000, 22, bold=True, color=NAVY)
    reqs += text_box(s_analysis, "anl_summary",
                     "当月は獲得件数・獲得単価ともに目標を達成。\n特に検索経由の獲得効率が大幅に改善。",
                     500000, 800000, 9100000, 700000, 14, color=NAVY)
    reqs += text_box(s_analysis, "anl_perf",
                     "CV数45件（目標40件/達成率112.5%）\nCPA ¥7,844（目標¥8,500/達成率92.3%）",
                     500000, 1600000, 9100000, 600000, 14, color=MID_GRAY)
    insights = "\n".join([
        "■ 示唆",
        "・検索キャンペーンのCV効率が最も高い（CPA ¥6,873）",
        "・モバイルデバイスからのCV比率が68%と高い",
        "・25-34歳女性セグメントのCPAが最安（¥4,200）",
    ])
    reqs += text_box(s_analysis, "anl_insights", insights,
                     500000, 2400000, 9100000, 2500000, 13, color=NAVY)

    # ── Action plan ──
    reqs += text_box(s_action, "act_t", "改善施策・次月アクション",
                     500000, 200000, 5000000, 450000, 22, bold=True, color=NAVY)
    improvements = "\n".join([
        "■ 改善施策",
        "・検索キャンペーンの予算配分を増加（現在43%→55%目標）",
        "・モバイル向けクリエイティブの強化（縦型動画の追加制作）",
        "・リターゲティングウィンドウの拡大（7日→14日）",
    ])
    reqs += text_box(s_action, "act_imp", improvements,
                     500000, 800000, 9100000, 1800000, 13, color=NAVY)
    recommendations = "\n".join([
        "■ 推奨アクション",
        "・15秒版動画を新規制作し認知拡大キャンペーンのCV率改善",
        "・土日のCPAが平日比+15%のため配信時間帯を調整",
        "・25-34歳セグメントへの配信強化",
    ])
    reqs += text_box(s_action, "act_rec", recommendations,
                     500000, 2800000, 9100000, 2000000, 13, color=BLUE)

    # ── Apply all ──
    print(f"\nApplying {len(reqs)} requests...")
    slides_svc.presentations().batchUpdate(presentationId=pres_id, body={"requests": reqs}).execute()

    print(f"\nDone! 12 slides (cover + 11 content)")
    print(f"  - スプレッドシート: https://docs.google.com/spreadsheets/d/{ss_id}/edit")
    print(f"  - スライド: {pres_url}")
    return pres_url


if __name__ == "__main__":
    main()
