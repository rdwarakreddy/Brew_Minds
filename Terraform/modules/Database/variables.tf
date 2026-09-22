# ---------------------------------------------------------------------------
# DATABASE MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix resource names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL engine version to run"
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "RDS instance size/type (how much CPU and RAM the database gets)"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Amount of disk space (in GB) given to the database"
  type        = number
  default     = 20
}

variable "database_name" {
  description = "Name of the initial database created inside the RDS instance"
  type        = string
}

variable "database_username" {
  description = "Master username for the database"
  type        = string
  sensitive   = true
}

variable "database_password" {
  description = "Master password for the database. Passed in securely (e.g. from a tfvars file that is never committed), never hard-coded."
  type        = string
  sensitive   = true
}

variable "backup_retention_days" {
  description = "Number of days AWS automatically keeps daily backups of the database"
  type        = number
  default     = 7
}

variable "multi_az" {
  description = "Whether to run a standby copy of the database in a second Availability Zone for automatic failover. Recommended for production."
  type        = bool
  default     = false
}

variable "private_subnet_ids" {
  description = "Private subnet IDs the database will be placed in (from the VPC module), keeping it out of reach of the internet"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID controlling who can talk to the database (from the VPC module)"
  type        = string
}

variable "tags" {
  description = "Common tags applied to database resources"
  type        = map(string)
  default     = {}
}
