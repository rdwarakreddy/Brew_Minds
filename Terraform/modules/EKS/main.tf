# =============================================================================
# EKS Module
# =============================================================================

locals {
  cluster_name = var.cluster_name
}

# =============================================================================
# EKS Cluster
# =============================================================================

resource "aws_eks_cluster" "this" {
  name     = local.cluster_name
  role_arn = var.eks_cluster_role_arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids = concat(
      var.private_subnet_ids,
      var.public_subnet_ids
    )

    endpoint_private_access = true
    endpoint_public_access  = true
  }

  # EKS control-plane logs sent to CloudWatch.
  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  depends_on = [
    var.eks_cluster_role_policy_attachments
  ]

  tags = {
    Name        = local.cluster_name
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# EKS Control Plane CloudWatch Log Group
# =============================================================================

resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${local.cluster_name}/cluster"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name        = "${local.cluster_name}-cluster-logs"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# Managed EKS Node Group
# =============================================================================

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${local.cluster_name}-default"
  node_role_arn   = var.eks_node_role_arn

  # Worker nodes are deployed only in private subnets.
  subnet_ids = var.private_subnet_ids

  instance_types = var.eks_node_instance_types
  disk_size      = var.eks_node_disk_size

  scaling_config {
    desired_size = var.eks_node_desired_size
    min_size     = var.eks_node_min_size
    max_size     = var.eks_node_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role = "application"
  }

  depends_on = [
    var.eks_node_role_policy_attachments
  ]

  tags = {
    Name        = "${local.cluster_name}-node"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# EKS OIDC Provider
# =============================================================================
# Used by IRSA (IAM Roles for Service Accounts).
# Required by:
# - EBS CSI Driver
# - CloudWatch Observability
# - AWS Load Balancer Controller
# =============================================================================

data "tls_certificate" "eks" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    data.tls_certificate.eks.certificates[0].sha1_fingerprint
  ]

  url = aws_eks_cluster.this.identity[0].oidc[0].issuer

  tags = {
    Name        = "${local.cluster_name}-oidc"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# =============================================================================
# aws-auth ConfigMap
# =============================================================================
# Maps AWS IAM roles to Kubernetes identities.
#
# 1. EKS worker-node role
# 2. GitHub Actions deployment role
# =============================================================================

resource "kubernetes_config_map_v1_data" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
  }

  data = {
    mapRoles = yamlencode([
      {
        rolearn  = var.eks_node_role_arn
        username = "system:node:{{EC2PrivateDNSName}}"
        groups = [
          "system:bootstrappers",
          "system:nodes"
        ]
      },
      {
        rolearn  = var.github_actions_role_arn
        username = "github-actions-deployer"
        groups = [
          "brew-minds-deployers"
        ]
      }
    ])
  }

  force = true

  depends_on = [
    aws_eks_node_group.default
  ]
}

# =============================================================================
# EBS CSI Driver - IRSA Trust Policy
# =============================================================================

data "aws_iam_policy_document" "ebs_csi_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.eks.arn
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:sub"

      values = [
        "system:serviceaccount:kube-system:ebs-csi-controller-sa"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

# =============================================================================
# EBS CSI Driver IAM Role
# =============================================================================

resource "aws_iam_role" "ebs_csi" {
  name               = "${local.cluster_name}-ebs-csi-role"
  assume_role_policy = data.aws_iam_policy_document.ebs_csi_trust.json

  tags = {
    Name        = "${local.cluster_name}-ebs-csi-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role = aws_iam_role.ebs_csi.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

# =============================================================================
# EBS CSI Driver EKS Addon
# =============================================================================

resource "aws_eks_addon" "ebs_csi" {
  cluster_name = aws_eks_cluster.this.name

  addon_name = "aws-ebs-csi-driver"

  service_account_role_arn = aws_iam_role.ebs_csi.arn

  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [
    aws_eks_node_group.default,
    aws_iam_role_policy_attachment.ebs_csi
  ]
}

# =============================================================================
# CloudWatch Observability IRSA Trust Policy
# =============================================================================

data "aws_iam_policy_document" "cloudwatch_observability_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.eks.arn
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:sub"

      values = [
        "system:serviceaccount:amazon-cloudwatch:cloudwatch-agent"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

# =============================================================================
# CloudWatch Observability IAM Role
# =============================================================================

resource "aws_iam_role" "cloudwatch_observability" {
  name               = "${local.cluster_name}-cw-observability-role"
  assume_role_policy = data.aws_iam_policy_document.cloudwatch_observability_trust.json

  tags = {
    Name        = "${local.cluster_name}-cw-observability-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "cloudwatch_observability" {
  role = aws_iam_role.cloudwatch_observability.name

  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# =============================================================================
# CloudWatch Observability EKS Addon
# =============================================================================

resource "aws_eks_addon" "cloudwatch_observability" {
  cluster_name = aws_eks_cluster.this.name

  addon_name = "amazon-cloudwatch-observability"

  service_account_role_arn = aws_iam_role.cloudwatch_observability.arn

  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [
    aws_eks_node_group.default,
    aws_iam_role_policy_attachment.cloudwatch_observability
  ]
}