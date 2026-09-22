# ---------------------------------------------------------------------------
# DATABASE MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "rds_endpoint" {
  description = "Connection endpoint (host:port) of the RDS database"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "Hostname only (no port) of the RDS database, useful for the Secrets module"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "Port the database listens on"
  value       = aws_db_instance.main.port
}

output "rds_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "rds_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "database_name" {
  description = "Name of the database created inside the RDS instance"
  value       = aws_db_instance.main.db_name
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = aws_db_subnet_group.main.name
}
