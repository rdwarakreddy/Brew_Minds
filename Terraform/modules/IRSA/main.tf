# =============================================================================
# IRSA Module (IAM Roles for Service Accounts) — Application Role
# =============================================================================
# This role lets the Brew Minds Kubernetes ServiceAccount read the RDS
# credentials from Secrets Manager, without putting AWS keys in a pod.
#
# It is intentionally a SEPARATE module from IAM, created AFTER EKS and
# Secrets. The original code tried to create this role inside the IAM
# module while also having the IAM module create the EKS cluster's own
# roles — but IRSA's trust policy needs the EKS cluster's OIDC provider
# (which only exists once EKS is created), while EKS needs the base IAM
# module's role ARNs to be created in the first place. That produced a
# genuine Terraform module cycle: module.iam -> module.eks -> module.iam.
# Splitting the OIDC-dependent role into its own module removes the cycle:
#   module.iam -> module.eks -> module.irsa (uses module.eks + module.secrets)
# =============================================================================

data "aws_iam_policy_document" "app_irsa_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"

      identifiers = [
        var.eks_oidc_provider_arn
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        var.eks_oidc_issuer_url,
        "https://",
        ""
      )}:sub"

      values = [
        "system:serviceaccount:${var.kubernetes_namespace}:${var.kubernetes_service_account}"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        var.eks_oidc_issuer_url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "app_irsa" {
  name               = "${var.cluster_name}-app-irsa-role"
  assume_role_policy = data.aws_iam_policy_document.app_irsa_trust.json

  tags = {
    Name        = "${var.cluster_name}-app-irsa-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Application Secrets Manager Access
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "app_secrets_access" {
  statement {
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]

    resources = var.application_secret_arns
  }
}

resource "aws_iam_role_policy" "app_secrets_access" {
  name   = "${var.cluster_name}-app-secrets-access"
  role   = aws_iam_role.app_irsa.id
  policy = data.aws_iam_policy_document.app_secrets_access.json
}
