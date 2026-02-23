"""Write fetched ad data to SQLite database."""

import sqlite3
from pathlib import Path
from typing import Any


class DbWriter:
    """Writes ad metrics data to SQLite database."""

    def __init__(self, db_path: str | None = None):
        if db_path is None:
            db_path = str(
                Path(__file__).parent.parent.parent / "data" / "ad-dashboard.db"
            )
        self.db_path = db_path

    def write_metrics(self, client_id: str, metrics: list[dict[str, Any]]) -> int:
        """Write metrics to ad_metrics table. Returns number of rows upserted."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        count = 0

        for m in metrics:
            cursor.execute(
                """INSERT INTO ad_metrics
                   (date, client_id, platform, level, campaign_id, campaign_name,
                    adset_id, adset_name, impressions, clicks, cost, conversions,
                    conversion_value, ctr, cpc, cpa, roas, cvr, reach, frequency)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(date, client_id, platform, level, campaign_id, adset_id)
                   DO UPDATE SET
                     impressions = excluded.impressions,
                     clicks = excluded.clicks,
                     cost = excluded.cost,
                     conversions = excluded.conversions,
                     conversion_value = excluded.conversion_value,
                     ctr = excluded.ctr,
                     cpc = excluded.cpc,
                     cpa = excluded.cpa,
                     roas = excluded.roas,
                     cvr = excluded.cvr,
                     reach = excluded.reach,
                     frequency = excluded.frequency
                """,
                (
                    m["date"],
                    client_id,
                    m["platform"],
                    m["level"],
                    m.get("campaign_id"),
                    m.get("campaign_name"),
                    m.get("adset_id"),
                    m.get("adset_name"),
                    m["impressions"],
                    m["clicks"],
                    m["cost"],
                    m["conversions"],
                    m["conversion_value"],
                    m["ctr"],
                    m["cpc"],
                    m["cpa"],
                    m["roas"],
                    m["cvr"],
                    m.get("reach", 0),
                    m.get("frequency", 0),
                ),
            )
            count += 1

        conn.commit()
        conn.close()
        return count
