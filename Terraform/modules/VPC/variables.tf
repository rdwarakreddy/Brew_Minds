# ---------------------------------------------------------------------------
# VPC MODULE - VARIABLES
# These are the "settings" that whoever uses this module can change.
# Nothing here is hard-coded, so this module can be reused for any project.
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix resource names (e.g. brew-minds)"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "aws_region" {
  description = "AWS region where the VPC and its resources will be created"
  type        = string
}

variable "vpc_cidr" {
  description = "The main IP address range for the whole VPC (e.g. 10.0.0.0/16)"
  type        = string
}

variable "availability_zones" {
  description = "List of Availability Zones to spread subnets across (at least 2, for high availability)"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "List of IP ranges for the public subnets, one per Availability Zone"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "List of IP ranges for the private subnets, one per Availability Zone"
  type        = list(string)
}

variable "tags" {
  description = "Common tags applied to every resource in this module, so resources are easy to identify and group"
  type        = map(string)
  default     = {}
}
