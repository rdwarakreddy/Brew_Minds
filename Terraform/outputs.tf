# =============================================================================
# Root Outputs
# =============================================================================
# NOTE: this file did not exist in the original project even though the
# assignment explicitly asks for "outputs for key resources". Everything
# below is either used directly by the CI/CD pipeline (ECR URLs, cluster
# name) or is what you'd hand to a teammate to connect to the environment.
# =============================================================================

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC."
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB)."
  value       = module.vpc.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs (EKS worker nodes)."
  value       = module.vpc.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  description = "Private database subnet IDs (RDS)."
  value       = module.vpc.private_db_subnet_ids
}

# -----------------------------------------------------------------------------
# EKS
# -----------------------------------------------------------------------------

output "eks_cluster_name" {
  description = "Name of the EKS cluster. Used by `aws eks update-kubeconfig`."
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Kubernetes API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_version" {
  description = "Kubernetes version running on the cluster."
  value       = module.eks.cluster_version
}

# -----------------------------------------------------------------------------
# ECR
# -----------------------------------------------------------------------------

output "ecr_repository_urls" {
  description = "Map of service name -> ECR repository URL. Used by the CI/CD pipeline to know where to push images."
  value       = module.ecr.repository_urls
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS PostgreSQL connection endpoint (host:port)."
  value       = module.rds.db_instance_endpoint
}

output "rds_database_name" {
  description = "Name of the application database."
  value       = module.rds.db_name
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------

output "db_credentials_secret_name" {
  description = "Name of the Secrets Manager secret holding DB credentials. Use this with `aws secretsmanager get-secret-value` — never the raw password."
  value       = module.secrets.db_credentials_secret_name
}

# -----------------------------------------------------------------------------
# IAM
# -----------------------------------------------------------------------------

output "github_actions_role_arn" {
  description = "IAM role ARN GitHub Actions assumes via OIDC. Set this as the AWS_ROLE_ARN repo/environment variable."
  value       = module.iam.github_actions_role_arn
}

output "app_irsa_role_arn" {
  description = "IAM role ARN for the application's Kubernetes ServiceAccount. Referenced by kubernetes/secrets.yml."
  value       = module.irsa.app_irsa_role_arn
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

output "cloudwatch_dashboard_urls" {
  description = "Direct links to the two CloudWatch dashboards."
  value = {
    infrastructure = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.infrastructure_dashboard_name}"
    application    = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.application_dashboard_name}"
  }
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN alarms publish to. Subscribe an email/Slack integration to this."
  value       = module.monitoring.sns_alerts_topic_arn
}
