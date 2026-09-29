# ---------------------------------------------------------------------------
# CICD MODULE - VARIABLES
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name of the project, used to prefix resource names"
  type        = string
}

variable "environment" {
  description = "Environment name, e.g. dev, staging, prod"
  type        = string
}

variable "github_org" {
  description = "GitHub username or organization that owns the Brew Minds repository, e.g. the \"X\" in github.com/X/Brew_Minds"
  type        = string
}

variable "github_repo" {
  description = "Name of the GitHub repository, e.g. the \"Brew_Minds\" in github.com/X/Brew_Minds"
  type        = string
  default     = "Brew_Minds"
}

variable "github_oidc_subject_claims" {
  description = <<-EOT
    Which GitHub Actions "sub" claims are allowed to assume this role,
    as StringLike patterns. The default only allows runs triggered by a
    push to the "main" branch of the exact repo above (matching this
    workflow's actual deployment trigger) - NOT every branch, and NOT
    pull_request runs (which never need AWS credentials - see the
    `validate` job, which runs with no AWS auth at all). If you rename
    your default branch or want to allow workflow_dispatch from a
    different branch, add the matching pattern here, e.g.
    "repo:my-org/Brew_Minds:ref:refs/heads/develop". Docs:
    https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#example-subject-claims
  EOT
  type        = list(string)
  default     = []
}

variable "create_oidc_provider" {
  description = "Whether to create a new GitHub OIDC provider in this AWS account. Set to false (and set existing_oidc_provider_arn) if this account already has one - AWS only allows one per URL per account."
  type        = bool
  default     = true
}

variable "existing_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider to reuse, only used when create_oidc_provider = false"
  type        = string
  default     = ""
}

variable "ecr_repository_arns" {
  description = "List of ECR repository ARNs this role is allowed to push/pull images to (from module.ecr.repository_arns)"
  type        = list(string)
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster this role needs to deploy to"
  type        = string
}

variable "eks_cluster_arn" {
  description = "ARN of the EKS cluster (for the eks:DescribeCluster permission)"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes namespace this role is granted Edit access to (must match K8s/namespace.yml)"
  type        = string
  default     = "brew-minds"
}

variable "tags" {
  description = "Common tags applied to every resource in this module"
  type        = map(string)
  default     = {}
}
