# ---------------------------------------------------------------------------
# ROOT VARIABLES
# All the "dials" for this deployment live here. Change these (usually
# via a terraform.tfvars file you do NOT commit to git) instead of
# editing any module code.
# ---------------------------------------------------------------------------

# --- General ---

variable "project_name" {
  description = "Short project name, used to prefix almost every resource name"
  type        = string
  default     = "brew-minds"
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region to deploy Brew Minds into"
  type        = string
  default     = "ap-south-1"
}

# --- VPC ---

variable "vpc_cidr" {
  description = "IP address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability Zones to spread the infrastructure across"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnet_cidrs" {
  description = "IP ranges for the public subnets, one per Availability Zone"
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "IP ranges for the private subnets, one per Availability Zone"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# --- EKS ---

variable "eks_cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "brew-minds-eks"
}

variable "eks_version" {
  description = "Kubernetes version for the EKS control plane"
  type        = string
  default     = "1.31"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "eks_desired_nodes" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "eks_min_nodes" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "eks_max_nodes" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 4
}

# --- RDS ---

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.4"
}

variable "rds_instance_class" {
  description = "RDS instance size/type"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "RDS disk size in GB"
  type        = number
  default     = 20
}

variable "rds_database_name" {
  description = "Name of the initial Postgres database"
  type        = string
  default     = "brew_minds_db"
}

variable "rds_username" {
  description = "Master username for the RDS database"
  type        = string
  default     = "brew_minds"
  sensitive   = true
}

variable "rds_password" {
  description = "Master password for the RDS database. Provide this via a terraform.tfvars file that is NOT committed to git, or via the TF_VAR_rds_password environment variable. Never hard-code it here."
  type        = string
  sensitive   = true
}

variable "rds_backup_retention_days" {
  description = "Number of days RDS keeps automated backups"
  type        = number
  default     = 7
}

variable "rds_multi_az" {
  description = "Whether RDS runs a standby replica in a second Availability Zone"
  type        = bool
  default     = false
}

# --- Storage ---

variable "s3_bucket_name" {
  description = "Base name for the S3 bucket used for Brew Minds documents (must be globally unique once prefixed)"
  type        = string
  default     = "documents"
}

# --- Secrets ---

variable "jwt_secret" {
  description = "Secret key used by the Auth Service to sign JWT tokens. Provide via tfvars/environment variable, never hard-code."
  type        = string
  sensitive   = true
}

variable "google_oauth_client_id" {
  description = "Google OAuth client ID used for Google login on the Auth Service"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret used for Google login on the Auth Service"
  type        = string
  default     = ""
  sensitive   = true
}
