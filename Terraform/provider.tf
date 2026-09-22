# ---------------------------------------------------------------------------
# PROVIDER CONFIGURATION
#
# In simple words: this file tells Terraform which "cloud" it is talking
# to (AWS), which version of Terraform and the AWS plugin to use, and
# which region to deploy into. Every module inherits the default
# provider automatically - we only need a second, aliased provider for
# the one resource (CloudFront's WAF Web ACL) that AWS requires to live
# in us-east-1 no matter what.
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Default provider - used by almost every resource in this project
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Second provider, pinned to us-east-1. Only used for the CloudFront WAF
# Web ACL inside the edge-security module, since AWS requires that
# specific resource to be created in us-east-1 regardless of which
# region the rest of the infrastructure lives in.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}
