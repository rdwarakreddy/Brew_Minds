# =============================================================================
# ALB Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# AWS Load Balancer Controller IAM Role ARN
# -----------------------------------------------------------------------------

output "alb_controller_iam_role_arn" {
  description = "ARN of the IAM role used by the AWS Load Balancer Controller."
  value       = aws_iam_role.alb_controller.arn
}

# -----------------------------------------------------------------------------
# Kubernetes Service Account Name
# -----------------------------------------------------------------------------

output "alb_controller_service_account_name" {
  description = "Name of the Kubernetes service account used by the AWS Load Balancer Controller."
  value       = kubernetes_service_account.alb_controller.metadata[0].name
}