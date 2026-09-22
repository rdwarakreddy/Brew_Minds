# ---------------------------------------------------------------------------
# SECRETS MODULE - MAIN
#
# In simple words: instead of writing passwords and secret keys directly
# inside our Terraform files (which is unsafe, since that code often ends
# up in Git), we store them in AWS Secrets Manager - a locked digital
# safe. Terraform only puts the secret VALUE in on day one; after that,
# the running application reads the secret directly from AWS at runtime.
# We never print the actual values back out in outputs.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------
# SECRET CONTAINER: DATABASE CREDENTIALS
# Holds everything a backend service needs to connect to Postgres:
# host, port, database name, username and password, bundled together as
# one JSON object so services only need to fetch one secret.
# -----------------------------------------------------------------------
#This creates the Secret object in AWS Secrets Manager
#But at this point, there is no actual username/password value being stored by this resource.
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.name_prefix}/db-credentials"
  description = "PostgreSQL RDS connection details for Brew Minds"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-db-credentials"
    }
  )
}
#This puts the actual database credentials into that secret.
resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    dbname   = var.db_name
    host     = var.db_host
    port     = var.db_port
  })
}

# -----------------------------------------------------------------------
# SECRET CONTAINER: JWT SECRET
# The Auth Service uses this single secret key to sign login tokens and
# to check that a token presented by a user was really issued by us.
# -----------------------------------------------------------------------
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${local.name_prefix}/jwt-secret"
  description = "JWT signing secret used by the Auth Service"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-jwt-secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    jwt_access_secret = var.jwt_secret
  })
}

# -----------------------------------------------------------------------
# SECRET CONTAINER: GOOGLE OAUTH CREDENTIALS
# Holds the Google Client ID/Secret used for "Sign in with Google" on the
# Auth Service. Kept separate from the JWT secret since it is a different
# kind of credential managed by a different external provider.
# -----------------------------------------------------------------------
resource "aws_secretsmanager_secret" "oauth_credentials" {
  name        = "${local.name_prefix}/oauth-credentials"
  description = "Google OAuth credentials used by the Auth Service"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-oauth-credentials"
    }
  )
}

resource "aws_secretsmanager_secret_version" "oauth_credentials" {
  secret_id = aws_secretsmanager_secret.oauth_credentials.id
  secret_string = jsonencode({
    google_client_id     = var.google_oauth_client_id
    google_client_secret = var.google_oauth_client_secret
  })
}
