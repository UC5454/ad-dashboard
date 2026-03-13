#!/usr/bin/env python3
"""
広告レポート スプレッドシート生成スクリプト v2
グラフ付き・体裁改善版。export-sheet/route.ts と同等構成。
"""
import json, os, random
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser("~/Library/Application Support/gws/credentials.json")

# ── Colors ──
NAVY = {"red": 0.106, "green": 0.165, "blue": 0.29}
BLUE = {"red": 0.173, "green": 0.322, "blue": 0.51}
GREEN = {"red": 0.02, "green": 0.588, "blue": 0.412}
ORANGE = {"red": 0.851, "green": 0.467, "blue": 0.024}
TEAL = {"red": 0.051, "green": 0.58, "blue": 0.533}
PURPLE = {"red": 0.486, "green": 0.227, "blue": 0.929}
LIGHT_GRAY = {"red": 0.95, "green": 0.95, "blue": 0.95}
ALTERNATE = {"red": 0.96, "green": 0.97, "blue": 0.98}
BORDER_GRAY = {"red": 0.82, "green": 0.82, "blue": 0.82}
WHITE = {"red": 1, "green": 1, "blue": 1}
WEEKEND_BG = {"red": 0.93, "green": 0.95, "blue": 1.0}
RANK_A = {"red": 0.85, "green": 0.99, "blue": 0.9}
RANK_B = {"red": 1.0, "green": 0.95, "blue": 0.78}
RANK_C = {"red": 1.0, "green": 0.88, "blue": 0.88}
RANK_D = {"red": 0.95, "green": 0.95, "blue": 0.96}
COVER_BG = {"red": 0.067, "green": 0.11, "blue": 0.2}

# Heatmap gradient (low→high)
HEAT_LOW  = {"red": 0.96, "green": 0.97, "blue": 0.98}
HEAT_MID  = {"red": 0.70, "green": 0.84, "blue": 0.95}
HEAT_HIGH = {"red": 0.17, "green": 0.32, "blue": 0.51}

def get_creds():
    with open(CREDS_PATH) as f:
        d = json.load(f)
    c = Credentials(token=d.get("token"), refresh_token=d.get("refresh_token"),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=d.get("client_id"), client_secret=d.get("client_secret"),
                    scopes=["https://www.googleapis.com/auth/spreadsheets","https://www.googleapis.com/auth/drive"])
    if c.expired or not c.valid:
        c.refresh(Request())
    return c

# ── Formatting helpers ──
def hdr(sid, row, cols):
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":row,"endRowIndex":row+1,"startColumnIndex":0,"endColumnIndex":cols},
        "cell":{"userEnteredFormat":{"backgroundColor":NAVY,"textFormat":{"bold":True,"foregroundColor":WHITE,"fontSize":10},
            "horizontalAlignment":"CENTER","verticalAlignment":"MIDDLE","padding":{"top":4,"bottom":4,"left":6,"right":6}}},
        "fields":"userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)"}}

def total_row(sid, row, cols):
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":row,"endRowIndex":row+1,"startColumnIndex":0,"endColumnIndex":cols},
        "cell":{"userEnteredFormat":{"backgroundColor":LIGHT_GRAY,"textFormat":{"bold":True},"horizontalAlignment":"RIGHT"}},
        "fields":"userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"}}

def brd(sid, sr, er, sc, ec):
    b = {"style":"SOLID","color":BORDER_GRAY}
    return {"updateBorders":{"range":{"sheetId":sid,"startRowIndex":sr,"endRowIndex":er,"startColumnIndex":sc,"endColumnIndex":ec},
        "top":b,"bottom":b,"left":b,"right":b,"innerHorizontal":b,"innerVertical":b}}

def nfmt(sid, sr, er, sc, ec, pat):
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":sr,"endRowIndex":er,"startColumnIndex":sc,"endColumnIndex":ec},
        "cell":{"userEnteredFormat":{"numberFormat":{"type":"NUMBER","pattern":pat}}},
        "fields":"userEnteredFormat.numberFormat"}}

def col_width(sid, col_start, col_end, px):
    return {"updateDimensionProperties":{"range":{"sheetId":sid,"dimension":"COLUMNS","startIndex":col_start,"endIndex":col_end},
        "properties":{"pixelSize":px},"fields":"pixelSize"}}

def row_height(sid, row_start, row_end, px):
    return {"updateDimensionProperties":{"range":{"sheetId":sid,"dimension":"ROWS","startIndex":row_start,"endIndex":row_end},
        "properties":{"pixelSize":px},"fields":"pixelSize"}}

def freeze(sid, rows=1, cols=0):
    return {"updateSheetProperties":{"properties":{"sheetId":sid,"gridProperties":{"frozenRowCount":rows,"frozenColumnCount":cols}},
        "fields":"gridProperties.frozenRowCount,gridProperties.frozenColumnCount"}}

def alt_rows(sid, sr, er, cols):
    """Alternate row coloring for data rows."""
    reqs = []
    for i in range(sr, er):
        if (i - sr) % 2 == 1:
            reqs.append({"repeatCell":{"range":{"sheetId":sid,"startRowIndex":i,"endRowIndex":i+1,"startColumnIndex":0,"endColumnIndex":cols},
                "cell":{"userEnteredFormat":{"backgroundColor":ALTERNATE}},
                "fields":"userEnteredFormat.backgroundColor"}})
    return reqs

def right_align(sid, sr, er, sc, ec):
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":sr,"endRowIndex":er,"startColumnIndex":sc,"endColumnIndex":ec},
        "cell":{"userEnteredFormat":{"horizontalAlignment":"RIGHT"}},
        "fields":"userEnteredFormat.horizontalAlignment"}}

def sub_hdr(sid, row, cols):
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":row,"endRowIndex":row+1,"startColumnIndex":0,"endColumnIndex":cols},
        "cell":{"userEnteredFormat":{"backgroundColor":LIGHT_GRAY,"textFormat":{"bold":True,"fontSize":9},
            "horizontalAlignment":"CENTER","verticalAlignment":"MIDDLE"}},
        "fields":"userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}}

