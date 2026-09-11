output "alb_security_group_id" {
  description = "Security group ID for the Application Load Balancer."
  value       = aws_security_group.alb.id
}

output "alb_security_group_arn" {
  description = "ARN of the Application Load Balancer security group."
  value       = aws_security_group.alb.arn
}

output "alb_security_group_name" {
  description = "Name of the Application Load Balancer security group."
  value       = aws_security_group.alb.name
}

output "eks_nodes_security_group_id" {
  description = "Security group ID for EKS worker nodes."
  value       = aws_security_group.eks_nodes.id
}

output "eks_nodes_security_group_arn" {
  description = "ARN of the EKS worker node security group."
  value       = aws_security_group.eks_nodes.arn
}

output "eks_nodes_security_group_name" {
  description = "Name of the EKS worker node security group."
  value       = aws_security_group.eks_nodes.name
}

output "rds_security_group_id" {
  description = "Security group ID for the RDS PostgreSQL instance."
  value       = aws_security_group.rds.id
}

output "rds_security_group_arn" {
  description = "ARN of the RDS PostgreSQL security group."
  value       = aws_security_group.rds.arn
}

output "rds_security_group_name" {
  description = "Name of the RDS PostgreSQL security group."
  value       = aws_security_group.rds.name
}