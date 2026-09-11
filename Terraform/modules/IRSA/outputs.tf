output "app_irsa_role_arn" {
  description = "ARN of the IAM role used by the Brew Minds application ServiceAccount. Put this in the ServiceAccount's eks.amazonaws.com/role-arn annotation in kubernetes/secrets.yml or the backend ServiceAccount manifest."
  value       = aws_iam_role.app_irsa.arn
}

output "app_irsa_role_name" {
  description = "Name of the application IRSA role."
  value       = aws_iam_role.app_irsa.name
}
