#!/usr/bin/env python3
"""
広告レポート スプレッドシート生成スクリプト（サンプルデータ版）
export-sheet/route.ts と同等のフォーマットで11シート構成のレポートを生成する。
"""

import json
import os
import sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/Library/Application Support/gws/credentials.json")

# Colors (same as route.ts)
NAVY = {"red": 0.106, "green": 0.165, "blue": 0.29}
BLUE = {"red": 0.173, "green": 0.322, "blue": 0.51}
GREEN = {"red": 0.02, "green": 0.588, "blue": 0.412}
ORANGE = {"red": 0.851, "green": 0.467, "blue": 0.024}
TEAL = {"red": 0.051, "green": 0.58, "blue": 0.533}
PURPLE = {"red": 0.486, "green": 0.227, "blue": 0.929}
LIGHT_GRAY = {"red": 0.95, "green": 0.95, "blue": 0.95}
BORDER_GRAY = {"red": 0.85, "green": 0.85, "blue": 0.85}
RANK_A = {"red": 0.863, "green": 0.988, "blue": 0.906}
RANK_B = {"red": 0.996, "green": 0.953, "blue": 0.78}
RANK_C = {"red": 0.996, "green": 0.886, "blue": 0.886}
WHITE = {"red": 1, "green": 1, "blue": 1}

def get_credentials():
    with open(CREDS_PATH) as f:
        creds_data = json.load(f)
    creds = Credentials(
        token=creds_data.get("token"),
        refresh_token=creds_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=creds_data.get("client_id"),
        client_secret=creds_data.get("client_secret"),
        scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    )
    if creds.expired or not creds.valid:
        creds.refresh(Request())
    return creds

def header_request(sheet_id, row_index, col_count):
    return {
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": row_index, "endRowIndex": row_index + 1, "startColumnIndex": 0, "endColumnIndex": col_count},
            "cell": {"userEnteredFormat": {"backgroundColor": NAVY, "textFormat": {"bold": True, "foregroundColor": WHITE, "fontSize": 10}}},
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    }

def total_row_request(sheet_id, row_index, col_count):
    return {
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": row_index, "endRowIndex": row_index + 1, "startColumnIndex": 0, "endColumnIndex": col_count},
            "cell": {"userEnteredFormat": {"backgroundColor": LIGHT_GRAY, "textFormat": {"bold": True}}},
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    }

def border_request(sheet_id, start_row, end_row, start_col, end_col):
    border = {"style": "SOLID", "color": BORDER_GRAY}
    return {
        "updateBorders": {
            "range": {"sheetId": sheet_id, "startRowIndex": start_row, "endRowIndex": end_row, "startColumnIndex": start_col, "endColumnIndex": end_col},
            "top": border, "bottom": border, "left": border, "right": border, "innerHorizontal": border, "innerVertical": border,
        }
    }

def number_format_request(sheet_id, start_row, end_row, start_col, end_col, pattern):
    return {
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": start_row, "endRowIndex": end_row, "startColumnIndex": start_col, "endColumnIndex": end_col},
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": pattern}}},
            "fields": "userEnteredFormat.numberFormat",
        }
    }

