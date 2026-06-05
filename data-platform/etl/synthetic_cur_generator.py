"""
Synthetic AWS CUR (Cost & Usage Report) Data Generator
=======================================================
Generates realistic CUR-format CSV files for multiple business units.
Output is uploaded to LocalStack S3 (or written locally).

AWS CUR columns reference:
https://docs.aws.amazon.com/cur/latest/userguide/data-dictionary.html
"""

import os
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import numpy as np

# Configuration
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "cur_raw"
NUM_DAYS = 90  # Generate 3 months of data
RECORDS_PER_DAY_PER_BU = 150  # ~150 line items per BU per day

# Business Units (matching seed-state.json UUIDs)
BUSINESS_UNITS = {
    "a1b2c3d4-0001-4000-8000-000000000001": {"name": "Platform Engineering", "cost_center": "CC-1001"},
    "a1b2c3d4-0002-4000-8000-000000000002": {"name": "Data & Analytics", "cost_center": "CC-1002"},
    "a1b2c3d4-0003-4000-8000-000000000003": {"name": "Product Engineering", "cost_center": "CC-1003"},
    "a1b2c3d4-0004-4000-8000-000000000004": {"name": "Finance Operations", "cost_center": "CC-1004"},
}

# AWS Services with realistic cost distributions
SERVICES = {
    "AmazonEC2": {"weight": 0.35, "usage_types": ["BoxUsage:m5.xlarge", "BoxUsage:c5.2xlarge", "BoxUsage:t3.medium", "EBS:VolumeUsage.gp3"], "unit": "Hrs"},
    "AmazonRDS": {"weight": 0.20, "usage_types": ["InstanceUsage:db.r5.large", "InstanceUsage:db.m5.xlarge", "StorageUsage"], "unit": "Hrs"},
    "AmazonS3": {"weight": 0.10, "usage_types": ["TimedStorage-ByteHrs", "Requests-Tier1", "DataTransfer-Out-Bytes"], "unit": "GB-Mo"},
    "AWSLambda": {"weight": 0.08, "usage_types": ["Request", "Duration", "Duration-Provisioned"], "unit": "GB-Seconds"},
    "AmazonEKS": {"weight": 0.12, "usage_types": ["AmazonEKS-Hours:perCluster", "NatGateway-Hours"], "unit": "Hrs"},
    "AmazonElastiCache": {"weight": 0.05, "usage_types": ["NodeUsage:cache.r6g.large", "NodeUsage:cache.m5.xlarge"], "unit": "Hrs"},
    "AmazonRedshift": {"weight": 0.06, "usage_types": ["Node:ra3.xlplus", "Node:ra3.4xlarge"], "unit": "Hrs"},
    "AmazonCloudWatch": {"weight": 0.02, "usage_types": ["MetricMonitorUsage", "TimedStorage-ByteHrs"], "unit": "Metrics"},
    "AWSDataTransfer": {"weight": 0.02, "usage_types": ["DataTransfer-Out-Bytes", "DataTransfer-Regional-Bytes"], "unit": "GB"},
}

REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1"]

ACCOUNT_IDS = ["123456789012", "234567890123", "345678901234", "456789012345"]

# Tags that appear on resources (for tag compliance scoring)
COMMON_TAGS = {
    "Environment": ["production", "staging", "development", "sandbox"],
    "Team": ["platform", "data", "product", "finance", "security"],
    "CostCenter": ["CC-1001", "CC-1002", "CC-1003", "CC-1004"],
    "Project": ["flex-core", "flex-analytics", "flex-api", "data-lake", "ml-pipeline", "reporting"],
    "Owner": ["platform-lead", "data-lead", "product-lead", "finance-lead"],
}


