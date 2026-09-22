# ---------------------------------------------------------------------------
# EKS MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "API endpoint of the EKS cluster, used by kubectl/Helm to talk to it"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the cluster, needed to configure kubectl"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_security_group_id" {
  description = "Security group ID automatically created and managed by EKS for cluster communication"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "node_group_name" {
  description = "Name of the EKS node group"
  value       = aws_eks_node_group.main.node_group_name
}

output "node_group_arn" {
  description = "ARN of the EKS node group"
  value       = aws_eks_node_group.main.arn
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC provider, required to set up IAM Roles for Service Accounts (IRSA)"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL of the cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_iam_role_arn" {
  description = "ARN of the IAM role used by the EKS control plane"
  value       = aws_iam_role.cluster.arn
}

output "node_iam_role_arn" {
  description = "ARN of the IAM role used by the worker nodes"
  value       = aws_iam_role.node_group.arn
}

output "lb_controller_role_arn" {
  description = "ARN of the IAM role for the AWS Load Balancer Controller (for use when installing it via Helm)"
  value       = aws_iam_role.lb_controller.arn
}
