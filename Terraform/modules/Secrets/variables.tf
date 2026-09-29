# ---------------------------------------------------------------------------
# SECRETS MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix secret names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "db_username" {
  description = "Database master username, stored inside the database credentials secret"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database master password, stored inside the database credentials secret. Never hard-code this - pass it in via a tfvars file that is not committed, or an environment variable."
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Database name, stored inside the database credentials secret so services know which database to connect to"
  type        = string
}

variable "db_host" {
  description = "Database endpoint/host, stored inside the database credentials secret. Left empty until the database module creates it, then filled in by the root module."
  type        = string
  default     = ""
}

variable "db_port" {
  description = "Database port, stored inside the database credentials secret"
  type        = number
  default     = 5432
}

variable "jwt_secret" {
  description = "Secret key used by the Auth Service to sign and verify ACCESS tokens"
  type        = string
  sensitive   = true
}

# ⚠ AUDIT FIX: added. authService/src/utils/tokens.js signs access
# tokens and refresh tokens with two DELIBERATELY SEPARATE secrets
# (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET), and K8s/secrets.yml already
# expects a jwt_refresh_secret value here - but this module previously
# only stored jwt_access_secret, so there was nowhere secure for the
# refresh secret to live. Kept as its own variable (not reusing
# jwt_secret) to preserve that intended access/refresh separation:
# reusing one secret for both would mean a leaked access-token secret
# could also be used to forge long-lived refresh tokens.
variable "jwt_refresh_secret" {
  description = "Secret key used by the Auth Service to sign and verify REFRESH tokens (deliberately separate from jwt_secret)"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_id" {
  description = "Google OAuth client ID used by the Auth Service for Google login"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret used by the Auth Service for Google login"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Common tags applied to every secret"
  type        = map(string)
  default     = {}
}