def generate_resource_id(service: str) -> str:
    """Generate a realistic AWS resource ID."""
    prefixes = {
        "AmazonEC2": "i-",
        "AmazonRDS": "db-",
        "AmazonS3": "arn:aws:s3:::",
        "AWSLambda": "arn:aws:lambda:us-east-1:123456789012:function:",
        "AmazonEKS": "arn:aws:eks:us-east-1:123456789012:cluster/",
        "AmazonElastiCache": "arn:aws:elasticache:",
        "AmazonRedshift": "arn:aws:redshift:",
        "AmazonCloudWatch": "",
        "AWSDataTransfer": "",
    }
    prefix = prefixes.get(service, "")
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def generate_tags(bu_info: dict, completeness: float = 0.85) -> dict:
    """Generate resource tags with configurable completeness (for tag compliance scoring)."""
    tags = {}
    for key, values in COMMON_TAGS.items():
        if random.random() < completeness:
            if key == "CostCenter":
                tags[f"user:{key}"] = bu_info["cost_center"]
            elif key == "Team":
                tags[f"user:{key}"] = bu_info["name"].split()[0].lower()
            else:
                tags[f"user:{key}"] = random.choice(values)
    return tags


def generate_cur_records(date: datetime, bu_id: str, bu_info: dict) -> list[dict]:
    """Generate CUR line items for a single day and business unit."""
    records = []
    num_records = RECORDS_PER_DAY_PER_BU + random.randint(-30, 30)

    # Introduce spend anomalies (~2% chance per day)
    anomaly_multiplier = 1.0
    if random.random() < 0.02:
        anomaly_multiplier = random.uniform(1.5, 3.0)
        anomaly_service = random.choice(list(SERVICES.keys()))
    else:
        anomaly_service = None

    for _ in range(num_records):
        # Pick service based on weights
        service = random.choices(
            list(SERVICES.keys()),
            weights=[s["weight"] for s in SERVICES.values()],
            k=1
        )[0]

        svc_info = SERVICES[service]
        usage_type = random.choice(svc_info["usage_types"])
        region = random.choice(REGIONS)
        account_id = random.choice(ACCOUNT_IDS)

        # Base cost varies by service
        base_cost = random.uniform(0.01, 15.0) * (1 + SERVICES[service]["weight"])

        # Apply anomaly if this is the anomaly service
        if service == anomaly_service:
            base_cost *= anomaly_multiplier

        # Add some daily variance
        daily_variance = random.uniform(0.85, 1.15)
        cost = round(base_cost * daily_variance, 6)
        usage_amount = round(cost / random.uniform(0.01, 0.5), 4)

        # Tag completeness varies by BU (Platform=95%, others=80-90%)
        tag_completeness = 0.95 if "Platform" in bu_info["name"] else random.uniform(0.75, 0.90)
        tags = generate_tags(bu_info, tag_completeness)

        record = {
            # Identity columns
            "identity/LineItemId": str(uuid.uuid4()),
            "identity/TimeInterval": f"{date.strftime('%Y-%m-%dT00:00:00Z')}/{(date + timedelta(days=1)).strftime('%Y-%m-%dT00:00:00Z')}",
            # Bill columns
            "bill/InvoiceId": f"INV-{date.strftime('%Y%m')}",
            "bill/BillingEntity": "AWS",
            "bill/BillType": "Anniversary",
            "bill/PayerAccountId": "123456789012",
            "bill/BillingPeriodStartDate": date.replace(day=1).strftime("%Y-%m-%dT00:00:00Z"),
            "bill/BillingPeriodEndDate": (date.replace(day=28) + timedelta(days=4)).replace(day=1).strftime("%Y-%m-%dT00:00:00Z"),
            # Line item columns
            "lineItem/UsageAccountId": account_id,
            "lineItem/LineItemType": "Usage",
            "lineItem/UsageStartDate": date.strftime("%Y-%m-%dT00:00:00Z"),
            "lineItem/UsageEndDate": (date + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z"),
            "lineItem/ProductCode": service,
            "lineItem/UsageType": usage_type,
            "lineItem/Operation": "RunInstances" if "EC2" in service else "StandardUsage",
            "lineItem/AvailabilityZone": f"{region}a" if random.random() > 0.3 else f"{region}b",
            "lineItem/ResourceId": generate_resource_id(service),
            "lineItem/UsageAmount": usage_amount,
            "lineItem/NormalizationFactor": 1.0,
            "lineItem/NormalizedUsageAmount": usage_amount,
            "lineItem/CurrencyCode": "USD",
            "lineItem/UnblendedRate": round(cost / max(usage_amount, 0.001), 8),
            "lineItem/UnblendedCost": cost,
            "lineItem/BlendedRate": round(cost / max(usage_amount, 0.001), 8),
            "lineItem/BlendedCost": round(cost * 0.98, 6),
            # Product columns
            "product/ProductName": service.replace("Amazon", "Amazon ").replace("AWS", "AWS "),
            "product/region": region,
            "product/servicecode": service,
            "product/instanceType": usage_type.split(":")[-1] if ":" in usage_type else "",
            # Pricing
            "pricing/term": "OnDemand",
            "pricing/unit": svc_info["unit"],
            # Resource tags
            "resourceTags": tags,
            # Custom: BU mapping (used by ETL to route data)
            "custom/BusinessUnitId": bu_id,
            "custom/BusinessUnitName": bu_info["name"],
            "custom/CostCenter": bu_info["cost_center"],
        }
        records.append(record)

    return records


def generate_monthly_cur(year: int, month: int) -> pd.DataFrame:
    """Generate a full month of CUR data for all business units."""
    all_records = []

    # Determine days in month
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    start_date = datetime(year, month, 1)
    num_days = (end_date - start_date).days

    print(f"Generating CUR data for {start_date.strftime('%Y-%m')}...")

    for day_offset in range(num_days):
        current_date = start_date + timedelta(days=day_offset)
        for bu_id, bu_info in BUSINESS_UNITS.items():
            records = generate_cur_records(current_date, bu_id, bu_info)
            all_records.extend(records)

    df = pd.DataFrame(all_records)
    print(f"  Generated {len(df):,} records for {start_date.strftime('%Y-%m')}")
    return df


def upload_to_s3(filepath: Path, s3_key: str):
    """Upload file to LocalStack S3."""
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ.get("AWS_ENDPOINT_URL", "http://localhost:4566"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )

    bucket = os.environ.get("CUR_BUCKET", "flex-cur-data")
    s3.upload_file(str(filepath), bucket, s3_key)
    print(f"  Uploaded to s3://{bucket}/{s3_key}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate 3 months: March, April, May 2026
    months = [(2026, 3), (2026, 4), (2026, 5)]

    for year, month in months:
        df = generate_monthly_cur(year, month)

        # Save as Parquet (preferred for Spark/Databricks)
        parquet_path = OUTPUT_DIR / f"cur_{year}_{month:02d}.parquet"
        df.to_parquet(parquet_path, index=False)
        print(f"  Saved: {parquet_path}")

        # Also save as CSV for inspection
        csv_path = OUTPUT_DIR / f"cur_{year}_{month:02d}.csv"
        df.to_csv(csv_path, index=False)
        print(f"  Saved: {csv_path}")

        # Upload to LocalStack S3
        try:
            s3_key = f"raw/{year}/{month:02d}/cur_{year}_{month:02d}.parquet"
            upload_to_s3(parquet_path, s3_key)
        except Exception as e:
            print(f"  ⚠️  S3 upload skipped (LocalStack not running?): {e}")

    print("\n✅ Synthetic CUR data generation complete!")
    print(f"   Files at: {OUTPUT_DIR}")
    print(f"   Total BUs: {len(BUSINESS_UNITS)}")
    print(f"   Date range: 2026-03-01 to 2026-05-31")


if __name__ == "__main__":
    main()
