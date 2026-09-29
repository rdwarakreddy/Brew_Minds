# ---------------------------------------------------------------------------
# CICD MODULE - MAIN
#
# ⚠ THIS MODULE WAS ADDED DURING THE DEVOPS AUDIT. It did not exist
# before. Why it's needed, and why it's Terraform (not a manual AWS
# console click):
#
#   The GitHub Actions workflow (cicd/.github/workflows/application-cicd.yml)
#   already references ${{ vars.AWS_OIDC_ROLE_ARN }} to authenticate to
#   AWS - but nothing anywhere in this project actually CREATED that
#   role. Without it, every workflow run would fail at the
#   "Authenticate to AWS via OIDC" step with "role does not exist" (or
#   the person would be tempted to fall back to long-lived AWS access
#   keys stored as a GitHub Secret, which Rule 3 of this project
#   explicitly says to avoid).
#
#   This is handled in Terraform, not the AWS Console, for the same
#   reason every other piece of this project's infrastructure is:
#   it's reviewable in a pull request, reproducible if the AWS account
#   is ever rebuilt, and it keeps the trust relationship (exactly which
#   GitHub repository is allowed to assume this role) as auditable code
#   instead of a console setting nobody remembers configuring.
#
# WHAT THIS MODULE CREATES
#   1. A GitHub OIDC identity provider in this AWS account (so AWS
#      knows how to verify a token GitHub hands out).
#   2. An IAM role that GitHub Actions - and ONLY workflow runs of the
#      exact repository/branch configured below - can assume, with a
#      LEAST-PRIVILEGE policy: push/pull this project's own ECR
#      repositories, and read EKS cluster connection details. Nothing
#      else. Definitely not AdministratorAccess.
#   3. An EKS "access entry" that grants that same IAM role permission
#      to run kubectl commands against the Brew Minds namespace ONLY
#      (not cluster-admin) once it has authenticated - IAM alone does
#      NOT grant Kubernetes API access; EKS access entries are the
#      bridge between "this is a valid AWS identity" and "this AWS
#      identity is allowed to do X inside Kubernetes".
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # GitHub's OIDC token issuer - the same for every GitHub account/repo,
  # this is not specific to this project.
  github_oidc_url = "https://token.actions.githubusercontent.com"

  # If github_oidc_subject_claims wasn't overridden, default to "only a
  # push to main, on this exact repo" - see the variable's own
  # description for why.
  default_subject_claims = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
  subject_claims          = length(var.github_oidc_subject_claims) > 0 ? var.github_oidc_subject_claims : local.default_subject_claims
}

# =========================================================================
# GITHUB OIDC IDENTITY PROVIDER
# =========================================================================
# Tells AWS "trust identity tokens issued by GitHub Actions". This is a
# one-per-AWS-ACCOUNT resource (not one-per-project) - if your AWS
# account already has a GitHub OIDC provider configured (common in an
# organization that runs several repositories' pipelines from the same
# account), set create_oidc_provider = false and pass its existing ARN
# in via existing_oidc_provider_arn instead of creating a second,
# conflicting one (AWS only allows one provider per unique URL per
# account, so a second attempt would fail with "already exists").
#
# On the thumbprint: AWS now verifies GitHub's OIDC tokens using its own
# library of trusted root CAs for token.actions.githubusercontent.com
# and no longer actually relies on the thumbprint_list value for this
# specific, well-known provider - but the Terraform resource still
# requires *a* value be supplied. The value below is GitHub's documented
# thumbprint from their official OIDC setup guide.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = local.github_oidc_url
  client_id_list  = ["sts.amazonaws.com"]
  # thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea"]

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-github-oidc"
    }
  )
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn
}

# =========================================================================
# IAM ROLE GITHUB ACTIONS ASSUMES
# =========================================================================
# The trust policy below is the actual security boundary: it only
# allows THIS EXACT repository (var.github_org/var.github_repo) to
# assume this role, and by default only workflow runs triggered from
# the given branch(es)/refs (var.github_oidc_subject_claims) - not
# every fork, not every branch, not every other repository in GitHub.
resource "aws_iam_role" "github_actions" {
  name = "${local.name_prefix}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = local.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = local.subject_claims
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-github-actions-role"
    }
  )
}

# -----------------------------------------------------------------------
# POLICY: PUSH/PULL THIS PROJECT'S OWN ECR REPOSITORIES ONLY
# -----------------------------------------------------------------------
# ecr:GetAuthorizationToken has no resource-level permissions in AWS (it
# must be Resource = "*"), which is why it's split into its own
# statement - everything else is scoped down to the exact repository
# ARNs Terraform's ecr module created, nothing broader.
resource "aws_iam_role_policy" "ecr_push" {
  name = "${local.name_prefix}-github-actions-ecr-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRPushPullThisProjectOnly"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = var.ecr_repository_arns
      }
    ]
  })
}

# -----------------------------------------------------------------------
# POLICY: READ EKS CLUSTER CONNECTION DETAILS
# -----------------------------------------------------------------------
# `aws eks update-kubeconfig` (used by the deploy job) needs exactly
# this one permission, scoped to the one cluster this project uses.
# It does NOT grant any ability to actually do anything inside
# Kubernetes - that's the access entry below.
resource "aws_iam_role_policy" "eks_describe" {
  name = "${local.name_prefix}-github-actions-eks-describe-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeThisClusterOnly"
        Effect   = "Allow"
        Action   = "eks:DescribeCluster"
        Resource = var.eks_cluster_arn
      }
    ]
  })
}

# =========================================================================
# EKS ACCESS ENTRY - GRANTS THE ROLE KUBERNETES-LEVEL PERMISSIONS
# =========================================================================
# IAM only proves WHO is asking. Kubernetes RBAC decides WHAT they can
# do once inside the cluster. An access entry is the bridge: it tells
# EKS "map this specific IAM role to this specific Kubernetes
# permission set". Scoped to the Brew Minds namespace only (via
# access_scope below) with the AWS-managed "Edit" policy - enough to
# create/update/delete the Deployments/Services/etc this pipeline
# manages, but NOT cluster-admin, and NOT permission to touch anything
# outside the brew-minds namespace.
resource "aws_eks_access_entry" "github_actions" {
  cluster_name  = var.eks_cluster_name
  principal_arn = aws_iam_role.github_actions.arn
  type          = "STANDARD"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-github-actions-access-entry"
    }
  )
}

resource "aws_eks_access_policy_association" "github_actions_edit" {
  cluster_name  = var.eks_cluster_name
  principal_arn = aws_iam_role.github_actions.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"

  access_scope {
    type       = "namespace"
    namespaces = [var.k8s_namespace]
  }

  depends_on = [aws_eks_access_entry.github_actions]
}
