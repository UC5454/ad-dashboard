#!/usr/bin/env python3
"""
Ad Dashboard Data Pipeline
Fetches data from Google Ads and Meta Ads, writes to SQLite.

Usage:
    python main.py                    # Fetch yesterday's data for all clients
    python main.py --days 7           # Fetch last 7 days
    python main.py --client CLIENT_ID # Fetch for specific client
"""

import argparse
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from fetchers.google_ads_fetcher import GoogleAdsFetcher
from fetchers.meta_ads_fetcher import MetaAdsFetcher
from writers.db_writer import DbWriter
from alerts.anomaly_detector import AnomalyDetector


DB_PATH = str(Path(__file__).parent.parent / "data" / "ad-dashboard.db")


def get_api_credentials(db_path: str, platform: str) -> dict | None:
    """Get decrypted API credentials from database."""
    # In production, this calls the Node.js decryption endpoint
    # For pipeline, we read from a local config file
    config_path = Path(__file__).parent / "config" / "api_credentials.json"
    if config_path.exists():
        with open(config_path) as f:
            creds = json.load(f)
        return creds.get(platform)
    return None


def get_clients(db_path: str, client_id: str | None = None) -> list[dict]:
    """Get active clients from database."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if client_id:
        cursor.execute("SELECT * FROM clients WHERE id = ? AND status = 'active'", (client_id,))
    else:
        cursor.execute("SELECT * FROM clients WHERE status = 'active'")

    clients = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return clients


def main():
    parser = argparse.ArgumentParser(description="Ad Dashboard Data Pipeline")
    parser.add_argument("--days", type=int, default=1, help="Number of days to fetch")
    parser.add_argument("--client", type=str, help="Specific client ID")
    args = parser.parse_args()

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=args.days)).strftime("%Y-%m-%d")

    print(f"Fetching data: {start_date} to {end_date}")

    clients = get_clients(DB_PATH, args.client)
    if not clients:
        print("No active clients found")
        return

    writer = DbWriter(DB_PATH)
    detector = AnomalyDetector(DB_PATH)

    # Get API credentials
    google_creds = get_api_credentials(DB_PATH, "google_ads")
    meta_creds = get_api_credentials(DB_PATH, "meta_ads")

    for client in clients:
        print(f"\nProcessing: {client['name']}")

        # Google Ads
        if client.get("google_ads_account_id") and google_creds:
            try:
                fetcher = GoogleAdsFetcher(google_creds)
                account_id = client["google_ads_account_id"].replace("-", "")

                account_data = fetcher.fetch_account_data(account_id, start_date, end_date)
                campaign_data = fetcher.fetch_campaign_data(account_id, start_date, end_date)

                count = writer.write_metrics(client["id"], account_data + campaign_data)
                print(f"  Google Ads: {count} rows written")
            except Exception as e:
                print(f"  Google Ads error: {e}")

        # Meta Ads
        if client.get("meta_ads_account_id") and meta_creds:
            try:
                fetcher = MetaAdsFetcher(meta_creds)

                account_data = fetcher.fetch_account_data(
                    client["meta_ads_account_id"], start_date, end_date
                )
                campaign_data = fetcher.fetch_campaign_data(
                    client["meta_ads_account_id"], start_date, end_date
                )

                count = writer.write_metrics(client["id"], account_data + campaign_data)
                print(f"  Meta Ads: {count} rows written")
            except Exception as e:
                print(f"  Meta Ads error: {e}")

        # Run anomaly detection
        try:
            alerts = detector.check_client(client["id"])
            if alerts:
                print(f"  Alerts: {len(alerts)} generated")
        except Exception as e:
            print(f"  Alert check error: {e}")

    print("\nPipeline complete!")


if __name__ == "__main__":
    main()
