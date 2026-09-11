# =============================================================================
# EKS Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# EKS Cluster
# -----------------------------------------------------------------------------

output "cluster_name" {
  description = "Name of the EKS cluster."
  value       = aws_eks_cluster.this.name
}

output "cluster_arn" {
  description = "ARN of the EKS cluster."
  value       = aws_eks_cluster.this.arn
}

output "cluster_endpoint" {
  description = "Endpoint of the EKS Kubernetes API server."
  value       = aws_eks_cluster.this.endpoint
}

# NOTE: added — the root providers.tf needs this (plus the cluster name and
# an aws_eks_cluster_auth token) to configure the kubernetes/helm providers
# that point at the newly created cluster. It was missing from the original
# module, so there was no way to configure those providers at all.
output "cluster_ca_certificate" {
  description = "Base64-encoded certificate authority data for the EKS cluster, used to configure the kubernetes/helm providers."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "cluster_version" {
  description = "Kubernetes version of the EKS cluster."
  value       = aws_eks_cluster.this.version
}

# -----------------------------------------------------------------------------
# EKS OIDC
# -----------------------------------------------------------------------------

output "oidc_provider_arn" {
  description = "ARN of the EKS OIDC provider used for IRSA."
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL of the EKS cluster."
  value       = aws_iam_openid_connect_provider.eks.url
}

# -----------------------------------------------------------------------------
# Node Group
# -----------------------------------------------------------------------------

output "node_group_name" {
  description = "Name of the default EKS managed node group."
  value       = aws_eks_node_group.default.node_group_name
}

# -----------------------------------------------------------------------------
# EBS CSI
# -----------------------------------------------------------------------------

output "ebs_csi_role_arn" {
  description = "IAM role ARN used by the EBS CSI driver."
  value       = aws_iam_role.ebs_csi.arn
}

# -----------------------------------------------------------------------------
# CloudWatch Observability
# -----------------------------------------------------------------------------

output "cloudwatch_observability_role_arn" {
  description = "IAM role ARN used by the CloudWatch Observability addon."
  value       = aws_iam_role.cloudwatch_observability.arn
}

# -----------------------------------------------------------------------------
# EKS Cluster Logs
# -----------------------------------------------------------------------------

output "cluster_log_group_name" {
  description = "CloudWatch log group containing EKS control-plane logs."
  value       = aws_cloudwatch_log_group.eks_cluster.name
}