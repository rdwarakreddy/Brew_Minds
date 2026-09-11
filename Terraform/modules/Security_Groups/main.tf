# ---------------------------------------------------------------------------
# Application Load Balancer Security Group
# ---------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Allows inbound HTTP/HTTPS from the internet to the ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  egress {
    description = "ALB can reach EKS nodes and required backend targets"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-alb-sg"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# EKS Worker Node Security Group
# ---------------------------------------------------------------------------

resource "aws_security_group" "eks_nodes" {
  name        = "${var.project_name}-${var.environment}-eks-nodes-sg"
  description = "Traffic allowed to and from EKS worker nodes"
  vpc_id      = var.vpc_id

  # ALB -> EKS worker nodes
  ingress {
    description = "Traffic from the ALB to EKS worker nodes"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"

    security_groups = [
      aws_security_group.alb.id
    ]
  }

  # Node -> Node
  ingress {
    description = "Node-to-node traffic within the EKS worker node security group"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"

    self = true
  }

  # Outbound traffic
  egress {
    description = "EKS nodes can reach NAT Gateway, RDS and AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-eks-nodes-sg"

    "kubernetes.io/cluster/${var.cluster_name}" = "owned"

    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL Security Group
# ---------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Allows PostgreSQL traffic only from EKS worker nodes"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from EKS worker nodes only"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"

    security_groups = [
      aws_security_group.eks_nodes.id
    ]
  }

  egress {
    description = "RDS outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-sg"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}