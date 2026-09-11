variable "project_name" {
  description = "Project name used for VPC resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment such as staging or production."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string

  default = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones used by the VPC."
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
  description = "CIDR blocks for public subnets."
  type        = list(string)

  default = [
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]

  validation {
    condition = length(var.public_subnet_cidrs) == length(
      var.availability_zones
    )

    error_message = "The number of public subnet CIDRs must match the number of availability zones."
  }
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private application/EKS subnets."
  type        = list(string)

  default = [
    "10.0.11.0/24",
    "10.0.12.0/24"
  ]

  validation {
    condition = length(var.private_app_subnet_cidrs) == length(
      var.availability_zones
    )

    error_message = "The number of private application subnet CIDRs must match the number of availability zones."
  }
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private database subnets."
  type        = list(string)

  default = [
    "10.0.21.0/24",
    "10.0.22.0/24"
  ]

  validation {
    condition = length(var.private_db_subnet_cidrs) == length(
      var.availability_zones
    )

    error_message = "The number of private database subnet CIDRs must match the number of availability zones."
  }
}

variable "single_nat_gateway" {
  description = "Use one NAT Gateway for all private application subnets to reduce cost. Set false for one NAT Gateway per AZ."
  type        = bool

  default = true
}