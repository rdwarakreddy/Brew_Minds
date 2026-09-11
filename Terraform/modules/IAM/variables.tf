# =============================================================================
# IAM Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Project
# -----------------------------------------------------------------------------

variable "project_name" {
  type        = string
  description = "Name of the project."
}

variable "environment" {
  type        = string
  description = "Deployment environment."
}

# -----------------------------------------------------------------------------
# EKS
# -----------------------------------------------------------------------------

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster. Used only to construct a deterministic ARN and for resource naming — this module does not depend on the EKS module's outputs, to avoid a module dependency cycle (EKS needs IAM's role ARNs to be created)."
}

variable "aws_region" {
  type        = string
  description = "AWS region, used to deterministically construct the EKS cluster ARN for the GitHub Actions policy without depending on module.eks."
}

# -----------------------------------------------------------------------------
# ECR
# -----------------------------------------------------------------------------

variable "ecr_repository_arns" {
  type        = list(string)
  description = "ARNs of the ECR repositories used by Brew Minds."
}

# -----------------------------------------------------------------------------
# GitHub
# -----------------------------------------------------------------------------

variable "github_org" {
  type        = string
  description = "GitHub organization or username that owns the repository."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name."
}