# ---------------------------------------------------------------------------
# ROOT MAIN
#
# In simple words: this file is the "assembly line". It doesn't create
# any AWS resources directly - it just calls each module in the right
# order and passes the right outputs from one module as inputs into the
# next, so everything gets wired together correctly. The real dependency
# chain is:
#
#   VPC  -->  EKS, RDS, Edge/Security   (all three need the network first)
#   RDS  -->  Secrets                    (secret needs the real DB endpoint)
#   EKS  -->  Edge/Security              (ALB tagging references the cluster)
#
# We rely on Terraform automatically detecting these dependencies through
# the module.xxx.output references below - no manual depends_on needed.
# ---------------------------------------------------------------------------

locals {
  common_tags = {
    Project     = "Brew-Minds"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# =========================================================================
# 1. VPC - the network everything else lives inside
# =========================================================================
module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = local.common_tags
}

# =========================================================================
# 2. ECR - one Docker image repository per Brew Minds service
#    Independent of the network, so it can be created in parallel.
# =========================================================================
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# =========================================================================
# 3. EKS - the Kubernetes cluster that runs all backend services
#    Needs the VPC's private/public subnets and node security group.
# =========================================================================
module "eks" {
  source = "./modules/eks"

  project_name           = var.project_name
  environment            = var.environment
  cluster_name           = var.eks_cluster_name
  kubernetes_version     = var.eks_version
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  public_subnet_ids      = module.vpc.public_subnet_ids
  node_security_group_id = module.vpc.eks_nodes_security_group_id
  node_instance_type     = var.eks_node_instance_type
  node_desired_count     = var.eks_desired_nodes
  node_min_count         = var.eks_min_nodes
  node_max_count         = var.eks_max_nodes
  tags                   = local.common_tags
}

# =========================================================================
# 4. DATABASE - PostgreSQL RDS instance
#    Needs the VPC's private subnets and database security group.
# =========================================================================
module "database" {
  source = "./modules/database"

  project_name          = var.project_name
  environment           = var.environment
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  database_name         = var.rds_database_name
  database_username     = var.rds_username
  database_password     = var.rds_password
  backup_retention_days = var.rds_backup_retention_days
  multi_az              = var.rds_multi_az
  private_subnet_ids    = module.vpc.private_subnet_ids
  security_group_id     = module.vpc.database_security_group_id
  tags                  = local.common_tags
}

# =========================================================================
# 5. STORAGE - S3 bucket for application documents
#    Independent of the network, so it can be created in parallel.
# =========================================================================
module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
  bucket_name  = var.s3_bucket_name
  tags         = local.common_tags
}

# =========================================================================
# 6. SECRETS - AWS Secrets Manager entries
#    Uses the REAL database endpoint from the database module output,
#    rather than a fake/placeholder host, so the secret is immediately
#    usable by the application once created.
# =========================================================================
module "secrets" {
  source = "./modules/secrets"

  project_name               = var.project_name
  environment                = var.environment
  db_username                = var.rds_username
  db_password                = var.rds_password
  db_name                    = var.rds_database_name
  db_host                    = module.database.rds_address
  db_port                    = module.database.rds_port
  jwt_secret                 = var.jwt_secret
  google_oauth_client_id     = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret
  tags                       = local.common_tags
}

# =========================================================================
# 7. EDGE-SECURITY - CloudFront + WAF + ALB, the public entry point
#    Needs the VPC's public subnets/ALB security group, and references
#    the real EKS cluster name so the target group is traceable back to
#    the cluster it serves.
# =========================================================================
module "edge_security" {
  source = "./modules/Edge_Security"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.vpc.alb_security_group_id
  eks_cluster_name      = module.eks.cluster_name
  tags                  = local.common_tags
}
