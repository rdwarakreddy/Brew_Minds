variable "project_name" {
  description = "Project name used for RDS resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment such as staging or production."
  type        = string
}

variable "private_db_subnet_ids" {
  description = "Private database subnet IDs where the RDS instance will be deployed."
  type        = list(string)

  validation {
    condition     = length(var.private_db_subnet_ids) >= 2
    error_message = "At least two private DB subnet IDs are required for the RDS subnet group."
  }
}

variable "rds_security_group_id" {
  description = "Security group ID attached to the RDS PostgreSQL instance."
  type        = string
}

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
  description = "Initial RDS storage size in GiB."
  type        = number
  default     = 20

  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "RDS PostgreSQL allocated storage must be at least 20 GiB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum storage size in GiB for RDS storage autoscaling."
  type        = number
  default     = 100

  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "db_max_allocated_storage must be greater than or equal to db_allocated_storage."
  }
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "brewminds"
}

variable "db_username" {
  description = "Master username for the PostgreSQL database."
  type        = string
  default     = "brewminds_admin"
}

variable "db_multi_az" {
  description = "Whether to deploy the RDS instance in Multi-AZ mode."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Prevent accidental deletion of the RDS instance."
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "Number of days automated RDS backups are retained."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_period >= 0 && var.db_backup_retention_period <= 35
    error_message = "RDS backup retention period must be between 0 and 35 days."
  }
}