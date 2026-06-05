#!/bin/bash
# Initialize LocalStack S3 bucket for CUR files

echo "Creating S3 bucket for AWS CUR data..."
awslocal s3 mb s3://flex-cur-data
awslocal s3 mb s3://flex-etl-output

echo "Creating folder structure..."
awslocal s3api put-object --bucket flex-cur-data --key raw/
awslocal s3api put-object --bucket flex-cur-data --key processed/
awslocal s3api put-object --bucket flex-etl-output --key kpis/
awslocal s3api put-object --bucket flex-etl-output --key chargeback/
awslocal s3api put-object --bucket flex-etl-output --key anomalies/

echo "LocalStack S3 initialized successfully!"
