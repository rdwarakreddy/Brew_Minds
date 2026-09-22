# ---------------------------------------------------------------------------
# ECR MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix repository names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "service_names" {
  description = "List of Brew Minds service names, one Docker image repository is created per entry"
  type        = list(string)
  default = [
    "frontend",
    "api-gateway",
    "auth",
    "leads",
    "clients",
    "projects",
    "payments",
    "meetings",
    "tasks",
    "documents",
    "invoices",
    "notifications",
    "dashboard",
  ]
}

variable "image_tag_mutability" {
  description = "Whether image tags can be overwritten. IMMUTABLE means once a tag like v1.0.0 is pushed, it can never be pushed again with a different image, which keeps deployments predictable."
  type        = string
  default     = "IMMUTABLE"
}

variable "scan_on_push" {
  description = "Automatically scan every image pushed to ECR for known security vulnerabilities"
  type        = bool
  default     = true
}

variable "untagged_image_expiry_days" {
  description = "Number of days to keep untagged (leftover/dangling) images before automatically deleting them"
  type        = number
  default     = 7
}

variable "tagged_image_count_to_keep" {
  description = "Number of most-recent tagged images to keep per repository, older ones are cleaned up automatically"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Common tags applied to every ECR repository"
  type        = map(string)
  default     = {}
}
