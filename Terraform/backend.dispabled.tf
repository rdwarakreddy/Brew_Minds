# =============================================================================
# Terraform Remote State Backend
# =============================================================================
# Stores Terraform state remotely in Amazon S3.
# S3 native state locking is enabled using use_lockfile.
# Requires Terraform >= 1.10.
# =============================================================================

terraform {
  backend "s3" {
    bucket       = "brew-minds-tfstate-REPLACE-WITH-ACCOUNT-ID"
    key          = "brew-minds/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}