# =============================================================================
# AWS Load Balancer Controller - ALB Module
# =============================================================================

# -----------------------------------------------------------------------------
# Local Values
# -----------------------------------------------------------------------------

locals {
  cluster_name = var.cluster_name
}

# -----------------------------------------------------------------------------
# IAM Trust Policy for AWS Load Balancer Controller
# Uses EKS OIDC provider for IRSA (IAM Roles for Service Accounts)
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "alb_controller_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${replace(var.oidc_issuer_url, "https://", "")}:sub"

      values = [
        "system:serviceaccount:kube-system:aws-load-balancer-controller"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "${replace(var.oidc_issuer_url, "https://", "")}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

# -----------------------------------------------------------------------------
# IAM Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "alb_controller" {
  name               = "${local.cluster_name}-alb-controller-role"
  assume_role_policy = data.aws_iam_policy_document.alb_controller_trust.json

  tags = {
    Name        = "${local.cluster_name}-alb-controller-role"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# AWS Load Balancer Controller IAM Policy
# -----------------------------------------------------------------------------

data "http" "alb_controller_iam_policy" {
  url = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.9.0/docs/install/iam_policy.json"
}

resource "aws_iam_role_policy" "alb_controller" {
  name   = "${local.cluster_name}-alb-controller-policy"
  role   = aws_iam_role.alb_controller.id
  policy = data.http.alb_controller_iam_policy.response_body
}

# -----------------------------------------------------------------------------
# Kubernetes Service Account
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "alb_controller" {
  metadata {
    name      = "aws-load-balancer-controller"
    namespace = "kube-system"

    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.alb_controller.arn
    }

    labels = {
      "app.kubernetes.io/name"      = "aws-load-balancer-controller"
      "app.kubernetes.io/component" = "controller"
    }
  }

  depends_on = [
    aws_iam_role.alb_controller
  ]
}

# -----------------------------------------------------------------------------
# AWS Load Balancer Controller Helm Chart
# -----------------------------------------------------------------------------

# resource "helm_release" "alb_controller" {
#   name       = "aws-load-balancer-controller"
#   repository = "https://aws.github.io/eks-charts"
#   chart      = "aws-load-balancer-controller"
#   version    = "1.8.1"
#   namespace  = "kube-system"

#   set {
#     name  = "clusterName"
#     value = local.cluster_name
#   }

#   set {
#     name  = "serviceAccount.create"
#     value = "false"
#   }

#   set {
#     name  = "serviceAccount.name"
#     value = kubernetes_service_account.alb_controller.metadata[0].name
#   }

#   set {
#     name  = "region"
#     value = var.aws_region
#   }

#   set {
#     name  = "vpcId"
#     value = var.vpc_id
#   }

#   depends_on = [
#     kubernetes_service_account.alb_controller
#   ]
# }