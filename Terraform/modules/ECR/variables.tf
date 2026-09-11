# =============================================================================
# ECR Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Project Name
# -----------------------------------------------------------------------------

variable "project_name" {
  type        = string
  description = "Name of the project used as the ECR repository prefix."
}

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------

variable "environment" {
  type        = string
  description = "Deployment environment, such as dev, staging, or production."
}

# -----------------------------------------------------------------------------
# Backend Services
# -----------------------------------------------------------------------------

variable "backend_services" {
  type        = list(string)
  description = "List of backend microservices for which ECR repositories should be created."
}