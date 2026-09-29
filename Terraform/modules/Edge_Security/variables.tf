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
  # ⚠ AUDIT FIX: was "/health". The K8s TargetGroupBinding
  # (K8s/ingress.yml) registers this target group against the
  # "frontend" Service on port 80, not api-gateway on port 5000 (see
  # the target_port note below) - and Frontend/nginx.conf only serves
  # "/" (no "/health" location exists there, so the ALB health check
  # would have gotten a 404 and marked every target unhealthy). "/"
  # is what the frontend's own Dockerfile HEALTHCHECK and Kubernetes
  # readiness/liveness probes already use (see K8s/Frontend/deployment.yml),
  # so this now matches all three checks.
  description = "Path the ALB uses to check that backend services are healthy"
  type        = string
  default     = "/"
}

variable "target_port" {
  # ⚠ AUDIT FIX: was 5000 (api-gateway's port). K8s/ingress.yml's
  # TargetGroupBinding explicitly binds this target group's ARN to the
  # "frontend" Service (K8s/Frontend/service.yml), which listens on
  # port 80 - Nginx inside the frontend container proxies "/api/*" on
  # to api-gateway internally (see Frontend/nginx.conf), so the ALB
  # itself only ever needs to reach the frontend Pods on port 80. This
  # was flagged as a required cross-file follow-up directly inside
  # K8s/ingress.yml's own comments; this is that fix.
  description = "Port on the EKS pods that the ALB forwards traffic to (the frontend Nginx container's port - it internally proxies /api/* to api-gateway, see Frontend/nginx.conf)"
  type        = number
  default     = 80
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
