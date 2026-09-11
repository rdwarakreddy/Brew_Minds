# =========================================================
# VPC
# =========================================================

module "vpc" {
  source = "./modules/VPC"

  project_name = var.project_name
  environment  = var.environment

  vpc_cidr                 = var.vpc_cidr
  availability_zones       = var.availability_zones
  public_subnet_cidrs      = var.public_subnet_cidrs
  private_app_subnet_cidrs = var.private_app_subnet_cidrs
  private_db_subnet_cidrs  = var.private_db_subnet_cidrs

  single_nat_gateway = var.single_nat_gateway
}


# =========================================================
# SECURITY GROUPS
# =========================================================

module "security_groups" {
  source = "./modules/Security_Groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  cluster_name = var.cluster_name

  depends_on = [
    module.vpc
  ]
}


# =========================================================
# ECR
# =========================================================

module "ecr" {
  source = "./modules/ECR"

  project_name     = var.project_name
  environment      = var.environment
  backend_services = var.backend_services
}


# =========================================================
# IAM (base roles only — no EKS dependency)
# =========================================================
#
# FIXED: the original wiring had module.iam consuming
# module.eks.cluster_arn / oidc_provider_arn / oidc_issuer_url
# while module.eks itself consumes module.iam.eks_cluster_role_arn /
# eks_node_role_arn. That is a genuine Terraform module cycle
# (module.iam -> module.eks -> module.iam) and `terraform validate`
# / `plan` fails with "Cycle" the moment both modules reference
# each other's outputs.
#
# Fix: this IAM module only creates the cluster role, node role, and
# GitHub Actions role — none of which need anything from EKS. The
# EKS-OIDC-dependent application IRSA role now lives in its own
# `module.irsa`, created AFTER module.eks and module.secrets below.
# =========================================================

module "iam" {
  source = "./modules/IAM"

  project_name = var.project_name
  environment  = var.environment
  cluster_name = var.cluster_name
  aws_region   = var.aws_region

  # ECR repositories are created independently.
  ecr_repository_arns = values(module.ecr.repository_arns)

  github_org  = var.github_org
  github_repo = var.github_repo

  depends_on = [
    module.ecr
  ]
}


# =========================================================
# EKS
# =========================================================

module "eks" {
  source = "./modules/EKS"

  project_name = var.project_name
  environment  = var.environment

  cluster_name        = var.cluster_name
  eks_cluster_version = var.eks_cluster_version

  private_subnet_ids = module.vpc.private_app_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  eks_cluster_role_arn = module.iam.eks_cluster_role_arn
  eks_node_role_arn    = module.iam.eks_node_role_arn

  # IAM policy attachments required by the EKS module
  eks_cluster_role_policy_attachments = module.iam.eks_cluster_role_policy_attachments
  eks_node_role_policy_attachments    = module.iam.eks_node_role_policy_attachments

  eks_node_instance_types = var.eks_node_instance_types
  eks_node_disk_size      = var.eks_node_disk_size

  eks_node_desired_size = var.eks_node_desired_size
  eks_node_min_size     = var.eks_node_min_size
  eks_node_max_size     = var.eks_node_max_size

  github_actions_role_arn = module.iam.github_actions_role_arn

  depends_on = [
    module.vpc,
    module.security_groups,
    module.iam
  ]
}


# =========================================================
# RDS
# =========================================================

module "rds" {
  source = "./modules/RDS"

  project_name = var.project_name
  environment  = var.environment

  private_db_subnet_ids = module.vpc.private_db_subnet_ids

  rds_security_group_id = module.security_groups.rds_security_group_id

  db_engine_version        = var.db_engine_version
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage

  db_name     = var.db_name
  db_username = var.db_username

  db_multi_az                = var.db_multi_az
  db_deletion_protection     = var.db_deletion_protection
  db_backup_retention_period = var.db_backup_retention_period

  depends_on = [
    module.vpc,
    module.security_groups
  ]
}


# =========================================================
# SECRETS MANAGER
# =========================================================

module "secrets" {
  source = "./modules/Secrets"

  project_name = var.project_name
  environment  = var.environment

  db_host     = module.rds.db_instance_address
  db_port     = module.rds.db_instance_port
  db_name     = module.rds.db_name
  db_username = module.rds.db_username
  db_password = module.rds.db_master_password

  depends_on = [
    module.rds
  ]
}


# =========================================================
# ALB / AWS LOAD BALANCER CONTROLLER
# =========================================================
#
# This module installs the AWS Load Balancer Controller.
#
# It does NOT create the final application ALB itself.
# The ALB will be created by Kubernetes Ingress after the
# application is deployed.
# =========================================================

module "alb" {
  source = "./modules/ALB"

  aws_region  = var.aws_region
  environment = var.environment

  cluster_name = module.eks.cluster_name
  vpc_id       = module.vpc.vpc_id

  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_issuer_url   = module.eks.oidc_issuer_url

  depends_on = [
    module.eks
  ]
}


# =========================================================
# IRSA — Application ServiceAccount Role
# =========================================================
#
# Created AFTER EKS (needs its OIDC provider) and Secrets
# (needs the secret ARN to scope access to). This is the
# piece that used to live inside module.iam and caused the
# module cycle described above.
# =========================================================

module "irsa" {
  source = "./modules/IRSA"

  project_name = var.project_name
  environment  = var.environment
  cluster_name = var.cluster_name

  eks_oidc_provider_arn = module.eks.oidc_provider_arn
  eks_oidc_issuer_url   = module.eks.oidc_issuer_url

  application_secret_arns = [
    module.secrets.db_credentials_secret_arn
  ]

  depends_on = [
    module.eks,
    module.secrets
  ]
}


# =========================================================
# MONITORING
# =========================================================
#
# Monitoring receives:
# - EKS cluster information
# - RDS information
# - CloudWatch log information
#
# ALB-specific metrics will be connected once the
# Kubernetes Ingress creates the actual ALB.
# =========================================================

module "monitoring" {
  source = "./modules/Monitoring"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  cluster_name = module.eks.cluster_name

  rds_instance_identifier = module.rds.db_instance_id

  cloudwatch_log_retention_days = var.cloudwatch_log_retention_days

  # This should be supplied after the AWS Load Balancer
  # Controller creates the actual ALB.
  #
  # Keep empty for the initial infrastructure deployment.
  alb_name = ""

  depends_on = [
    module.eks,
    module.rds
  ]
}