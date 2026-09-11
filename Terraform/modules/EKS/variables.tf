# =============================================================================
# EKS Module Variables
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
# EKS Cluster
# -----------------------------------------------------------------------------

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster."
}

variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster."
}

variable "eks_cluster_role_arn" {
  type        = string
  description = "IAM role ARN used by the EKS control plane."
}

# -----------------------------------------------------------------------------
# EKS Cluster IAM Dependencies
# -----------------------------------------------------------------------------

variable "eks_cluster_role_policy_attachments" {
  type        = any
  description = "IAM policy attachments required by the EKS cluster role."
}

# -----------------------------------------------------------------------------
# Network
# -----------------------------------------------------------------------------

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs where EKS worker nodes are deployed."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs associated with the EKS cluster."
}

# -----------------------------------------------------------------------------
# EKS Worker Nodes
# -----------------------------------------------------------------------------

variable "eks_node_role_arn" {
  type        = string
  description = "IAM role ARN used by the EKS managed node group."
}

variable "eks_node_role_policy_attachments" {
  type        = any
  description = "IAM policy attachments required by the EKS node role."
}

variable "eks_node_instance_types" {
  type        = list(string)
  description = "EC2 instance types used by the EKS managed node group."

  default = [
    "t3.medium"
  ]
}

variable "eks_node_disk_size" {
  type        = number
  description = "EBS root volume size in GB for EKS worker nodes."

  default = 30
}

variable "eks_node_desired_size" {
  type        = number
  description = "Desired number of EKS worker nodes."

  default = 2
}

variable "eks_node_min_size" {
  type        = number
  description = "Minimum number of EKS worker nodes."

  default = 1
}

variable "eks_node_max_size" {
  type        = number
  description = "Maximum number of EKS worker nodes."

  default = 3
}

# -----------------------------------------------------------------------------
# CloudWatch
# -----------------------------------------------------------------------------

variable "cloudwatch_log_retention_days" {
  type        = number
  description = "Number of days to retain EKS control-plane logs in CloudWatch."

  default = 30
}

# -----------------------------------------------------------------------------
# GitHub Actions
# -----------------------------------------------------------------------------

variable "github_actions_role_arn" {
  type        = string
  description = "IAM role ARN used by GitHub Actions for deployment."
}