# =============================================================================
# ALB Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# AWS Region
# -----------------------------------------------------------------------------

variable "aws_region" {
  type        = string
  description = "AWS region where the EKS cluster and Load Balancer Controller are deployed."
}

# -----------------------------------------------------------------------------
# EKS Cluster Name
# -----------------------------------------------------------------------------

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster."
}

# NOTE: added — main.tf hardcoded Environment = "dev" in the role's tags
# instead of using a variable, which would mislabel resources in staging/
# production. Added this variable and used it instead.
variable "environment" {
  type        = string
  description = "Deployment environment, used for resource tagging."
}

# -----------------------------------------------------------------------------
# VPC ID
# -----------------------------------------------------------------------------

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the EKS cluster is deployed."
}

# -----------------------------------------------------------------------------
# EKS OIDC Provider ARN
# -----------------------------------------------------------------------------

variable "oidc_provider_arn" {
  type        = string
  description = "ARN of the EKS OIDC identity provider used for IRSA."
}

# -----------------------------------------------------------------------------
# EKS OIDC Issuer URL
# -----------------------------------------------------------------------------

variable "oidc_issuer_url" {
  type        = string
  description = "OIDC issuer URL of the EKS cluster."
}