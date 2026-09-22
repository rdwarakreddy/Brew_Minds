# ---------------------------------------------------------------------------
# SECRETS MODULE - OUTPUTS
# Only names and ARNs are exposed here (pointers to the safe), never the
# actual secret contents. Whoever needs the real values must fetch them
# directly from AWS Secrets Manager with the right permissions.
# ---------------------------------------------------------------------------

output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_secret_name" {
  description = "Name of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "jwt_secret_arn" {
  description = "ARN of the JWT signing secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "jwt_secret_name" {
  description = "Name of the JWT signing secret"
  value       = aws_secretsmanager_secret.jwt_secret.name
}

output "oauth_credentials_secret_arn" {
  description = "ARN of the OAuth credentials secret"
  value       = aws_secretsmanager_secret.oauth_credentials.arn
}

output "oauth_credentials_secret_name" {
  description = "Name of the OAuth credentials secret"
  value       = aws_secretsmanager_secret.oauth_credentials.name
}
