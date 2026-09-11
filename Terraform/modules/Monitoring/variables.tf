variable "project_name" {
  description = "Project name used for CloudWatch resources and metric namespaces."
  type        = string
}

variable "environment" {
  description = "Deployment environment such as staging or production."
  type        = string
}

variable "aws_region" {
  description = "AWS region where monitoring resources are created."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name used by Container Insights metrics."
  type        = string
}

variable "rds_instance_identifier" {
  description = "RDS DB instance identifier used for CloudWatch RDS metrics."
  type        = string
}

variable "alb_name" {
  description = "CloudWatch Application Load Balancer dimension value, for example app/brew-minds-alb/1234567890abcdef."
  type        = string
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days application logs are retained in CloudWatch."
  type        = number

  default = 30

  validation {
    condition = contains(
      [
        1,
        3,
        5,
        7,
        14,
        30,
        60,
        90,
        120,
        150,
        180,
        365,
        400,
        545,
        731,
        1827,
        3653,
        0
      ],
      var.cloudwatch_log_retention_days
    )

    error_message = "cloudwatch_log_retention_days must be a valid CloudWatch Logs retention value."
  }
}