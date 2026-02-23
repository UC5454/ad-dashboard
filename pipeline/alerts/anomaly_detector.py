"""Anomaly detection for ad metrics."""

import sqlite3
from typing import Any

import requests


class AnomalyDetector:
    """Detects anomalies in ad metrics using 7-day moving average deviation."""

    THRESHOLDS = [
        {"metric": "cpa", "warning": 20, "critical": 40, "direction": "increase", "min_value": 1000},
        {"metric": "roas", "warning": 15, "critical": 30, "direction": "decrease", "min_value": 0.5},
        {"metric": "ctr", "warning": 20, "critical": 35, "direction": "decrease", "min_value": 0.5},
        {"metric": "conversions", "warning": 30, "critical": 50, "direction": "decrease", "min_value": 1},
    ]

    def __init__(self, db_path: str, slack_webhook: str | None = None):
        self.db_path = db_path
        self.slack_webhook = slack_webhook

    def check_client(self, client_id: str) -> list[dict[str, Any]]:
        """Check all metrics for a client across all platforms."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        alerts = []

        for platform in ["google", "meta"]:
            for threshold in self.THRESHOLDS:
                metric = threshold["metric"]
                cursor = conn.cursor()
                cursor.execute(
                    f"""SELECT date, {metric} as value
                        FROM ad_metrics
                        WHERE client_id = ? AND platform = ? AND level = 'account'
                        ORDER BY date DESC
                        LIMIT 8""",
                    (client_id, platform),
                )
                rows = cursor.fetchall()

                if len(rows) < 8:
                    continue

                today_value = rows[0]["value"]
                moving_avg = sum(r["value"] for r in rows[1:]) / 7

                if moving_avg == 0 or today_value < threshold["min_value"]:
                    continue

                if threshold["direction"] == "increase":
                    deviation = ((today_value - moving_avg) / moving_avg) * 100
                else:
                    deviation = ((moving_avg - today_value) / moving_avg) * 100

                severity = None
                if deviation >= threshold["critical"]:
                    severity = "critical"
                elif deviation >= threshold["warning"]:
                    severity = "warning"

                if severity:
                    alert = {
                        "client_id": client_id,
                        "platform": platform,
                        "metric": metric,
                        "severity": severity,
                        "current_value": today_value,
                        "moving_avg": moving_avg,
                        "deviation_pct": deviation,
                    }

                    # Save to DB
                    cursor.execute(
                        """INSERT INTO alerts
                           (client_id, platform, metric, severity, current_value, moving_avg, deviation_pct, message)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            client_id,
                            platform,
                            metric,
                            severity,
                            today_value,
                            moving_avg,
                            deviation,
                            f"{severity}: {metric} deviation {deviation:.1f}%",
                        ),
                    )
                    alerts.append(alert)

        conn.commit()
        conn.close()

        # Send Slack notifications
        if alerts and self.slack_webhook:
            self._notify_slack(alerts)

        return alerts

    def _notify_slack(self, alerts: list[dict]) -> None:
        """Send alert notifications to Slack."""
        if not self.slack_webhook:
            return

        for alert in alerts:
            emoji = "🚨" if alert["severity"] == "critical" else "⚠️"
            message = (
                f"{emoji} *Ad Alert [{alert['severity'].upper()}]*\n"
                f"Client: {alert['client_id']}\n"
                f"Platform: {alert['platform']}\n"
                f"Metric: {alert['metric']}\n"
                f"Deviation: {alert['deviation_pct']:.1f}%"
            )

            try:
                requests.post(self.slack_webhook, json={"text": message}, timeout=10)
            except Exception as e:
                print(f"Slack notification error: {e}")
