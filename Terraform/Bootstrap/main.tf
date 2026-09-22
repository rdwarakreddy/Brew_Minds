# ---------------------------------------------------------------------------
# BOOTSTRAP - CREATES THE TERRAFORM STATE BUCKET
#
# In simple words: this is a tiny, SEPARATE Terraform project whose only
# job is to create the S3 bucket that the MAIN Brew Minds Terraform
# config (one folder up) will store its state file in.
#
# Why separate? Terraform can't use a backend bucket that doesn't exist
# yet, and it can't create the very bucket it's supposed to store its
# own state in in one step - that's a chicken-and-egg problem. So this
# bootstrap config keeps its OWN state locally (just on your machine),
# and you run it manually, ONE TIME, before ever running the main
# config.
#
# This bucket is only for Terraform's internal state file. It is
# completely separate from the Brew Minds application S3 bucket created
# in modules/storage (that one holds real user documents).
#
# How to use:
#   cd terraform/bootstrap
#   terraform init
#   terraform apply
#   (then go back up to terraform/ and run terraform init there)
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Deliberately no "backend" block here - this config's own state stays
  # local, since its whole purpose is to create the bucket other configs
  # store their state in.
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for the state bucket"
  type        = string
  default     = "ap-south-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket that will hold Terraform state for Brew Minds"
  type        = string
  default     = "brew-minds-terraform-state"
}

# -----------------------------------------------------------------------
# THE STATE BUCKET
# -----------------------------------------------------------------------
resource "aws_s3_bucket" "terraform_state" {
  bucket = var.state_bucket_name

  # Prevents someone from accidentally deleting this bucket with
  # `terraform destroy` while it's actively holding real state
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project   = "Brew-Minds"
    Purpose   = "terraform-state"
    ManagedBy = "Terraform"
  }
}

# Keeps a history of state file versions, so a corrupted or bad state
# push can be rolled back to a previous good version
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encrypts the state file at rest - state files can contain sensitive
# values, so this is not optional
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Blocks all public access to the state bucket - state files can contain
# sensitive information and must never be publicly reachable
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket_name" {
  description = "Name of the created state bucket - copy this into the backend.tf 'bucket' field"
  value       = aws_s3_bucket.terraform_state.bucket
}
