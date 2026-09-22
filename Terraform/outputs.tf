# ---------------------------------------------------------------------------
# ROOT OUTPUTS
# These are the values you'll actually want after running `terraform
# apply` - cluster names, endpoints, URLs, etc. Nothing sensitive (like
# the real database password) is ever output here.
# ---------------------------------------------------------------------------

# --- VPC ---

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# --- ECR ---

output "ecr_repository_urls" {
  description = "Map of service name -> ECR repository URL, used when pushing Docker images"
  value       = module.ecr.repository_urls
}

# --- EKS ---

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "API endpoint of the EKS cluster"
  value       = module.eks.cluster_endpoint
}

# --- RDS ---

output "rds_endpoint" {
  description = "Connection endpoint of the RDS database"
  value       = module.database.rds_endpoint
}

output "rds_port" {
  description = "Port the RDS database listens on"
  value       = module.database.rds_port
}

# --- Storage ---

output "s3_bucket_name" {
  description = "Name of the S3 bucket used for Brew Minds documents"
  value       = module.storage.bucket_name
}

# --- Secrets ---

output "secret_arns" {
  description = "ARNs of the Secrets Manager entries (not the secret values themselves)"
  value = {
    db_credentials    = module.secrets.db_credentials_secret_arn
    jwt_secret        = module.secrets.jwt_secret_arn
    oauth_credentials = module.secrets.oauth_credentials_secret_arn
  }
}

# --- Edge / Security ---

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.edge_security.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "Public CloudFront domain name - this is the main URL to access Brew Minds"
  value       = module.edge_security.cloudfront_domain_name
}
