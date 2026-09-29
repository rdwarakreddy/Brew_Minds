# ---------------------------------------------------------------------------
# CICD MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "github_actions_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes via OIDC. Put this in the GitHub repository variable AWS_OIDC_ROLE_ARN."
  value       = aws_iam_role.github_actions.arn
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC identity provider actually in use (whether newly created or the existing one you passed in)"
  value       = local.oidc_provider_arn
}
