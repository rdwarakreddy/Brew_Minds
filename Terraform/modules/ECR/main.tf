# =============================================================================
# ECR Module
# =============================================================================

# -----------------------------------------------------------------------------
# ECR Repositories
# Creates one repository for every backend service and the frontend.
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  # "frontend" and "db-migration" are not in var.backend_services (that
  # variable is specifically the 12 Node microservices, reused elsewhere
  # for IAM/monitoring naming) but both need their own ECR repo too: the
  # frontend nginx image, and the one-off migration image the CI/CD
  # pipeline builds and the kubernetes/database/migration-job.yml Job
  # runs. Adding both directly here (rather than stretching
  # backend_services' meaning to cover non-microservices) keeps that
  # variable's name accurate everywhere else it's used.
  for_each = toset(concat(var.backend_services, ["frontend", "db-migration"]))

  name                 = "${var.project_name}/${each.value}"
  image_tag_mutability = "IMMUTABLE"

  # Automatically scan images when they are pushed to ECR.
  image_scanning_configuration {
    scan_on_push = true
  }

  # Encrypt ECR images at rest using AWS-managed AES256 encryption.
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "${var.project_name}/${each.value}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# ECR Lifecycle Policies
# -----------------------------------------------------------------------------
# Cost optimization:
# - Untagged images expire after 7 days.
# - Keep only the latest 15 staging/prod/SHA images.
# -----------------------------------------------------------------------------

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1

        description = "Expire untagged images after 7 days"

        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }

        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2

        description = "Keep only the most recent 15 tagged images"

        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["staging-", "prod-", "sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 15
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}