# ---------------------------------------------------------------------------
# EKS MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix resource names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version the EKS control plane runs"
  type        = string
  default     = "1.31"
}

variable "vpc_id" {
  description = "VPC ID the cluster and its nodes will run in (from the VPC module)"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs the worker nodes will run in (from the VPC module), so nodes stay out of direct internet reach"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs, needed so the EKS-managed ALB (created later by the Load Balancer Controller) can be internet-facing"
  type        = list(string)
}

variable "node_security_group_id" {
  description = "Security group ID to attach to the worker nodes (from the VPC module)"
  type        = string
}

variable "node_instance_type" {
  description = "EC2 instance type used for the worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_count" {
  description = "Desired number of worker nodes running day-to-day"
  type        = number
  default     = 2
}

variable "node_min_count" {
  description = "Minimum number of worker nodes (the cluster will never scale below this)"
  type        = number
  default     = 2
}

variable "node_max_count" {
  description = "Maximum number of worker nodes (the cluster will never scale above this)"
  type        = number
  default     = 4
}

variable "endpoint_public_access" {
  description = "Whether the Kubernetes API endpoint can be reached from the public internet (useful for kubectl from a laptop). Kept true for a portfolio project so it's easy to manage; the WORKER NODES themselves still stay private regardless of this setting."
  type        = bool
  default     = true
}

variable "endpoint_private_access" {
  description = "Whether the Kubernetes API endpoint can be reached from inside the VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags applied to EKS resources"
  type        = map(string)
  default     = {}
}
