# ---------------------------------------------------------------------------
# AWS Secrets Manager - RDS Credentials
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/${var.environment}/db-credentials"

  description = "RDS PostgreSQL master credentials for ${var.project_name} ${var.environment}"

  tags = {
    Name        = "${var.project_name}/${var.environment}/db-credentials"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Secret Version
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    DB_HOST     = var.db_host
    DB_PORT     = tostring(var.db_port)
    DB_NAME     = var.db_name
    DB_USER     = var.db_username
    DB_PASSWORD = var.db_password
  })
}