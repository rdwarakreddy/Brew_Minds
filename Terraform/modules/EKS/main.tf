# ---------------------------------------------------------------------------
# EKS MODULE - MAIN
#
# In simple words: EKS is a managed Kubernetes cluster. Kubernetes is the
# system that actually runs our 13 Docker containers (one per Brew Minds
# service), restarts them if they crash, and load-balances traffic
# between copies of them. AWS manages the "control plane" (the brain of
# Kubernetes) for us; we only manage the "worker nodes" (the EC2 servers
# that do the actual work of running our containers).
#
# Note on IAM: EKS cannot function without a couple of IAM roles (one
# for the cluster control plane, one for the worker nodes). These are
# NOT a separate IAM module - they are the minimum permissions EKS
# itself requires to operate, so they live right here next to the
# cluster that uses them.
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    tls = {
      source = "hashicorp/tls"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# =========================================================================
# IAM ROLE FOR THE EKS CONTROL PLANE
# This role lets the EKS service itself (not our code) manage AWS
# resources on our behalf, e.g. attaching network interfaces.
# =========================================================================
resource "aws_iam_role" "cluster" {
  name = "${local.name_prefix}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-eks-cluster-role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

# =========================================================================
# THE EKS CLUSTER (CONTROL PLANE)
# =========================================================================
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    # The control plane needs to know about BOTH public and private
    # subnets: private ones for talking to worker nodes, public ones so
    # the managed ALB can eventually be created for internet traffic.
    subnet_ids              = concat(var.private_subnet_ids, var.public_subnet_ids)
    security_group_ids      = [var.node_security_group_id]
    endpoint_public_access  = var.endpoint_public_access
    endpoint_private_access = var.endpoint_private_access
  }

  # Turns on useful control-plane logs (who did what, scheduling
  # decisions, authentication attempts) so problems are easier to debug.
  enabled_cluster_log_types = ["api", "audit", "authenticator"]

  tags = merge(
    var.tags,
    {
      Name = var.cluster_name
    }
  )

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]
}

# =========================================================================
# IAM ROLE FOR THE WORKER NODES
# This role lets the EC2 servers that make up our cluster do the basic
# things a Kubernetes node needs to do: register with the cluster, pull
# container images from ECR, and manage networking.
# =========================================================================
resource "aws_iam_role" "node_group" {
  name = "${local.name_prefix}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-eks-node-role"
    }
  )
}

# The three AWS-managed policies every EKS worker node needs:
#  - AmazonEKSWorkerNodePolicy: lets the node register itself with the cluster
#  - AmazonEC2ContainerRegistryReadOnly: lets the node pull images from ECR
#  - AmazonEKS_CNI_Policy: lets the node manage its own pod networking
resource "aws_iam_role_policy_attachment" "node_worker_policy" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_ecr_policy" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "node_cni_policy" {
  role       = aws_iam_role.node_group.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

# =========================================================================
# THE NODE GROUP (WORKER NODES)
# This is the actual fleet of EC2 servers that run our containers. It
# lives entirely in the PRIVATE subnets, so no worker node ever gets a
# public IP. It can automatically grow/shrink between min and max nodes
# depending on load.
# =========================================================================
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${local.name_prefix}-node-group"
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = [var.node_instance_type]
  capacity_type  = "ON_DEMAND"

  #If more capacity is required, the node group can grow
  scaling_config {
    desired_size = var.node_desired_count
    min_size     = var.node_min_count
    max_size     = var.node_max_count
  }

  # Roll nodes out one at a time during updates, so the app never goes
  # fully offline while nodes are being replaced.
  update_config {
    max_unavailable = 1
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-node-group"
    }
  )

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_ecr_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
  ]

  # Kubernetes-level changes to desired_size (e.g. from a Horizontal Pod
  # Autoscaler or Cluster Autoscaler) shouldn't be fought by Terraform on
  # every apply.
  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }
}

# =========================================================================
# EBS CSI ADD-ON
# This add-on lets Kubernetes create real AWS EBS disks whenever a pod
# asks for persistent storage (a "PersistentVolumeClaim"). Without it,
# pods that need to save data to disk would have nowhere to put it.
#This Kubernetes component is allowed to perform certain EBS-related AWS operations."
# =========================================================================
resource "aws_iam_role" "ebs_csi" {
  name = "${local.name_prefix}-ebs-csi-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { #Your EKS cluster has an OIDC identity provider, it was created at aws_iam_openid_connect_provider
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-ebs-csi-role"
    }
  )
}
#This line gives the EBS driver its AWS permissions
#EBS CSI IAM Role + AmazonEBSCSIDriverPolicy = permissions needed to manage EBS storage
resource "aws_iam_role_policy_attachment" "ebs_csi_policy" {
  role       = aws_iam_role.ebs_csi.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

#Install the component that allows Kubernetes to use AWS EBS disks 
#when a Kubernetes application actually requests persistent storage
#This installs the actual EBS CSI driver
resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = aws_iam_role.ebs_csi.arn

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-ebs-csi-addon"
    }
  )

  depends_on = [aws_eks_node_group.main]
}