def section_title(sid, row, cols, text_color=NAVY):
    """Bold section title with subtle left border accent."""
    return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":row,"endRowIndex":row+1,"startColumnIndex":0,"endColumnIndex":cols},
        "cell":{"userEnteredFormat":{"textFormat":{"bold":True,"fontSize":11,"foregroundColor":text_color}}},
        "fields":"userEnteredFormat.textFormat"}}

def conditional_gradient(sid, sr, er, sc, ec, min_type="MIN", max_type="MAX"):
    """Conditional formatting: gradient color scale for heatmap cells."""
    return {"addConditionalFormatRule":{"rule":{
        "ranges":[{"sheetId":sid,"startRowIndex":sr,"endRowIndex":er,"startColumnIndex":sc,"endColumnIndex":ec}],
        "gradientRule":{
            "minpoint":{"color":HEAT_LOW,"type":min_type},
            "midpoint":{"color":HEAT_MID,"type":"PERCENTILE","value":"50"},
            "maxpoint":{"color":HEAT_HIGH,"type":max_type},
        }},"index":0}}

def add_chart(sid, title_text, chart_type, domain_range, series_ranges, anchor_row, anchor_col,
              offset_x=0, offset_y=0, width=600, height=350, stacked=False, pie=False):
    """Create an embedded chart request."""
    domain_src = {"sourceRange":{"sources":[domain_range]}}
    series = []
    colors = [BLUE, GREEN, ORANGE, TEAL, PURPLE, {"red":0.8,"green":0.2,"blue":0.2}]
    target_axis = "BOTTOM_AXIS" if chart_type == "BAR" else "LEFT_AXIS"
    for i, sr in enumerate(series_ranges):
        s = {"series":{"sourceRange":{"sources":[sr]}},"targetAxis":target_axis}
        if i < len(colors):
            s["colorStyle"] = {"rgbColor": colors[i]}
        series.append(s)

    if pie:
        spec = {
            "title": title_text,
            "pieChart": {
                "legendPosition": "RIGHT_LEGEND",
                "domain": domain_src,
                "series": series[0]["series"] if series else {},
                "threeDimensional": False,
            }
        }
    else:
        basic = {
            "chartType": chart_type,
            "legendPosition": "BOTTOM_LEGEND",
            "axis": [
                {"position": "BOTTOM_AXIS", "title": ""},
                {"position": "LEFT_AXIS", "title": ""},
            ],
            "domains": [{"domain": domain_src}],
            "series": series,
            "headerCount": 1,
        }
        if stacked:
            basic["stackedType"] = "STACKED"
        spec = {"title": title_text, "basicChart": basic}

    return {"addChart":{"chart":{
        "spec": spec,
        "position":{"overlayPosition":{"anchorCell":{"sheetId":sid,"rowIndex":anchor_row,"columnIndex":anchor_col},
            "offsetXPixels":offset_x,"offsetYPixels":offset_y,"widthPixels":width,"heightPixels":height}},
    }}}


