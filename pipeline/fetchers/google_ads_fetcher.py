"""Google Ads API data fetcher using GAQL."""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException


class GoogleAdsFetcher:
    """Fetches ad performance data from Google Ads API."""

    GAQL_ACCOUNT = """
        SELECT
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_per_conversion
        FROM customer
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
    """

    GAQL_CAMPAIGN = """
        SELECT
            campaign.id,
            campaign.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_per_conversion
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND campaign.status != 'REMOVED'
    """

    def __init__(self, credentials: dict[str, str]):
        self.client = GoogleAdsClient.load_from_dict({
            "developer_token": credentials["developer_token"],
            "client_id": credentials["client_id"],
            "client_secret": credentials["client_secret"],
            "refresh_token": credentials["refresh_token"],
            "login_customer_id": credentials.get("login_customer_id", ""),
            "use_proto_plus": True,
        })

    def fetch_account_data(
        self,
        customer_id: str,
        start_date: str,
        end_date: str,
    ) -> list[dict[str, Any]]:
        """Fetch account-level metrics."""
        ga_service = self.client.get_service("GoogleAdsService")
        query = self.GAQL_ACCOUNT.format(start_date=start_date, end_date=end_date)

        results = []
        try:
            response = ga_service.search(customer_id=customer_id, query=query)
            for row in response:
                cost_yen = row.metrics.cost_micros / 1_000_000
                conversions = row.metrics.conversions
                results.append({
                    "date": row.segments.date,
                    "platform": "google",
                    "level": "account",
                    "campaign_id": None,
                    "campaign_name": None,
                    "adset_id": None,
                    "adset_name": None,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": int(cost_yen),
                    "conversions": conversions,
                    "conversion_value": int(row.metrics.conversions_value),
                    "ctr": row.metrics.ctr * 100,
                    "cpc": cost_yen / row.metrics.clicks if row.metrics.clicks > 0 else 0,
                    "cpa": cost_yen / conversions if conversions > 0 else 0,
                    "roas": row.metrics.conversions_value / cost_yen if cost_yen > 0 else 0,
                    "cvr": conversions / row.metrics.clicks * 100 if row.metrics.clicks > 0 else 0,
                    "reach": 0,
                    "frequency": 0,
                })
        except GoogleAdsException as e:
            print(f"Google Ads API error: {e}")
            raise

        return results

    def fetch_campaign_data(
        self,
        customer_id: str,
        start_date: str,
        end_date: str,
    ) -> list[dict[str, Any]]:
        """Fetch campaign-level metrics."""
        ga_service = self.client.get_service("GoogleAdsService")
        query = self.GAQL_CAMPAIGN.format(start_date=start_date, end_date=end_date)

        results = []
        try:
            response = ga_service.search(customer_id=customer_id, query=query)
            for row in response:
                cost_yen = row.metrics.cost_micros / 1_000_000
                conversions = row.metrics.conversions
                results.append({
                    "date": row.segments.date,
                    "platform": "google",
                    "level": "campaign",
                    "campaign_id": str(row.campaign.id),
                    "campaign_name": row.campaign.name,
                    "adset_id": None,
                    "adset_name": None,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": int(cost_yen),
                    "conversions": conversions,
                    "conversion_value": int(row.metrics.conversions_value),
                    "ctr": row.metrics.ctr * 100,
                    "cpc": cost_yen / row.metrics.clicks if row.metrics.clicks > 0 else 0,
                    "cpa": cost_yen / conversions if conversions > 0 else 0,
                    "roas": row.metrics.conversions_value / cost_yen if cost_yen > 0 else 0,
                    "cvr": conversions / row.metrics.clicks * 100 if row.metrics.clicks > 0 else 0,
                    "reach": 0,
                    "frequency": 0,
                })
        except GoogleAdsException as e:
            print(f"Google Ads API error: {e}")
            raise

        return results
