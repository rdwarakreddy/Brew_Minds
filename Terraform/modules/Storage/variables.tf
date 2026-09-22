# ---------------------------------------------------------------------------
# STORAGE MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix the bucket name"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "bucket_name" {
  description = "Base name for the S3 bucket that stores Brew Minds documents. A random suffix is not added automatically, so pick something globally unique."
  type        = string
}

variable "noncurrent_version_expiration_days" {
  description = "Number of days to keep old (overwritten) versions of a file before permanently deleting them, keeps storage costs under control"
  type        = number
  default     = 90
}

variable "tags" {
  description = "Common tags applied to the bucket"
  type        = map(string)
  default     = {}
}
