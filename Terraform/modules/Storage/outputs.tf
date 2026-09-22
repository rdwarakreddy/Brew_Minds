# ---------------------------------------------------------------------------
# STORAGE MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "bucket_name" {
  description = "Name of the S3 bucket used for Brew Minds documents"
  value       = aws_s3_bucket.documents.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.documents.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the bucket, useful if another service needs to reference it directly"
  value       = aws_s3_bucket.documents.bucket_regional_domain_name
}
