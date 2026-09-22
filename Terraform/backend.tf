# ---------------------------------------------------------------------------
# TERRAFORM BACKEND / STATE LOCKING
#
# In simple words: Terraform needs to remember what it already created,
# in a file called the "state file". Instead of keeping that file on one
# person's laptop (risky - it could get lost, or two people could edit
# infrastructure at the same time and corrupt it), we store it remotely
# in a private S3 bucket. The "use_lockfile" setting makes Terraform
# place a small lock file in that same bucket while it's running, so a
# second person/pipeline can't accidentally run Terraform at the same
# time and cause conflicts.
#
# IMPORTANT: Terraform cannot create the S3 bucket that its own state
# will live in as part of this same configuration (that would be a
# chicken-and-egg problem). The bucket referenced below must already
# exist before running `terraform init`. See the bootstrap/ folder for
# the one-time setup that creates it.
# ---------------------------------------------------------------------------

terraform {
  backend "s3" {
    bucket       = "brew-minds-terraform-state"
    key          = "brew-minds/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
