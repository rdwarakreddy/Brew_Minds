# ---------------------------------------------------------------------------
# ECR MODULE - MAIN
#
# In simple words: ECR is just a private "shelf" in AWS where we store our
# Docker images (the packaged version of each microservice). Instead of
# writing 13 almost-identical blocks of code by hand, one for every
# service, we loop over the list of service names with for_each and stamp
# out one repository per service automatically.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Turn the list of service names into a set, which is what for_each needs
  services = toset(var.service_names)
}

# -----------------------------------------------------------------------
# ONE ECR REPOSITORY PER SERVICE
# Each Brew Minds microservice (frontend, auth, leads, etc.) gets its own
# repository. Keeping them separate makes it easy to manage permissions
# and lifecycle rules per service later if needed.
# -----------------------------------------------------------------------
resource "aws_ecr_repository" "this" {
  for_each = local.services

  name                 = "${local.name_prefix}-${each.value}"
  image_tag_mutability = var.image_tag_mutability

  # Scan every image the moment it's pushed, so we find security issues early
  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  # Encrypt every image at rest using AWS's own managed key (simplest, no
  # extra key management needed for a project this size)
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(
    var.tags,
    {
      Name    = "${local.name_prefix}-${each.value}"
      Service = each.value
    }
  )
}

# -----------------------------------------------------------------------
# LIFECYCLE POLICY PER REPOSITORY
# Without this, old Docker images would pile up forever and cost money.
# This policy does two things for every repository:
#   1. Deletes "untagged" images (leftovers from old builds) after a few days
#   2. Keeps only the most recent N tagged images, removing anything older
# -----------------------------------------------------------------------
resource "aws_ecr_lifecycle_policy" "this" {
  for_each = local.services

  repository = aws_ecr_repository.this[each.value].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged images after ${var.untagged_image_expiry_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_image_expiry_days
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep only the last ${var.tagged_image_count_to_keep} tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "latest", "main", "prod"]
          countType     = "imageCountMoreThan"
          countNumber   = var.tagged_image_count_to_keep
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
