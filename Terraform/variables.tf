variable "aws_region" {
  description = "AWS region where Brew Minds infrastructure will be deployed."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used for AWS resources."
  type        = string
  default     = "brew-minds"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

# ---------------------------------------------------------
# VPC
# ---------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones used by the infrastructure."
  type        = list(string)

  default = [
    "ap-south-1a",
    "ap-south-1b"
  ]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets."
  type        = list(string)

  default = [
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets."
  type        = list(string)

  default = [
    "10.0.11.0/24",
    "10.0.12.0/24"
  ]
}

variable "private_db_subnet_cidrs" {
  description = "CIDRs for private database subnets."
  type        = list(string)

  default = [
    "10.0.21.0/24",
    "10.0.22.0/24"
  ]
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway to reduce cost."
  type        = bool
  default     = true
}

# ---------------------------------------------------------
# EKS
# ---------------------------------------------------------

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "brew-minds-cluster"
}

variable "eks_cluster_version" {
  description = "Kubernetes version for EKS."
  type        = string
  default     = "1.33"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS managed node group."
  type        = list(string)

  default = [
    "t3.medium"
  ]
}

variable "eks_node_disk_size" {
  description = "EKS node disk size in GB."
  type        = number
  default     = 30
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS nodes."
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS nodes."
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS nodes."
  type        = number
  default     = 3
}

# ---------------------------------------------------------
# ECR
# ---------------------------------------------------------

variable "backend_services" {
  description = "Brew Minds backend microservices."
  type        = list(string)

  default = [
    "apiGateway",
    "authService",
    "leadService",
    "clientService",
    "projectService",
    "paymentService",
    "meetingService",
    "taskService",
    "documentService",
    "invoiceService",
    "notificationService",
    "dashboardService"
  ]
}

# ---------------------------------------------------------
# RDS
# ---------------------------------------------------------

variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.4"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum RDS autoscaling storage in GB."
  type        = number
  default     = 100
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "brewminds"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "brewminds_admin"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enable RDS deletion protection."
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "RDS backup retention period."
  type        = number
  default     = 7
}

# ---------------------------------------------------------
# Monitoring
# ---------------------------------------------------------

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention period."
  type        = number
  default     = 30
}

# ---------------------------------------------------------
# GitHub Actions
# ---------------------------------------------------------

variable "github_org" {
  description = "GitHub organization or username."
  type        = string
  default     = "rdwarakreddy"
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "Brew_Minds"
}