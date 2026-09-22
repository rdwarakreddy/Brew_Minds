# ---------------------------------------------------------------------------
# STORAGE MODULE - MAIN
#
# In simple words: this is a private online filing cabinet (S3 bucket)
# where the Document Service stores the actual files that users upload
# (contracts, invoices, attachments, etc). It is locked down so nobody
# on the internet can browse or download files directly - only our own
# application, using proper AWS credentials, can reach it.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------
# THE BUCKET
# -----------------------------------------------------------------------
resource "aws_s3_bucket" "documents" {
  bucket = "${local.name_prefix}-${var.bucket_name}"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-${var.bucket_name}"
    }
  )
}

# -----------------------------------------------------------------------
# BLOCK ALL PUBLIC ACCESS
# This is a belt-and-braces switch that makes it impossible for this
# bucket, or any file in it, to ever be made public - even by accident.
# -----------------------------------------------------------------------
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------
# SERVER-SIDE ENCRYPTION
# Every file saved to this bucket is automatically encrypted by AWS
# before it touches disk, using AWS's own managed encryption key.
# -----------------------------------------------------------------------
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# -----------------------------------------------------------------------
# VERSIONING
# Keeps previous versions of a file whenever it is overwritten or
# deleted, so an accidental overwrite/delete can be recovered from.
# -----------------------------------------------------------------------
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# -----------------------------------------------------------------------
# LIFECYCLE RULES
# Old file VERSIONS (created by versioning above) are not needed forever.
# This rule automatically cleans up old versions after a set number of
# days, and also clears out any incomplete/failed uploads, both of which
# would otherwise quietly cost money.
# -----------------------------------------------------------------------
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  # Versioning must be enabled before applying rules that manage
  # non-current object versions.
  depends_on = [aws_s3_bucket_versioning.documents]

  # Rule 1:
  # Permanently delete old versions of objects after the configured
  # number of days.
  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    # Apply this rule to all objects in the bucket.
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }

  # Rule 2:
  # Automatically remove incomplete multipart uploads that were
  # started but never completed.
  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    # Apply this rule to all objects in the bucket.
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
