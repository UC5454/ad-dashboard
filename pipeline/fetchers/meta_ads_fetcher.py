"""Meta (Facebook) Ads API data fetcher.

SECURITY: このモジュールは読み取り専用（READ-ONLY）。
広告の作成・編集・削除・予算変更などの書き込み操作は一切行わない。
使用APIはget_insightsのみ。
"""

from typing import Any

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount


class MetaAdsFetcher:
    """Fetches ad performance data from Meta Marketing API.

    READ-ONLY: This class only reads ad insights.
    No create/update/delete operations are implemented or allowed.
    """

    ACCOUNT_FIELDS = [
        "impressions",
        "clicks",
        "spend",
        "actions",
        "action_values",
        "ctr",
        "cpc",
        "cost_per_action_type",
        "reach",
        "frequency",
    ]

    CAMPAIGN_FIELDS = [
        "campaign_id",
        "campaign_name",
        "impressions",
        "clicks",
        "spend",
        "actions",
        "action_values",
        "ctr",
        "cpc",
        "cost_per_action_type",
        "reach",
        "frequency",
    ]

    def __init__(self, credentials: dict[str, str]):
        FacebookAdsApi.init(
            app_id=credentials["app_id"],
            app_secret=credentials["app_secret"],
            access_token=credentials["access_token"],
        )

    def _extract_conversions(self, row: dict) -> tuple[float, float]:
        """Extract conversion count and value from Meta's actions format."""
        conversions = 0.0
        conversion_value = 0.0

        actions = row.get("actions", [])
        for action in actions:
            if action.get("action_type") in [
                "offsite_conversion.fb_pixel_purchase",
                "offsite_conversion.fb_pixel_lead",
                "onsite_conversion.messaging_conversation_started_7d",
            ]:
                conversions += float(action.get("value", 0))

        action_values = row.get("action_values", [])
        for av in action_values:
            if av.get("action_type") in [
                "offsite_conversion.fb_pixel_purchase",
            ]:
                conversion_value += float(av.get("value", 0))

        return conversions, conversion_value

    def fetch_account_data(
        self,
        account_id: str,
        start_date: str,
        end_date: str,
    ) -> list[dict[str, Any]]:
        """Fetch account-level metrics."""
        account = AdAccount(account_id)
        insights = account.get_insights(
            fields=self.ACCOUNT_FIELDS,
            params={
                "time_range": {"since": start_date, "until": end_date},
                "time_increment": 1,
                "level": "account",
            },
        )

        results = []
        for row in insights:
            cost = float(row.get("spend", 0))
            clicks = int(row.get("clicks", 0))
            conversions, conversion_value = self._extract_conversions(row)

            results.append({
                "date": row["date_start"],
                "platform": "meta",
                "level": "account",
                "campaign_id": None,
                "campaign_name": None,
                "adset_id": None,
                "adset_name": None,
                "impressions": int(row.get("impressions", 0)),
                "clicks": clicks,
                "cost": int(cost),
                "conversions": conversions,
                "conversion_value": int(conversion_value),
                "ctr": float(row.get("ctr", 0)),
                "cpc": float(row.get("cpc", 0)) if row.get("cpc") else 0,
                "cpa": cost / conversions if conversions > 0 else 0,
                "roas": conversion_value / cost if cost > 0 else 0,
                "cvr": conversions / clicks * 100 if clicks > 0 else 0,
                "reach": int(row.get("reach", 0)),
                "frequency": float(row.get("frequency", 0)),
            })

        return results

    def fetch_campaign_data(
        self,
        account_id: str,
        start_date: str,
        end_date: str,
    ) -> list[dict[str, Any]]:
        """Fetch campaign-level metrics."""
        account = AdAccount(account_id)
        insights = account.get_insights(
            fields=self.CAMPAIGN_FIELDS,
            params={
                "time_range": {"since": start_date, "until": end_date},
                "time_increment": 1,
                "level": "campaign",
            },
        )

        results = []
        for row in insights:
            cost = float(row.get("spend", 0))
            clicks = int(row.get("clicks", 0))
            conversions, conversion_value = self._extract_conversions(row)

            results.append({
                "date": row["date_start"],
                "platform": "meta",
                "level": "campaign",
                "campaign_id": row.get("campaign_id"),
                "campaign_name": row.get("campaign_name"),
                "adset_id": None,
                "adset_name": None,
                "impressions": int(row.get("impressions", 0)),
                "clicks": clicks,
                "cost": int(cost),
                "conversions": conversions,
                "conversion_value": int(conversion_value),
                "ctr": float(row.get("ctr", 0)),
                "cpc": float(row.get("cpc", 0)) if row.get("cpc") else 0,
                "cpa": cost / conversions if conversions > 0 else 0,
                "roas": conversion_value / cost if cost > 0 else 0,
                "cvr": conversions / clicks * 100 if clicks > 0 else 0,
                "reach": int(row.get("reach", 0)),
                "frequency": float(row.get("frequency", 0)),
            })

        return results
