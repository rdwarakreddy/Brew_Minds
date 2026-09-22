# ---------------------------------------------------------------------------
# EDGE-SECURITY MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix resource names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID the Application Load Balancer will be created in (from the VPC module)"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs the ALB will be placed in (from the VPC module), so it can be reached from the internet"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID to attach to the ALB (from the VPC module)"
  type        = string
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster the ALB will eventually route traffic to (used for tagging/traceability)"
  type        = string
}

variable "health_check_path" {
  description = "Path the ALB uses to check that backend services are healthy"
  type        = string
  default     = "/health"
}

variable "target_port" {
  description = "Port on the EKS nodes/pods that the ALB forwards traffic to (the API Gateway's port)"
  type        = number
  default     = 5000
}

variable "waf_rate_limit" {
  description = "Maximum number of requests a single IP can make in a 5-minute window before WAF starts blocking it"
  type        = number
  default     = 2000
}

variable "cloudfront_price_class" {
  description = "Which CloudFront edge locations to use. PriceClass_100 = North America & Europe only (cheapest), good enough for a portfolio project"
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Common tags applied to edge/security resources"
  type        = map(string)
  default     = {}
}