def auto_resize(sheet_id, end_col):
    return {"autoResizeDimensions": {"dimensions": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": end_col}}}


def main():
    creds = get_credentials()
    service = build("sheets", "v4", credentials=creds)

    project_name = "サンプルクライアント"
    period_label = "2026年2月12日 ～ 2026年3月13日"
    output_date = "2026/03/13"
    title = f"広告運用レポート_{project_name}_{output_date}"

    # 11 sheets
    sheets_config = [
        {"properties": {"title": "表紙", "index": 0, "tabColorStyle": {"rgbColor": NAVY}}},
        {"properties": {"title": "サマリー", "index": 1, "tabColorStyle": {"rgbColor": BLUE}}},
        {"properties": {"title": "全体概要", "index": 2, "tabColorStyle": {"rgbColor": GREEN}}},
        {"properties": {"title": "キャンペーン別", "index": 3, "tabColorStyle": {"rgbColor": ORANGE}}},
        {"properties": {"title": "広告セット別", "index": 4, "tabColorStyle": {"rgbColor": ORANGE}}},
        {"properties": {"title": "クリエイティブ別", "index": 5, "tabColorStyle": {"rgbColor": ORANGE}}},
        {"properties": {"title": "日次推移", "index": 6, "tabColorStyle": {"rgbColor": TEAL}}},
        {"properties": {"title": "AI分析", "index": 7, "tabColorStyle": {"rgbColor": PURPLE}}},
        {"properties": {"title": "デバイス別", "index": 8, "tabColorStyle": {"rgbColor": TEAL}}},
        {"properties": {"title": "属性別(年齢×性別)", "index": 9, "tabColorStyle": {"rgbColor": GREEN}}},
        {"properties": {"title": "曜日×時間帯", "index": 10, "tabColorStyle": {"rgbColor": ORANGE}}},
    ]

    result = service.spreadsheets().create(body={
        "properties": {"title": title, "locale": "ja_JP"},
        "sheets": sheets_config,
    }).execute()

    spreadsheet_id = result["spreadsheetId"]
    spreadsheet_url = result["spreadsheetUrl"]
    print(f"Created: {spreadsheet_url}")

    sheet_ids = {}
    for s in result["sheets"]:
        sheet_ids[s["properties"]["title"]] = s["properties"]["sheetId"]

    # ---- Sample data ----
    # Cover
    cover = [[""], [""], [f"{project_name}　御中"], [""], [""], [""], [""], [""], [""], [""], [""], [""], [""], [period_label], [""], [""], [""], [""], [f"提出日: {output_date}"]]

    # Summary
    summary = [
        ["1. 予算サマリー"],
        ["ご予算/月", 500000],
        ["ご利用額/月", 423500],
        ["ご利用率/月", 0.847],
        [],
        ["2. 広告結果サマリー"],
        ["獲得件数", 45, "↗12.5%"],
        ["獲得単価", 7844, "↘8.3%"],
        ["ROAS", "2.15x", "-"],
        ["ご利用額", 352900, "↗5.2%"],
        [],
        ["3. 総評"],
        [period_label],
        ["獲得件数：45件　　獲得単価：¥7,844"],
        ["■ 期間内パフォーマンス"],
        ["全体のCV数は前月比+12.5%と好調に推移。CPAも¥7,844と目標値を下回っている。"],
        ["特にモバイルデバイスでのCV効率が高く、25-34歳女性セグメントが最もCPA効率が良い。"],
    ]

    # Campaigns
    campaigns = [
        ["No.", "キャンペーン", "表示回数", "クリック数", "クリック率", "クリック単価", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得率", "獲得単価", "ROAS", "ランク"],
        ["合計", "-", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-", "-"],
        [1, "リード獲得_検索", 120000, 2100, 0.0175, 72, 151200, 181440, 22, 0.0105, 6873, "2.4", "A"],
        [2, "リード獲得_ディスプレイ", 95000, 1200, 0.0126, 92, 110400, 132480, 15, 0.0125, 7360, "1.8", "A"],
        [3, "認知拡大_動画", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, "1.2", "B"],
        [4, "リターゲティング", 20000, 300, 0.015, 95, 28300, 33960, 3, 0.01, 9433, "1.5", "B"],
    ]

    # Adsets
    adsets = [
        ["No.", "キャンペーン", "広告セット", "表示回数", "クリック数", "クリック率", "クリック単価", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得率", "獲得単価", "ランク"],
        ["合計", "-", "-", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-"],
        [1, "リード獲得_検索", "25-34_興味関心", 55000, 1050, 0.0191, 65, 68250, 81900, 12, 0.0114, 5688, "A"],
        [2, "リード獲得_検索", "35-44_類似", 65000, 1050, 0.0162, 79, 82950, 99540, 10, 0.0095, 8295, "B"],
        [3, "リード獲得_ディスプレイ", "全年齢_興味関心", 95000, 1200, 0.0126, 92, 110400, 132480, 15, 0.0125, 7360, "A"],
        [4, "認知拡大_動画", "18-24_ブロード", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, "C"],
        [5, "リターゲティング", "サイト訪問者_7日", 20000, 300, 0.015, 95, 28300, 33960, 3, 0.01, 9433, "B"],
    ]

    # Creatives
    creatives = [
        ["No.", "画像", "キャンペーン", "広告セット", "クリエイティブ名", "表示回数", "クリック数", "クリック率", "クリック単価", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得率", "獲得単価", "ランク"],
        ["合計", "", "-", "-", "-", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-"],
        [1, "", "リード獲得_検索", "25-34_興味関心", "動画訴求A_縦型", 35000, 700, 0.02, 58, 40600, 48720, 8, 0.0114, 5075, "A"],
        [2, "", "リード獲得_検索", "25-34_興味関心", "静止画_特典訴求", 20000, 350, 0.0175, 72, 25200, 30240, 4, 0.0114, 6300, "A"],
        [3, "", "リード獲得_ディスプレイ", "全年齢_興味関心", "カルーセル_事例", 45000, 600, 0.0133, 88, 52800, 63360, 8, 0.0133, 6600, "A"],
        [4, "", "リード獲得_ディスプレイ", "全年齢_興味関心", "バナー_キャンペーン", 50000, 600, 0.012, 96, 57600, 69120, 7, 0.0117, 8229, "B"],
        [5, "", "認知拡大_動画", "18-24_ブロード", "ブランド動画_15秒", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, "C"],
    ]

    # Daily (sample 7 days)
    daily = [
        ["日付", "曜日", "表示回数", "クリック数", "クリック率", "クリック単価", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得率", "獲得単価"],
        ["2026-03-07", "土", 8500, 125, 0.0147, 82, 10250, 12300, 1, 0.008, 10250],
        ["2026-03-08", "日", 7200, 98, 0.0136, 88, 8624, 10349, 1, 0.0102, 8624],
        ["2026-03-09", "月", 10200, 160, 0.0157, 78, 12480, 14976, 2, 0.0125, 6240],
        ["2026-03-10", "火", 11500, 175, 0.0152, 75, 13125, 15750, 3, 0.0171, 4375],
        ["2026-03-11", "水", 10800, 155, 0.0144, 80, 12400, 14880, 2, 0.0129, 6200],
        ["2026-03-12", "木", 11000, 168, 0.0153, 77, 12936, 15523, 2, 0.0119, 6468],
        ["2026-03-13", "金", 9800, 142, 0.0145, 82, 11644, 13973, 2, 0.0141, 5822],
        ["合計", "-", 69000, 1023, 0.0148, 80, 81459, 97751, 13, 0.0127, 6266],
    ]

    # AI Analysis
    ai = [
        ["1. 総合分析"],
        ["サマリー", "全体のCV数は45件で、前月比+12.5%と好調に推移。CPAは¥7,844と前月比-8.3%で改善傾向。"],
        ["示唆", "検索キャンペーンのCV効率が最も高い（CPA ¥6,873）\nモバイルデバイスからのCV比率が68%と高い\n25-34歳女性セグメントのCPAが最安（¥4,200）"],
        ["推奨アクション", "検索キャンペーンの予算配分を増加（現在43%→55%目標）\nモバイル向けクリエイティブの強化\n25-34歳セグメントへの配信強化"],
        [],
        ["2. クライアント向けコメント"],
        ["総評", "当月は獲得件数・獲得単価ともに目標を達成。特に検索経由の獲得効率が大幅に改善。"],
        ["期間内パフォーマンス", "CV数45件（目標40件に対し達成率112.5%）、CPA ¥7,844（目標¥8,500に対し92.3%）と効率的に獲得。"],
        [],
        ["3. 改善施策"],
        ["アクション", "動画クリエイティブの15秒版を新規制作し、認知拡大キャンペーンのCV率改善を図る\nリターゲティングのウィンドウを7日→14日に拡大し、母数を増加させる\n週末の配信強化（土日のCPAが平日比+15%のため配信調整）"],
        [],
        ["4. 振り返り"],
        ["振り返り", "【良かった点】検索キャンペーンのCPA改善が顕著。新規クリエイティブ「動画訴求A_縦型」が最高効率\n【課題】認知拡大キャンペーンのCPAが全体平均の1.6倍。動画完視聴率が低い\n【次月方針】検索への予算シフト+動画クリエイティブの改善テスト"],
    ]

    # Device breakdown
    device = [
        ["デバイス", "表示回数", "クリック数", "クリック率", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得単価", "構成比(費用)"],
        ["合計", 285000, 4200, 0.0147, 352900, 423480, 45, 7844, 1],
        ["mobile_app", 142500, 2310, 0.0162, 176450, 211740, 24, 7352, 0.5],
        ["mobile_web", 57000, 840, 0.0147, 70580, 84696, 7, 10083, 0.2],
        ["desktop", 71250, 840, 0.0118, 88225, 105870, 11, 8020, 0.25],
        ["tablet", 14250, 210, 0.0147, 17645, 21174, 3, 5882, 0.05],
    ]

    # Demographic breakdown (CV)
    ages = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    demo_cv = [
        ["CV数（年齢×性別）"],
        [""] + ages,
        ["男性", 2, 8, 5, 3, 1, 0],
        ["女性", 3, 10, 6, 4, 2, 1],
        ["不明", 0, 0, 0, 0, 0, 0],
        [],
        ["CPA（年齢×性別）"],
        [""] + ages,
        ["男性", 12500, 5800, 7200, 9500, 15000, 0],
        ["女性", 8500, 4200, 6100, 8200, 11000, 18000],
        ["不明", 0, 0, 0, 0, 0, 0],
        [],
        ["消化額（年齢×性別）"],
        [""] + ages,
        ["男性", 25000, 46400, 36000, 28500, 15000, 0],
        ["女性", 25500, 42000, 36600, 32800, 22000, 18000],
        ["不明", 0, 0, 0, 0, 0, 0],
    ]

    # Hourly heatmap
    days_ja = ["月", "火", "水", "木", "金", "土", "日"]
    hours = [f"{h}時" for h in range(24)]
    import random
    random.seed(42)

    heatmap_cv = [["CV数（曜日×時間帯）"], [""] + hours]
    for day in days_ja:
        row = [day]
        for h in range(24):
            if 6 <= h <= 23:
                cv = random.choice([0, 0, 0, 1, 1, 1, 2, 2, 3]) if 9 <= h <= 21 else random.choice([0, 0, 0, 1])
            else:
                cv = 0
            row.append(cv)
        heatmap_cv.append(row)

    heatmap_cv.append([])
    heatmap_cv.append(["CPA（曜日×時間帯）"])
    heatmap_cv.append([""] + hours)
    for day in days_ja:
        row = [day]
        for h in range(24):
            if 6 <= h <= 23:
                cpa = random.randint(4000, 15000) if 9 <= h <= 21 else random.randint(8000, 20000)
            else:
                cpa = 0
            row.append(cpa)
        heatmap_cv.append(row)

    heatmap_cv.append([])
    heatmap_cv.append(["消化額（曜日×時間帯）"])
    heatmap_cv.append([""] + hours)
    for day in days_ja:
        row = [day]
        for h in range(24):
            if 6 <= h <= 23:
                spend = random.randint(500, 3500) if 9 <= h <= 21 else random.randint(100, 800)
            else:
                spend = random.randint(0, 100)
            row.append(spend)
        heatmap_cv.append(row)

    # Write all data
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "valueInputOption": "USER_ENTERED",
            "data": [
                {"range": "表紙!A1", "values": cover},
                {"range": "サマリー!A3", "values": summary},
                {"range": "全体概要!A1", "values": [["サンプルデータのため省略"]]},
                {"range": "キャンペーン別!A1", "values": campaigns},
                {"range": "広告セット別!A1", "values": adsets},
                {"range": "クリエイティブ別!A1", "values": creatives},
                {"range": "日次推移!A1", "values": daily},
                {"range": "AI分析!A1", "values": ai},
                {"range": "デバイス別!A1", "values": device},
                {"range": "'属性別(年齢×性別)'!A1", "values": demo_cv},
                {"range": "'曜日×時間帯'!A1", "values": heatmap_cv},
            ],
        },
    ).execute()

    # Format requests
    fmt = []

    # Cover formatting
    cover_id = sheet_ids["表紙"]
    fmt.append({
        "mergeCells": {
            "range": {"sheetId": cover_id, "startRowIndex": 2, "endRowIndex": 3, "startColumnIndex": 0, "endColumnIndex": 6},
            "mergeType": "MERGE_ALL",
        }
    })
    fmt.append({
        "repeatCell": {
            "range": {"sheetId": cover_id, "startRowIndex": 2, "endRowIndex": 3, "startColumnIndex": 0, "endColumnIndex": 1},
            "cell": {"userEnteredFormat": {"textFormat": {"fontSize": 18, "bold": True, "foregroundColor": NAVY}}},
            "fields": "userEnteredFormat.textFormat",
        }
    })

    # Summary formatting
    sid = sheet_ids["サマリー"]
    for r in [2, 7, 13]:
        fmt.append(header_request(sid, r, 6))
    fmt.append(number_format_request(sid, 3, 6, 1, 2, "¥#,##0"))
    fmt.append(number_format_request(sid, 3, 6, 2, 3, "0.0%"))
    fmt.append(number_format_request(sid, 8, 12, 1, 2, "¥#,##0"))
    fmt.append(auto_resize(sid, 6))

    # Campaign formatting
    cid = sheet_ids["キャンペーン別"]
    fmt.append(header_request(cid, 0, 13))
    fmt.append(total_row_request(cid, 1, 13))
    fmt.append(number_format_request(cid, 1, len(campaigns), 2, 4, "#,##0"))
    fmt.append(number_format_request(cid, 1, len(campaigns), 4, 5, "0.00%"))
    fmt.append(number_format_request(cid, 1, len(campaigns), 5, 8, "¥#,##0"))
    fmt.append(number_format_request(cid, 1, len(campaigns), 8, 9, "#,##0"))
    fmt.append(number_format_request(cid, 1, len(campaigns), 9, 10, "0.00%"))
    fmt.append(number_format_request(cid, 1, len(campaigns), 10, 11, "¥#,##0"))
    fmt.append(border_request(cid, 0, len(campaigns), 0, 13))
    # Rank colors
    rank_colors = {"A": RANK_A, "B": RANK_B, "C": RANK_C}
    for i in range(2, len(campaigns)):
        rank = str(campaigns[i][12])
        if rank in rank_colors:
            fmt.append({
                "repeatCell": {
                    "range": {"sheetId": cid, "startRowIndex": i, "endRowIndex": i + 1, "startColumnIndex": 12, "endColumnIndex": 13},
                    "cell": {"userEnteredFormat": {"backgroundColor": rank_colors[rank]}},
                    "fields": "userEnteredFormat.backgroundColor",
                }
            })
    fmt.append(auto_resize(cid, 13))

    # Adset formatting
    aid = sheet_ids["広告セット別"]
    fmt.append(header_request(aid, 0, 13))
    fmt.append(total_row_request(aid, 1, 13))
    fmt.append(number_format_request(aid, 1, len(adsets), 3, 5, "#,##0"))
    fmt.append(number_format_request(aid, 1, len(adsets), 5, 6, "0.00%"))
    fmt.append(number_format_request(aid, 1, len(adsets), 6, 9, "¥#,##0"))
    fmt.append(number_format_request(aid, 1, len(adsets), 9, 10, "#,##0"))
    fmt.append(number_format_request(aid, 1, len(adsets), 10, 11, "0.00%"))
    fmt.append(number_format_request(aid, 1, len(adsets), 11, 12, "¥#,##0"))
    fmt.append(border_request(aid, 0, len(adsets), 0, 13))
    for i in range(2, len(adsets)):
        rank = str(adsets[i][12])
        if rank in rank_colors:
            fmt.append({
                "repeatCell": {
                    "range": {"sheetId": aid, "startRowIndex": i, "endRowIndex": i + 1, "startColumnIndex": 12, "endColumnIndex": 13},
                    "cell": {"userEnteredFormat": {"backgroundColor": rank_colors[rank]}},
                    "fields": "userEnteredFormat.backgroundColor",
                }
            })
    fmt.append(auto_resize(aid, 13))

    # Creative formatting
    cr_id = sheet_ids["クリエイティブ別"]
    fmt.append(header_request(cr_id, 0, 15))
    fmt.append(total_row_request(cr_id, 1, 15))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 5, 7, "#,##0"))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 7, 8, "0.00%"))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 8, 11, "¥#,##0"))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 11, 12, "#,##0"))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 12, 13, "0.00%"))
    fmt.append(number_format_request(cr_id, 1, len(creatives), 13, 14, "¥#,##0"))
    fmt.append(border_request(cr_id, 0, len(creatives), 0, 15))
    for i in range(2, len(creatives)):
        rank = str(creatives[i][14])
        if rank in rank_colors:
            fmt.append({
                "repeatCell": {
                    "range": {"sheetId": cr_id, "startRowIndex": i, "endRowIndex": i + 1, "startColumnIndex": 14, "endColumnIndex": 15},
                    "cell": {"userEnteredFormat": {"backgroundColor": rank_colors[rank]}},
                    "fields": "userEnteredFormat.backgroundColor",
                }
            })
    fmt.append(auto_resize(cr_id, 15))

    # Daily formatting
    did = sheet_ids["日次推移"]
    fmt.append(header_request(did, 0, 11))
    fmt.append(total_row_request(did, len(daily) - 1, 11))
    fmt.append(number_format_request(did, 1, len(daily), 2, 4, "#,##0"))
    fmt.append(number_format_request(did, 1, len(daily), 4, 5, "0.00%"))
    fmt.append(number_format_request(did, 1, len(daily), 5, 8, "¥#,##0"))
    fmt.append(number_format_request(did, 1, len(daily), 8, 9, "#,##0"))
    fmt.append(number_format_request(did, 1, len(daily), 9, 10, "0.00%"))
    fmt.append(number_format_request(did, 1, len(daily), 10, 11, "¥#,##0"))
    fmt.append(border_request(did, 0, len(daily), 0, 11))
    # Weekend highlighting
    for i, row in enumerate(daily[1:], 1):
        if row[1] in ("土", "日"):
            fmt.append({
                "repeatCell": {
                    "range": {"sheetId": did, "startRowIndex": i, "endRowIndex": i + 1, "startColumnIndex": 0, "endColumnIndex": 11},
                    "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.937, "green": 0.965, "blue": 1}}},
                    "fields": "userEnteredFormat.backgroundColor",
                }
            })
    fmt.append(auto_resize(did, 11))

    # AI Analysis formatting
    ai_id = sheet_ids["AI分析"]
    for r in [0, 5, 9, 12]:
        fmt.append(header_request(ai_id, r, 2))
    fmt.append(border_request(ai_id, 0, len(ai), 0, 2))
    fmt.append({
        "repeatCell": {
            "range": {"sheetId": ai_id, "startRowIndex": 0, "endRowIndex": len(ai), "startColumnIndex": 0, "endColumnIndex": 2},
            "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}},
            "fields": "userEnteredFormat(wrapStrategy,verticalAlignment)",
        }
    })
    fmt.append(auto_resize(ai_id, 2))

    # Device breakdown formatting
    dev_id = sheet_ids["デバイス別"]
    fmt.append(header_request(dev_id, 0, 9))
    fmt.append(total_row_request(dev_id, 1, 9))
    fmt.append(number_format_request(dev_id, 1, len(device), 1, 3, "#,##0"))
    fmt.append(number_format_request(dev_id, 1, len(device), 3, 4, "0.00%"))
    fmt.append(number_format_request(dev_id, 1, len(device), 4, 6, "¥#,##0"))
    fmt.append(number_format_request(dev_id, 1, len(device), 6, 7, "#,##0"))
    fmt.append(number_format_request(dev_id, 1, len(device), 7, 8, "¥#,##0"))
    fmt.append(number_format_request(dev_id, 1, len(device), 8, 9, "0.0%"))
    fmt.append(border_request(dev_id, 0, len(device), 0, 9))
    fmt.append(auto_resize(dev_id, 9))

    # Demographic formatting
    demo_id = sheet_ids["属性別(年齢×性別)"]
    for r in [0, 6, 12]:
        fmt.append(header_request(demo_id, r, 7))
    for r in [1, 7, 13]:
        fmt.append({
            "repeatCell": {
                "range": {"sheetId": demo_id, "startRowIndex": r, "endRowIndex": r + 1, "startColumnIndex": 0, "endColumnIndex": 7},
                "cell": {"userEnteredFormat": {"backgroundColor": LIGHT_GRAY, "textFormat": {"bold": True}}},
                "fields": "userEnteredFormat(backgroundColor,textFormat)",
            }
        })
    fmt.append(number_format_request(demo_id, 2, 5, 1, 7, "#,##0"))
    fmt.append(number_format_request(demo_id, 8, 11, 1, 7, "¥#,##0"))
    fmt.append(number_format_request(demo_id, 14, 17, 1, 7, "¥#,##0"))
    fmt.append(border_request(demo_id, 0, len(demo_cv), 0, 7))
    fmt.append(auto_resize(demo_id, 7))

    # Heatmap formatting
    heat_id = sheet_ids["曜日×時間帯"]
    for r in [0, 10, 20]:
        fmt.append(header_request(heat_id, r, 25))
    for r in [1, 11, 21]:
        fmt.append({
            "repeatCell": {
                "range": {"sheetId": heat_id, "startRowIndex": r, "endRowIndex": r + 1, "startColumnIndex": 0, "endColumnIndex": 25},
                "cell": {"userEnteredFormat": {"backgroundColor": LIGHT_GRAY, "textFormat": {"bold": True, "fontSize": 9}}},
                "fields": "userEnteredFormat(backgroundColor,textFormat)",
            }
        })
    fmt.append(number_format_request(heat_id, 2, 9, 1, 25, "#,##0"))
    fmt.append(number_format_request(heat_id, 12, 19, 1, 25, "¥#,##0"))
    fmt.append(number_format_request(heat_id, 22, 29, 1, 25, "¥#,##0"))
    fmt.append(border_request(heat_id, 0, len(heatmap_cv), 0, 25))
    fmt.append(auto_resize(heat_id, 25))

    # Apply all formatting
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": fmt},
    ).execute()

    print(f"\nDone! 11 sheets created.")
    print(f"URL: {spreadsheet_url}")
    return spreadsheet_url


if __name__ == "__main__":
    url = main()
