variable "project_name" {
  type        = string
  description = "Name of the project."
}

variable "environment" {
  type        = string
  description = "Deployment environment."
}

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster, used for IAM role naming."
}

variable "eks_oidc_provider_arn" {
  type        = string
  description = "ARN of the EKS cluster's OIDC identity provider (module.eks.oidc_provider_arn)."
}

variable "eks_oidc_issuer_url" {
  type        = string
  description = "OIDC issuer URL of the EKS cluster (module.eks.oidc_issuer_url)."
}

variable "application_secret_arns" {
  type        = list(string)
  description = "ARNs of Secrets Manager secrets the application ServiceAccount is allowed to read."
  default     = []
}

variable "kubernetes_namespace" {
  type        = string
  description = "Kubernetes namespace the application runs in (must match the namespace used in the ServiceAccount trust condition)."
  default     = "brew-minds"
}

variable "kubernetes_service_account" {
  type        = string
  description = "Name of the Kubernetes ServiceAccount that is allowed to assume this role."
  default     = "brew-minds-app"
}
