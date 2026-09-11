# =============================================================================
# IAM Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# EKS Cluster Role
# -----------------------------------------------------------------------------

output "eks_cluster_role_arn" {
  description = "ARN of the IAM role used by the EKS control plane."
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_cluster_role_name" {
  description = "Name of the EKS cluster IAM role."
  value       = aws_iam_role.eks_cluster.name
}

# -----------------------------------------------------------------------------
# EKS Node Role
# -----------------------------------------------------------------------------

output "eks_node_role_arn" {
  description = "ARN of the IAM role used by EKS worker nodes."
  value       = aws_iam_role.eks_nodes.arn
}

output "eks_node_role_name" {
  description = "Name of the EKS worker node IAM role."
  value       = aws_iam_role.eks_nodes.name
}

# -----------------------------------------------------------------------------
# Policy Attachments
# -----------------------------------------------------------------------------
# NOTE: the original file referenced resource names
# (eks_worker_node_policy, eks_cni_policy, eks_ecr_read_only,
# eks_cloudwatch_agent) that do not exist anywhere in main.tf — the actual
# resources are named eks_nodes_worker / eks_nodes_cni / eks_nodes_ecr /
# eks_nodes_cloudwatch. That mismatch is one of the "dependency errors":
# `terraform validate` fails with "Reference to undeclared resource".
# -----------------------------------------------------------------------------

output "eks_cluster_role_policy_attachments" {
  description = "IAM policies attached to the EKS cluster role."
  value = [
    aws_iam_role_policy_attachment.eks_cluster_policy.policy_arn
  ]
}

output "eks_node_role_policy_attachments" {
  description = "IAM policies attached to the EKS node role."
  value = [
    aws_iam_role_policy_attachment.eks_nodes_worker.policy_arn,
    aws_iam_role_policy_attachment.eks_nodes_cni.policy_arn,
    aws_iam_role_policy_attachment.eks_nodes_ecr.policy_arn,
    aws_iam_role_policy_attachment.eks_nodes_cloudwatch.policy_arn
  ]
}

# -----------------------------------------------------------------------------
# GitHub Actions
# -----------------------------------------------------------------------------

output "github_actions_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions."
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider."
  value       = aws_iam_openid_connect_provider.github.arn
}
