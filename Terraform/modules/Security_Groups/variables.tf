variable "project_name" {
  description = "Project name used for security group naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment such as staging or production."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the security groups will be created."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name used for Kubernetes security group tagging."
  type        = string
}