#IAM Role --> aws_iam_role.ebs_csi --> Here are the AWS permissions.
#EKS Add on --> aws_eks_addon.ebs_csi -->Install/manage the EBS CSI driver in my EKS cluster
#            AWS
#             │
#       IAM permissions
#             │
#             ↓
#   EBS CSI Driver
#             │
#             ↓
#        Kubernetes
#             │
#             ↓
#  PersistentVolumeClaim
#             │
#             ↓
#          EBS

# Standard EKS add-ons that handle core cluster networking - these ship
# with every cluster but managing them through Terraform keeps their
# versions consistent and up to date.
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "vpc-cni"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-vpc-cni-addon"
    }
  )
}

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "coredns"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-coredns-addon"
    }
  )

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "kube-proxy"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-kube-proxy-addon"
    }
  )
}

# =========================================================================
# OIDC PROVIDER (IAM ROLES FOR SERVICE ACCOUNTS)
# This is what allows individual Kubernetes workloads (like the EBS CSI
# driver above, or later the AWS Load Balancer Controller) to securely
# assume a specific, narrow IAM role - instead of every pod sharing the
# broad node IAM role. It's the bridge that lets Kubernetes "speak IAM".
# =========================================================================
#This gets information about the EKS cluster's identity provider certificate.
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

#This essentially tells AWS
#Trust this EKS cluster as an identity provider.
resource "aws_iam_openid_connect_provider" "eks" {
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-eks-oidc"
    }
  )
}

# =========================================================================
# IAM ROLE FOR THE AWS LOAD BALANCER CONTROLLER
# The edge-security module creates the actual Application Load Balancer
# target-group wiring, but the AWS Load Balancer Controller that runs
# INSIDE Kubernetes needs its own IAM permissions to manage ALB/NLB
# resources on our behalf. We provision only the IAM role here, wired up
# to Kubernetes via IRSA/OIDC; installing the controller itself is a
# Helm/Kubernetes step, outside the scope of this Terraform.
# =========================================================================
resource "aws_iam_role" "lb_controller" {
  name = "${local.name_prefix}-lb-controller-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-lb-controller-role"
    }
  )
}

# Grants the permissions the Load Balancer Controller needs to manage
# ALB/NLB resources on our behalf (create/inspect load balancers, target
# groups, listeners, security group rules, and read related EC2/ACM/WAF
# info). This mirrors the permission set AWS documents for the
# controller. For production hardening you can swap this for the exact,
# always-up-to-date policy published by AWS at:
# https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
resource "aws_iam_role_policy" "lb_controller" {
  name = "${local.name_prefix}-lb-controller-policy"
  role = aws_iam_role.lb_controller.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadOnlyDiscovery"
        Effect = "Allow"
        Action = [
          "ec2:DescribeAccountAttributes",
          "ec2:DescribeAddresses",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeVpcs",
          "ec2:DescribeVpcPeeringConnections",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeTags",
          "ec2:GetCoipPoolUsage",
          "ec2:DescribeCoipPools",
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeLoadBalancerAttributes",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeListenerCertificates",
          "elasticloadbalancing:DescribeSSLPolicies",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetGroupAttributes",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeTags",
          "acm:ListCertificates",
          "acm:DescribeCertificate",
          "iam:ListServerCertificates",
          "iam:GetServerCertificate",
          "waf-regional:GetWebACL",
          "wafv2:GetWebACL",
          "wafv2:GetWebACLForResource",
          "shield:GetSubscriptionState",
          "shield:DescribeProtection",
          "cognito-idp:DescribeUserPoolClient",
        ]
        Resource = "*"
      },
      {
        Sid    = "SecurityGroupManagement"
        Effect = "Allow"
        Action = [
          "ec2:CreateSecurityGroup",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:DeleteSecurityGroup",
        ]
        Resource = "*"
      },
      {
        Sid    = "LoadBalancerAndTargetGroupManagement"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:CreateLoadBalancer",
          "elasticloadbalancing:CreateTargetGroup",
          "elasticloadbalancing:CreateListener",
          "elasticloadbalancing:CreateRule",
          "elasticloadbalancing:DeleteLoadBalancer",
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:DeleteListener",
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:ModifyLoadBalancerAttributes",
          "elasticloadbalancing:ModifyTargetGroup",
          "elasticloadbalancing:ModifyTargetGroupAttributes",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyRule",
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets",
          "elasticloadbalancing:SetIpAddressType",
          "elasticloadbalancing:SetSecurityGroups",
          "elasticloadbalancing:SetSubnets",
          "elasticloadbalancing:AddTags",
          "elasticloadbalancing:RemoveTags",
          "elasticloadbalancing:AddListenerCertificates",
          "elasticloadbalancing:RemoveListenerCertificates",
          "elasticloadbalancing:SetWebAcl",
        ]
        Resource = "*"
      },
      {
        Sid      = "ServiceLinkedRoleForELB"
        Effect   = "Allow"
        Action   = "iam:CreateServiceLinkedRole"
        Resource = "*"
        Condition = {
          StringEquals = {
            "iam:AWSServiceName" = "elasticloadbalancing.amazonaws.com"
          }
        }
      },
    ]
  })
}
