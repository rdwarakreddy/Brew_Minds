terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.1"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.38"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }

    # NOTE: added. The ALB module uses `data "http"` to fetch the AWS Load
    # Balancer Controller IAM policy JSON from GitHub, but the provider was
    # never declared here — `terraform init` would fail to find a provider
    # for it.
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# =============================================================================
# Kubernetes / Helm Providers
# =============================================================================
# NOTE: added. The original providers.tf declared the kubernetes/helm
# provider *plugins* in required_providers but never configured them, even
# though the EKS module creates a kubernetes_config_map_v1_data resource and
# the ALB module creates a kubernetes_service_account resource. Without a
# `provider "kubernetes" {}` block pointing at the new cluster, those
# resources have nothing to talk to and `terraform validate`/`plan` fails.
#
# Both providers authenticate using a short-lived token fetched via the AWS
# CLI (`aws eks get-token`) at apply time. This avoids storing a static
# token in state and matches how `kubectl` itself authenticates to EKS.
#
# CAVEAT (documented in README "Challenges" section): because these
# providers are configured from module.eks's own outputs, the EKS cluster
# must exist before Terraform can plan the kubernetes_*/helm_* resources
# that depend on it. On a from-scratch deployment, run
# `terraform apply -target=module.eks` first, then a normal
# `terraform apply` for everything else. This is a well-known limitation of
# provisioning a Kubernetes cluster and deploying into it in the same
# Terraform root module.
# =============================================================================

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name,
      "--region",
      var.aws_region
    ]
  }
}

provider "helm" {
  kubernetes = {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name,
        "--region",
        var.aws_region
      ]
    }
  }
}