# ---------------------------------------------------------------------------
# ECR MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "repository_names" {
  description = "Map of service name -> ECR repository name"
  value       = { for k, v in aws_ecr_repository.this : k => v.name }
}

output "repository_urls" {
  description = "Map of service name -> full ECR repository URL (used to docker push/pull images)"
  value       = { for k, v in aws_ecr_repository.this : k => v.repository_url }
}

output "repository_arns" {
  description = "Map of service name -> ECR repository ARN"
  value       = { for k, v in aws_ecr_repository.this : k => v.arn }
}