def main():
    creds = get_creds()
    service = build("sheets", "v4", credentials=creds)
    random.seed(42)

    project_name = "サンプルクライアント"
    period_label = "2026年2月12日 ～ 2026年3月13日"
    output_date = "2026/03/13"
    title = f"広告運用レポート_{project_name}_{output_date}"

    sheets_cfg = [
        {"properties":{"title":"表紙","index":0,"tabColorStyle":{"rgbColor":NAVY}}},
        {"properties":{"title":"サマリー","index":1,"tabColorStyle":{"rgbColor":BLUE}}},
        {"properties":{"title":"全体概要","index":2,"tabColorStyle":{"rgbColor":GREEN}}},
        {"properties":{"title":"キャンペーン別","index":3,"tabColorStyle":{"rgbColor":ORANGE}}},
        {"properties":{"title":"広告セット別","index":4,"tabColorStyle":{"rgbColor":ORANGE}}},
        {"properties":{"title":"クリエイティブ別","index":5,"tabColorStyle":{"rgbColor":ORANGE}}},
        {"properties":{"title":"日次推移","index":6,"tabColorStyle":{"rgbColor":TEAL}}},
        {"properties":{"title":"AI分析","index":7,"tabColorStyle":{"rgbColor":PURPLE}}},
        {"properties":{"title":"デバイス別","index":8,"tabColorStyle":{"rgbColor":TEAL}}},
        {"properties":{"title":"属性別(年齢×性別)","index":9,"tabColorStyle":{"rgbColor":GREEN}}},
        {"properties":{"title":"曜日×時間帯","index":10,"tabColorStyle":{"rgbColor":ORANGE}}},
    ]

    res = service.spreadsheets().create(body={"properties":{"title":title,"locale":"ja_JP"},"sheets":sheets_cfg}).execute()
    sid_map = {s["properties"]["title"]: s["properties"]["sheetId"] for s in res["sheets"]}
    ssid = res["spreadsheetId"]
    url = res["spreadsheetUrl"]
    print(f"Created: {url}")

    # ══════════════════════════════════════════════════
    # DATA
    # ══════════════════════════════════════════════════

    cover = [[""],[""],[""],[""],[""],[""],[""],
             [f"{project_name}　御中"],[""],[""],
             ["広告運用レポート"],[""],
             [period_label],[""],[""],[""],[""],[""],
             [f"提出日: {output_date}"],[""],[""],
             ["株式会社SOU"]]

    summary = [
        ["予算サマリー"],[""],
        ["項目","金額","備考"],
        ["ご予算/月", 500000, ""],
        ["ご利用額/月（Fee込）", 423500, "Fee率: 20%"],
        ["ご利用率/月", 0.847, ""],
        ["残予算", 76500, ""],
        [],
        ["広告結果サマリー"],[""],
        ["指標","当月","前月比"],
        ["獲得件数（CV）", 45, "↗ +12.5%"],
        ["獲得単価（CPA）", 7844, "↘ -8.3%（改善）"],
        ["ROAS", "2.15x", "-"],
        ["ご利用額（媒体費）", 352900, "↗ +5.2%"],
        ["表示回数", 285000, "↗ +8.1%"],
        ["クリック数", 4200, "↗ +6.3%"],
        ["クリック率（CTR）", 0.0147, "→ 横ばい"],
        [],
        ["総評コメント"],[""],
        [f"対象期間: {period_label}"],
        ["獲得件数：45件　獲得単価：¥7,844　ROAS：2.15x"],
        [],
        ["■ 期間内パフォーマンス"],
        ["全体のCV数は前月比+12.5%と好調に推移。CPAも¥7,844と目標¥8,500を下回り、効率改善が見られる。"],
        ["モバイルデバイスからのCV比率が68%と高く、25-34歳女性セグメントのCPA効率が最も良い。"],
        [],
        ["■ 次月に向けた改善施策"],
        ["① 検索キャンペーンの予算配分を増加（現在43%→55%目標）"],
        ["② モバイル向けクリエイティブの強化（縦型動画の追加制作）"],
        ["③ リターゲティングウィンドウの拡大（7日→14日）"],
    ]

    # Overview (月別 + 日別)
    overview = [
        ["全体概要"],[""],
        ["1. 月別推移"],[""],
        ["月","表示回数","クリック数","CTR","CPC","ご利用額(Fee込)","CV数","CVR","CPA"],
        ["2026/02", 260000, 3800, 0.0146, 81, 384000, 38, 0.01, 8211],
        ["2026/03", 285000, 4200, 0.0147, 84, 423500, 45, 0.0107, 7844],
        ["前月差", "↗25,000", "↗400", "→", "↗¥3", "↗¥39,500", "↗7", "↗0.07%", "↘¥-367"],
        [],
        ["2. 日別推移（直近7日）"],[""],
        ["日付","表示回数","クリック数","CTR","CPC","ご利用額(Fee込)","CV数","CVR","CPA"],
        ["03/07(土)", 8500, 125, 0.0147, 82, 12300, 1, 0.008, 10250],
        ["03/08(日)", 7200, 98, 0.0136, 88, 10349, 1, 0.0102, 8624],
        ["03/09(月)", 10200, 160, 0.0157, 78, 14976, 2, 0.0125, 6240],
        ["03/10(火)", 11500, 175, 0.0152, 75, 15750, 3, 0.0171, 4375],
        ["03/11(水)", 10800, 155, 0.0144, 80, 14880, 2, 0.0129, 6200],
        ["03/12(木)", 11000, 168, 0.0153, 77, 15523, 2, 0.0119, 6468],
        ["03/13(金)", 9800, 142, 0.0145, 82, 13973, 2, 0.0141, 5822],
    ]

    campaigns = [
        ["No.","キャンペーン","表示回数","クリック数","CTR","CPC","消化額","Fee込","CV数","CVR","CPA","ROAS","ランク"],
        ["","合計", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-", "-"],
        [1, "リード獲得_検索", 120000, 2100, 0.0175, 72, 151200, 181440, 22, 0.0105, 6873, 2.4, "A"],
        [2, "リード獲得_ディスプレイ", 95000, 1200, 0.0126, 92, 110400, 132480, 15, 0.0125, 7360, 1.8, "A"],
        [3, "認知拡大_動画", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, 1.2, "B"],
        [4, "リターゲティング", 20000, 300, 0.015, 95, 28300, 33960, 3, 0.01, 9433, 1.5, "B"],
    ]

    adsets = [
        ["No.","キャンペーン","広告セット","表示回数","クリック数","CTR","CPC","消化額","Fee込","CV数","CVR","CPA","ランク"],
        ["","合計", "-", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-"],
        [1, "リード獲得_検索", "25-34_興味関心", 55000, 1050, 0.0191, 65, 68250, 81900, 12, 0.0114, 5688, "A"],
        [2, "リード獲得_検索", "35-44_類似", 65000, 1050, 0.0162, 79, 82950, 99540, 10, 0.0095, 8295, "B"],
        [3, "リード獲得_DP", "全年齢_興味関心", 95000, 1200, 0.0126, 92, 110400, 132480, 15, 0.0125, 7360, "A"],
        [4, "認知拡大_動画", "18-24_ブロード", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, "C"],
        [5, "リターゲティング", "訪問者_7日", 20000, 300, 0.015, 95, 28300, 33960, 3, 0.01, 9433, "B"],
    ]

    creatives = [
        ["No.","キャンペーン","広告セット","クリエイティブ","表示回数","クリック数","CTR","CPC","消化額","Fee込","CV数","CVR","CPA","ランク"],
        ["","合計", "-", "-", 285000, 4200, 0.0147, 84, 352900, 423480, 45, 0.0107, 7844, "-"],
        [1, "リード獲得_検索", "25-34_興味関心", "動画訴求A_縦型", 35000, 700, 0.02, 58, 40600, 48720, 8, 0.0114, 5075, "A"],
        [2, "リード獲得_検索", "25-34_興味関心", "静止画_特典訴求", 20000, 350, 0.0175, 72, 25200, 30240, 4, 0.0114, 6300, "A"],
        [3, "リード獲得_DP", "全年齢_興味関心", "カルーセル_事例", 45000, 600, 0.0133, 88, 52800, 63360, 8, 0.0133, 6600, "A"],
        [4, "リード獲得_DP", "全年齢_興味関心", "バナー_キャンペーン", 50000, 600, 0.012, 96, 57600, 69120, 7, 0.0117, 8229, "B"],
        [5, "認知拡大_動画", "18-24_ブロード", "ブランド動画_15秒", 50000, 600, 0.012, 105, 63000, 75600, 5, 0.0083, 12600, "C"],
    ]

    # Daily trend (30 days)
    daily = [["日付","曜日","表示回数","クリック数","CTR","CPC","消化額","Fee込","CV数","CVR","CPA"]]
    day_names = ["月","火","水","木","金","土","日"]
    for d in range(30):
        date_num = d + 12  # Feb 12 - Mar 13
        if date_num <= 28:
            date_str = f"2026-02-{date_num:02d}"
        else:
            date_str = f"2026-03-{date_num-28:02d}"
        dow = (d + 3) % 7  # Feb 12 = Thu → index 3
        imp = random.randint(7000, 13000)
        clicks = int(imp * random.uniform(0.012, 0.018))
        spend = int(clicks * random.uniform(70, 110))
        cv = random.choice([0,1,1,1,2,2,2,3,3,4]) if dow < 5 else random.choice([0,0,1,1,2])
        daily.append([date_str, day_names[dow], imp, clicks,
                       clicks/imp if imp>0 else 0, spend//clicks if clicks>0 else 0,
                       spend, int(spend*1.2), cv,
                       cv/clicks if clicks>0 else 0, spend//cv if cv>0 else 0])
    t_imp = sum(r[2] for r in daily[1:])
    t_cl = sum(r[3] for r in daily[1:])
    t_sp = sum(r[6] for r in daily[1:])
    t_cv = sum(r[8] for r in daily[1:])
    daily.append(["合計","-",t_imp,t_cl,t_cl/t_imp if t_imp>0 else 0,t_sp//t_cl if t_cl>0 else 0,
                   t_sp,int(t_sp*1.2),t_cv,t_cv/t_cl if t_cl>0 else 0,t_sp//t_cv if t_cv>0 else 0])

    ai = [
        ["1. 総合分析"],[""],
        ["サマリー","全体のCV数は45件で前月比+12.5%と好調に推移。CPAは¥7,844で前月比-8.3%の改善傾向。"],
        ["",""],
        ["示唆","・検索キャンペーンのCV効率が最も高い（CPA ¥6,873）"],
        ["","・モバイルデバイスからのCV比率が68%と高い"],
        ["","・25-34歳女性セグメントのCPAが最安（¥4,200）"],
        ["",""],
        ["推奨アクション","・検索キャンペーンの予算配分を増加（現在43%→55%目標）"],
        ["","・モバイル向けクリエイティブの強化"],
        ["","・25-34歳セグメントへの配信強化"],
        [],
        ["2. クライアント向けコメント"],[""],
        ["総評","当月は獲得件数・獲得単価ともに目標を達成。特に検索経由の獲得効率が大幅に改善。"],
        ["パフォーマンス","CV数45件（目標40件/達成率112.5%）、CPA ¥7,844（目標¥8,500/達成率92.3%）"],
        [],
        ["3. 改善施策"],[""],
        ["① 動画改善","15秒版を新規制作し認知拡大キャンペーンのCV率改善を図る"],
        ["② RT拡大","リターゲティングウィンドウを7日→14日に拡大し母数を増加"],
        ["③ 週末調整","土日のCPAが平日比+15%のため配信時間帯を調整"],
        [],
        ["4. 振り返り"],[""],
        ["良かった点","検索キャンペーンのCPA改善が顕著。新クリエイティブ「動画訴求A_縦型」が最高効率"],
        ["課題","認知拡大キャンペーンのCPAが全体平均の1.6倍。動画完視聴率が低い"],
        ["次月方針","検索への予算シフト＋動画クリエイティブの改善テスト"],
    ]

    device = [
        ["デバイス","表示回数","クリック数","CTR","消化額","Fee込","CV数","CPA","構成比"],
        ["合計", 285000, 4200, 0.0147, 352900, 423480, 45, 7844, 1],
        ["モバイルアプリ", 142500, 2310, 0.0162, 176450, 211740, 24, 7352, 0.50],
        ["モバイルWeb", 57000, 840, 0.0147, 70580, 84696, 7, 10083, 0.20],
        ["デスクトップ", 71250, 840, 0.0118, 88225, 105870, 11, 8020, 0.25],
        ["タブレット", 14250, 210, 0.0147, 17645, 21174, 3, 5882, 0.05],
    ]

    ages = ["18-24","25-34","35-44","45-54","55-64","65+"]
    demo = [
        ["CV数（年齢×性別）"],
        [""]+ages,
        ["男性", 2, 8, 5, 3, 1, 0],
        ["女性", 3, 10, 6, 4, 2, 1],
        ["不明", 0, 0, 0, 0, 0, 0],
        [],
        ["CPA（年齢×性別）"],
        [""]+ages,
        ["男性", 12500, 5800, 7200, 9500, 15000, 0],
        ["女性", 8500, 4200, 6100, 8200, 11000, 18000],
        ["不明", 0, 0, 0, 0, 0, 0],
        [],
        ["消化額（年齢×性別）"],
        [""]+ages,
        ["男性", 25000, 46400, 36000, 28500, 15000, 0],
        ["女性", 25500, 42000, 36600, 32800, 22000, 18000],
        ["不明", 0, 0, 0, 0, 0, 0],
    ]

    hours_lbl = [f"{h}時" for h in range(24)]
    days_ja = ["月","火","水","木","金","土","日"]
    heat = [["CV数（曜日×時間帯）"],[""]+hours_lbl]
    for day in days_ja:
        r = [day]
        for h in range(24):
            if 6<=h<=23: r.append(random.choice([0,0,0,1,1,1,2,2,3]) if 9<=h<=21 else random.choice([0,0,0,1]))
            else: r.append(0)
        heat.append(r)
    heat += [[], ["CPA（曜日×時間帯）"],[""]+hours_lbl]
    for day in days_ja:
        r = [day]
        for h in range(24):
            if 6<=h<=23: r.append(random.randint(4000,15000) if 9<=h<=21 else random.randint(8000,20000))
            else: r.append(0)
        heat.append(r)
    heat += [[], ["消化額（曜日×時間帯）"],[""]+hours_lbl]
    for day in days_ja:
        r = [day]
        for h in range(24):
            if 6<=h<=23: r.append(random.randint(500,3500) if 9<=h<=21 else random.randint(100,800))
            else: r.append(random.randint(0,100))
        heat.append(r)

    # ══════════════════════════════════════════════════
    # WRITE DATA
    # ══════════════════════════════════════════════════
    service.spreadsheets().values().batchUpdate(spreadsheetId=ssid, body={
        "valueInputOption":"USER_ENTERED",
        "data":[
            {"range":"表紙!A1","values":cover},
            {"range":"サマリー!A1","values":summary},
            {"range":"全体概要!A1","values":overview},
            {"range":"キャンペーン別!A1","values":campaigns},
            {"range":"広告セット別!A1","values":adsets},
            {"range":"クリエイティブ別!A1","values":creatives},
            {"range":"日次推移!A1","values":daily},
            {"range":"AI分析!A1","values":ai},
            {"range":"デバイス別!A1","values":device},
            {"range":"'属性別(年齢×性別)'!A1","values":demo},
            {"range":"'曜日×時間帯'!A1","values":heat},
        ]}).execute()

    # ══════════════════════════════════════════════════
    # FORMATTING
    # ══════════════════════════════════════════════════
    fmt = []
    rank_colors = {"A":RANK_A,"B":RANK_B,"C":RANK_C,"D":RANK_D}

    # ── 表紙 ──
    cov = sid_map["表紙"]
    # Background
    fmt.append({"repeatCell":{"range":{"sheetId":cov,"startRowIndex":0,"endRowIndex":25,"startColumnIndex":0,"endColumnIndex":10},
        "cell":{"userEnteredFormat":{"backgroundColor":COVER_BG}},
        "fields":"userEnteredFormat.backgroundColor"}})
    # Title text
    for r in range(len(cover)):
        fmt.append({"repeatCell":{"range":{"sheetId":cov,"startRowIndex":r,"endRowIndex":r+1,"startColumnIndex":0,"endColumnIndex":1},
            "cell":{"userEnteredFormat":{"textFormat":{"foregroundColor":WHITE}}},
            "fields":"userEnteredFormat.textFormat.foregroundColor"}})
    # Client name large
    fmt.append({"mergeCells":{"range":{"sheetId":cov,"startRowIndex":7,"endRowIndex":8,"startColumnIndex":0,"endColumnIndex":8},"mergeType":"MERGE_ALL"}})
    fmt.append({"repeatCell":{"range":{"sheetId":cov,"startRowIndex":7,"endRowIndex":8,"startColumnIndex":0,"endColumnIndex":1},
        "cell":{"userEnteredFormat":{"textFormat":{"fontSize":24,"bold":True,"foregroundColor":WHITE},"horizontalAlignment":"CENTER"}},
        "fields":"userEnteredFormat(textFormat,horizontalAlignment)"}})
    # Report title
    fmt.append({"mergeCells":{"range":{"sheetId":cov,"startRowIndex":10,"endRowIndex":11,"startColumnIndex":0,"endColumnIndex":8},"mergeType":"MERGE_ALL"}})
    fmt.append({"repeatCell":{"range":{"sheetId":cov,"startRowIndex":10,"endRowIndex":11,"startColumnIndex":0,"endColumnIndex":1},
        "cell":{"userEnteredFormat":{"textFormat":{"fontSize":16,"bold":True,"foregroundColor":{"red":0.75,"green":0.82,"blue":0.9}},"horizontalAlignment":"CENTER"}},
        "fields":"userEnteredFormat(textFormat,horizontalAlignment)"}})
    # Period / date / company name
    for r in [12, 18, 21]:
        fmt.append({"mergeCells":{"range":{"sheetId":cov,"startRowIndex":r,"endRowIndex":r+1,"startColumnIndex":0,"endColumnIndex":8},"mergeType":"MERGE_ALL"}})
        fmt.append({"repeatCell":{"range":{"sheetId":cov,"startRowIndex":r,"endRowIndex":r+1,"startColumnIndex":0,"endColumnIndex":1},
            "cell":{"userEnteredFormat":{"textFormat":{"fontSize":11,"foregroundColor":{"red":0.75,"green":0.82,"blue":0.9}},"horizontalAlignment":"CENTER","verticalAlignment":"MIDDLE"}},
            "fields":"userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"}})
    # Cover page row heights
    fmt.append(row_height(cov, 7, 8, 50))   # client name
    fmt.append(row_height(cov, 10, 11, 50))  # report title
    fmt.append(row_height(cov, 12, 13, 35))  # period
    fmt.append(row_height(cov, 18, 19, 35))  # date
    fmt.append(row_height(cov, 21, 22, 35))  # company name
    for r in [0,1,2,3,4,5,6,8,9,11,13,14,15,16,17,19,20]:
        if r < len(cover):
            fmt.append(row_height(cov, r, r+1, 20))  # spacer rows
    fmt.append(col_width(cov, 0, 8, 100))

    # ── サマリー ──
    sm = sid_map["サマリー"]
    fmt.append(section_title(sm, 0, 3))
    fmt.append(hdr(sm, 2, 3))
    fmt.append(section_title(sm, 8, 3))
    fmt.append(hdr(sm, 10, 3))
    fmt.append(section_title(sm, 19, 3))
    # Number formats
    fmt.append(nfmt(sm, 3, 7, 1, 2, "¥#,##0"))
    fmt.append(nfmt(sm, 5, 6, 1, 2, "0.0%"))
    fmt.append(nfmt(sm, 11, 15, 1, 2, "¥#,##0"))
    fmt.append(nfmt(sm, 17, 18, 1, 2, "0.00%"))
    fmt.append(brd(sm, 2, 7, 0, 3))
    fmt.append(brd(sm, 10, 18, 0, 3))
    fmt += alt_rows(sm, 3, 7, 3)
    fmt += alt_rows(sm, 11, 18, 3)
    # Wrap for long text + vertical alignment
    fmt.append({"repeatCell":{"range":{"sheetId":sm,"startRowIndex":19,"endRowIndex":len(summary),"startColumnIndex":0,"endColumnIndex":3},
        "cell":{"userEnteredFormat":{"wrapStrategy":"WRAP","verticalAlignment":"TOP"}},
        "fields":"userEnteredFormat(wrapStrategy,verticalAlignment)"}})
    # Row heights for summary text rows
    for r in range(3, 7):
        fmt.append(row_height(sm, r, r+1, 30))
    for r in range(11, 18):
        fmt.append(row_height(sm, r, r+1, 30))
    for r in range(21, len(summary)):
        fmt.append(row_height(sm, r, r+1, 40))  # wrapped text rows need more height
    fmt.append(col_width(sm, 0, 1, 200))
    fmt.append(col_width(sm, 1, 2, 160))
    fmt.append(col_width(sm, 2, 3, 160))

    # ── 全体概要 ──
    ov = sid_map["全体概要"]
    fmt.append(section_title(ov, 0, 9))
    fmt.append(section_title(ov, 2, 9))
    fmt.append(hdr(ov, 4, 9))
    fmt += alt_rows(ov, 5, 8, 9)
    fmt.append(section_title(ov, 9, 9))
    fmt.append(hdr(ov, 11, 9))
    fmt += alt_rows(ov, 12, len(overview), 9)
    fmt.append(nfmt(ov, 5, 8, 1, 3, "#,##0"))
    fmt.append(nfmt(ov, 5, 8, 3, 4, "0.00%"))
    fmt.append(nfmt(ov, 5, 8, 4, 6, "¥#,##0"))
    fmt.append(nfmt(ov, 5, 8, 6, 7, "#,##0"))
    fmt.append(nfmt(ov, 5, 8, 7, 8, "0.00%"))
    fmt.append(nfmt(ov, 5, 8, 8, 9, "¥#,##0"))
    fmt.append(nfmt(ov, 12, len(overview), 1, 3, "#,##0"))
    fmt.append(nfmt(ov, 12, len(overview), 3, 4, "0.00%"))
    fmt.append(nfmt(ov, 12, len(overview), 4, 6, "¥#,##0"))
    fmt.append(nfmt(ov, 12, len(overview), 6, 7, "#,##0"))
    fmt.append(nfmt(ov, 12, len(overview), 7, 8, "0.00%"))
    fmt.append(nfmt(ov, 12, len(overview), 8, 9, "¥#,##0"))
    fmt.append(right_align(ov, 5, len(overview), 1, 9))
    fmt.append(brd(ov, 4, 8, 0, 9))
    fmt.append(brd(ov, 11, len(overview), 0, 9))
    fmt.append(col_width(ov, 0, 1, 110))
    for c in range(1, 9):
        fmt.append(col_width(ov, c, c+1, 110))
    fmt.append(freeze(ov, 0, 0))

    # ── Helper for table sheets ──
    def fmt_table(name, data, num_start_col, has_rank_col=True):
        nonlocal fmt
        _id = sid_map[name]
        cols = len(data[0])
        fmt.append(hdr(_id, 0, cols))
        fmt.append(total_row(_id, 1, cols))
        fmt.append(brd(_id, 0, len(data), 0, cols))
        fmt.append(right_align(_id, 1, len(data), num_start_col, cols))
        fmt += alt_rows(_id, 2, len(data), cols)
        fmt.append(freeze(_id, 1, 0))
        # Vertical alignment MIDDLE for all data rows
        fmt.append({"repeatCell":{"range":{"sheetId":_id,"startRowIndex":1,"endRowIndex":len(data),"startColumnIndex":0,"endColumnIndex":cols},
            "cell":{"userEnteredFormat":{"verticalAlignment":"MIDDLE","padding":{"top":3,"bottom":3,"left":4,"right":4}}},
            "fields":"userEnteredFormat(verticalAlignment,padding)"}})
        # Column widths
        fmt.append(col_width(_id, 0, 1, 40))  # No.
        for c in range(1, min(4, cols)):
            fmt.append(col_width(_id, c, c+1, 170))  # Name cols
        for c in range(num_start_col, cols):
            fmt.append(col_width(_id, c, c+1, 95))
        if has_rank_col:
            rank_col = cols - 1
            fmt.append(col_width(_id, rank_col, rank_col+1, 55))
            for i in range(2, len(data)):
                rank = str(data[i][rank_col])
                if rank in rank_colors:
                    fmt.append({"repeatCell":{"range":{"sheetId":_id,"startRowIndex":i,"endRowIndex":i+1,
                        "startColumnIndex":rank_col,"endColumnIndex":rank_col+1},
                        "cell":{"userEnteredFormat":{"backgroundColor":rank_colors[rank],"horizontalAlignment":"CENTER",
                            "textFormat":{"bold":True}}},
                        "fields":"userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"}})
        return _id

    # キャンペーン別
    c_id = fmt_table("キャンペーン別", campaigns, 2)
    fmt.append(nfmt(c_id, 1, len(campaigns), 2, 4, "#,##0"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 4, 5, "0.00%"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 5, 8, "¥#,##0"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 8, 9, "#,##0"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 9, 10, "0.00%"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 10, 11, "¥#,##0"))
    fmt.append(nfmt(c_id, 1, len(campaigns), 11, 12, "0.00"))

    # 広告セット別
    a_id = fmt_table("広告セット別", adsets, 3)
    fmt.append(col_width(a_id, 1, 2, 160))
    fmt.append(col_width(a_id, 2, 3, 150))
    fmt.append(nfmt(a_id, 1, len(adsets), 3, 5, "#,##0"))
    fmt.append(nfmt(a_id, 1, len(adsets), 5, 6, "0.00%"))
    fmt.append(nfmt(a_id, 1, len(adsets), 6, 9, "¥#,##0"))
    fmt.append(nfmt(a_id, 1, len(adsets), 9, 10, "#,##0"))
    fmt.append(nfmt(a_id, 1, len(adsets), 10, 11, "0.00%"))
    fmt.append(nfmt(a_id, 1, len(adsets), 11, 12, "¥#,##0"))

    # クリエイティブ別
    cr_id = fmt_table("クリエイティブ別", creatives, 4)
    fmt.append(col_width(cr_id, 1, 2, 150))
    fmt.append(col_width(cr_id, 2, 3, 140))
    fmt.append(col_width(cr_id, 3, 4, 160))
    fmt.append(nfmt(cr_id, 1, len(creatives), 4, 6, "#,##0"))
    fmt.append(nfmt(cr_id, 1, len(creatives), 6, 7, "0.00%"))
    fmt.append(nfmt(cr_id, 1, len(creatives), 7, 10, "¥#,##0"))
    fmt.append(nfmt(cr_id, 1, len(creatives), 10, 11, "#,##0"))
    fmt.append(nfmt(cr_id, 1, len(creatives), 11, 12, "0.00%"))
    fmt.append(nfmt(cr_id, 1, len(creatives), 12, 13, "¥#,##0"))

    # ── 日次推移 ──
    d_id = sid_map["日次推移"]
    fmt.append(hdr(d_id, 0, 11))
    fmt.append(total_row(d_id, len(daily)-1, 11))
    fmt.append(brd(d_id, 0, len(daily), 0, 11))
    fmt.append(right_align(d_id, 1, len(daily), 2, 11))
    fmt += alt_rows(d_id, 1, len(daily)-1, 11)
    fmt.append(freeze(d_id, 1, 0))
    fmt.append(nfmt(d_id, 1, len(daily), 2, 4, "#,##0"))
    fmt.append(nfmt(d_id, 1, len(daily), 4, 5, "0.00%"))
    fmt.append(nfmt(d_id, 1, len(daily), 5, 8, "¥#,##0"))
    fmt.append(nfmt(d_id, 1, len(daily), 8, 9, "#,##0"))
    fmt.append(nfmt(d_id, 1, len(daily), 9, 10, "0.00%"))
    fmt.append(nfmt(d_id, 1, len(daily), 10, 11, "¥#,##0"))
    # Weekend bg
    for i in range(1, len(daily)-1):
        if daily[i][1] in ("土","日"):
            fmt.append({"repeatCell":{"range":{"sheetId":d_id,"startRowIndex":i,"endRowIndex":i+1,"startColumnIndex":0,"endColumnIndex":11},
                "cell":{"userEnteredFormat":{"backgroundColor":WEEKEND_BG}},
                "fields":"userEnteredFormat.backgroundColor"}})
    # Vertical alignment MIDDLE for data rows
    fmt.append({"repeatCell":{"range":{"sheetId":d_id,"startRowIndex":1,"endRowIndex":len(daily),"startColumnIndex":0,"endColumnIndex":11},
        "cell":{"userEnteredFormat":{"verticalAlignment":"MIDDLE"}},
        "fields":"userEnteredFormat.verticalAlignment"}})
    fmt.append(col_width(d_id, 0, 1, 100))
    fmt.append(col_width(d_id, 1, 2, 40))
    for c in range(2, 11):
        fmt.append(col_width(d_id, c, c+1, 95))

    # ── AI分析 ──
    ai_id = sid_map["AI分析"]
    for r in [0, 12, 17, 23]:
        fmt.append(section_title(ai_id, r, 2))
    fmt.append(hdr(ai_id, 0, 2))
    fmt.append(hdr(ai_id, 12, 2))
    fmt.append(hdr(ai_id, 17, 2))
    fmt.append(hdr(ai_id, 23, 2))
    fmt.append(brd(ai_id, 0, len(ai), 0, 2))
    fmt.append({"repeatCell":{"range":{"sheetId":ai_id,"startRowIndex":0,"endRowIndex":len(ai),"startColumnIndex":0,"endColumnIndex":2},
        "cell":{"userEnteredFormat":{"wrapStrategy":"WRAP","verticalAlignment":"TOP"}},
        "fields":"userEnteredFormat(wrapStrategy,verticalAlignment)"}})
    fmt.append(col_width(ai_id, 0, 1, 140))
    fmt.append(col_width(ai_id, 1, 2, 550))
    # Row heights for AI analysis content rows (rows with text content)
    content_rows_ai = [2,3,4,5,6,8,9,10,13,14,16,17,18,20,21,22,24,25,26]
    for r in content_rows_ai:
        if r < len(ai):
            fmt.append(row_height(ai_id, r, r+1, 40))

    # ── デバイス別 ──
    dv = sid_map["デバイス別"]
    fmt.append(hdr(dv, 0, 9))
    fmt.append(total_row(dv, 1, 9))
    fmt.append(brd(dv, 0, len(device), 0, 9))
    fmt.append(right_align(dv, 1, len(device), 1, 9))
    fmt += alt_rows(dv, 2, len(device), 9)
    fmt.append(nfmt(dv, 1, len(device), 1, 3, "#,##0"))
    fmt.append(nfmt(dv, 1, len(device), 3, 4, "0.00%"))
    fmt.append(nfmt(dv, 1, len(device), 4, 6, "¥#,##0"))
    fmt.append(nfmt(dv, 1, len(device), 6, 7, "#,##0"))
    fmt.append(nfmt(dv, 1, len(device), 7, 8, "¥#,##0"))
    fmt.append(nfmt(dv, 1, len(device), 8, 9, "0.0%"))
    # Vertical alignment MIDDLE for data rows
    fmt.append({"repeatCell":{"range":{"sheetId":dv,"startRowIndex":1,"endRowIndex":len(device),"startColumnIndex":0,"endColumnIndex":9},
        "cell":{"userEnteredFormat":{"verticalAlignment":"MIDDLE"}},
        "fields":"userEnteredFormat.verticalAlignment"}})
    fmt.append(col_width(dv, 0, 1, 140))
    for c in range(1, 9):
        fmt.append(col_width(dv, c, c+1, 100))

    # ── 属性別 ──
    dm = sid_map["属性別(年齢×性別)"]
    for r in [0, 6, 12]:
        fmt.append(hdr(dm, r, 7))
    for r in [1, 7, 13]:
        fmt.append(sub_hdr(dm, r, 7))
    fmt.append(nfmt(dm, 2, 5, 1, 7, "#,##0"))
    fmt.append(nfmt(dm, 8, 11, 1, 7, "¥#,##0"))
    fmt.append(nfmt(dm, 14, 17, 1, 7, "¥#,##0"))
    fmt.append(brd(dm, 0, 5, 0, 7))
    fmt.append(brd(dm, 6, 11, 0, 7))
    fmt.append(brd(dm, 12, 17, 0, 7))
    fmt.append(right_align(dm, 2, 5, 1, 7))
    fmt.append(right_align(dm, 8, 11, 1, 7))
    fmt.append(right_align(dm, 14, 17, 1, 7))
    fmt.append(col_width(dm, 0, 1, 80))
    for c in range(1, 7):
        fmt.append(col_width(dm, c, c+1, 85))
    # Conditional formatting (CV heatmap)
    fmt.append(conditional_gradient(dm, 2, 5, 1, 7))
    # CPA heatmap (inverted: lower is better → swap colors)
    fmt.append({"addConditionalFormatRule":{"rule":{
        "ranges":[{"sheetId":dm,"startRowIndex":8,"endRowIndex":11,"startColumnIndex":1,"endColumnIndex":7}],
        "gradientRule":{
            "minpoint":{"color":HEAT_HIGH,"type":"MIN"},
            "midpoint":{"color":HEAT_MID,"type":"PERCENTILE","value":"50"},
            "maxpoint":{"color":HEAT_LOW,"type":"MAX"},
        }},"index":0}})
    fmt.append(conditional_gradient(dm, 14, 17, 1, 7))

    # ── 曜日×時間帯 ──
    ht = sid_map["曜日×時間帯"]
    for r in [0, 10, 20]:
        fmt.append(hdr(ht, r, 25))
    for r in [1, 11, 21]:
        fmt.append(sub_hdr(ht, r, 25))
    fmt.append(nfmt(ht, 2, 9, 1, 25, "#,##0"))
    fmt.append(nfmt(ht, 12, 19, 1, 25, "¥#,##0"))
    fmt.append(nfmt(ht, 22, 29, 1, 25, "¥#,##0"))
    fmt.append(brd(ht, 0, 9, 0, 25))
    fmt.append(brd(ht, 10, 19, 0, 25))
    fmt.append(brd(ht, 20, 29, 0, 25))
    fmt.append(col_width(ht, 0, 1, 40))
    for c in range(1, 25):
        fmt.append(col_width(ht, c, c+1, 50))
    # Smaller font size for time labels to prevent truncation
    for r in [1, 11, 21]:
        fmt.append({"repeatCell":{"range":{"sheetId":ht,"startRowIndex":r,"endRowIndex":r+1,"startColumnIndex":1,"endColumnIndex":25},
            "cell":{"userEnteredFormat":{"textFormat":{"fontSize":8}}},
            "fields":"userEnteredFormat.textFormat.fontSize"}})
    # Conditional formatting
    fmt.append(conditional_gradient(ht, 2, 9, 1, 25))
    fmt.append({"addConditionalFormatRule":{"rule":{
        "ranges":[{"sheetId":ht,"startRowIndex":12,"endRowIndex":19,"startColumnIndex":1,"endColumnIndex":25}],
        "gradientRule":{
            "minpoint":{"color":HEAT_HIGH,"type":"MIN"},
            "midpoint":{"color":HEAT_MID,"type":"PERCENTILE","value":"50"},
            "maxpoint":{"color":HEAT_LOW,"type":"MAX"},
        }},"index":0}})
    fmt.append(conditional_gradient(ht, 22, 29, 1, 25))

    # Apply formatting
    service.spreadsheets().batchUpdate(spreadsheetId=ssid, body={"requests":fmt}).execute()
    print("Formatting applied.")

    # ══════════════════════════════════════════════════
    # CHARTS
    # ══════════════════════════════════════════════════
    charts = []

    # 1. Daily trend: 消化額 line chart (on 日次推移 sheet)
    n_daily = len(daily)
    charts.append(add_chart(d_id, "日次消化額推移", "LINE",
        {"sheetId":d_id,"startRowIndex":0,"endRowIndex":n_daily-1,"startColumnIndex":0,"endColumnIndex":1},  # dates
        [{"sheetId":d_id,"startRowIndex":0,"endRowIndex":n_daily-1,"startColumnIndex":6,"endColumnIndex":7}],  # spend
        anchor_row=n_daily+2, anchor_col=0, width=750, height=320))

    # 2. Daily trend: CV bar chart
    charts.append(add_chart(d_id, "日次CV数推移", "COLUMN",
        {"sheetId":d_id,"startRowIndex":0,"endRowIndex":n_daily-1,"startColumnIndex":0,"endColumnIndex":1},
        [{"sheetId":d_id,"startRowIndex":0,"endRowIndex":n_daily-1,"startColumnIndex":8,"endColumnIndex":9}],
        anchor_row=n_daily+2, anchor_col=8, width=750, height=320))

    # 3. Campaign spend bar chart (on キャンペーン別 sheet)
    n_camp = len(campaigns)
    charts.append(add_chart(c_id, "キャンペーン別 消化額", "BAR",
        {"sheetId":c_id,"startRowIndex":1,"endRowIndex":n_camp,"startColumnIndex":1,"endColumnIndex":2},  # names
        [{"sheetId":c_id,"startRowIndex":1,"endRowIndex":n_camp,"startColumnIndex":6,"endColumnIndex":7}],  # spend
        anchor_row=n_camp+2, anchor_col=0, width=600, height=300))

    # 4. Campaign CV bar chart
    charts.append(add_chart(c_id, "キャンペーン別 CV数", "BAR",
        {"sheetId":c_id,"startRowIndex":1,"endRowIndex":n_camp,"startColumnIndex":1,"endColumnIndex":2},
        [{"sheetId":c_id,"startRowIndex":1,"endRowIndex":n_camp,"startColumnIndex":8,"endColumnIndex":9}],
        anchor_row=n_camp+2, anchor_col=7, width=600, height=300))

    # 5. Device spend pie chart
    charts.append(add_chart(dv, "デバイス別 消化構成比", "PIE",
        {"sheetId":dv,"startRowIndex":1,"endRowIndex":len(device),"startColumnIndex":0,"endColumnIndex":1},
        [{"sheetId":dv,"startRowIndex":1,"endRowIndex":len(device),"startColumnIndex":4,"endColumnIndex":5}],
        anchor_row=len(device)+2, anchor_col=0, width=450, height=320, pie=True))

    # 6. Device CPA bar chart
    charts.append(add_chart(dv, "デバイス別 CPA比較", "BAR",
        {"sheetId":dv,"startRowIndex":1,"endRowIndex":len(device),"startColumnIndex":0,"endColumnIndex":1},
        [{"sheetId":dv,"startRowIndex":1,"endRowIndex":len(device),"startColumnIndex":7,"endColumnIndex":8}],
        anchor_row=len(device)+2, anchor_col=5, width=450, height=320))

    # 7. Demographic CV stacked bar (on 属性別 sheet)
    charts.append(add_chart(dm, "年齢×性別 CV数", "COLUMN",
        {"sheetId":dm,"startRowIndex":1,"endRowIndex":2,"startColumnIndex":0,"endColumnIndex":7},  # header row with ages
        [
            {"sheetId":dm,"startRowIndex":2,"endRowIndex":3,"startColumnIndex":0,"endColumnIndex":7},  # 男性
            {"sheetId":dm,"startRowIndex":3,"endRowIndex":4,"startColumnIndex":0,"endColumnIndex":7},  # 女性
        ],
        anchor_row=len(demo)+2, anchor_col=0, width=550, height=320, stacked=True))

    service.spreadsheets().batchUpdate(spreadsheetId=ssid, body={"requests":charts}).execute()
    print(f"\nDone! 11 sheets + 7 charts.")
    print(f"URL: {url}")
    return url

if __name__ == "__main__":
    main()
