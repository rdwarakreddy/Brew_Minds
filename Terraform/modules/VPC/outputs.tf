# ---------------------------------------------------------------------------
# VPC MODULE - OUTPUTS
# These values are handed back to the root module so other modules
# (EKS, RDS, Edge/Security) can plug into this same network.
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (one per Availability Zone)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (one per Availability Zone)"
  value       = aws_subnet.private[*].id
}

output "availability_zones" {
  description = "Availability Zones actually used by this VPC"
  value       = var.availability_zones
}

output "public_route_table_ids" {
  description = "ID of the public route table"
  value       = [aws_route_table.public.id]
}

output "private_route_table_ids" {
  description = "IDs of the private route tables (one per Availability Zone)"
  value       = aws_route_table.private[*].id
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways (one per Availability Zone)"
  value       = aws_nat_gateway.main[*].id
}

output "alb_security_group_id" {
  description = "ID of the security group used by the Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "eks_nodes_security_group_id" {
  description = "ID of the security group used by the EKS worker nodes"
  value       = aws_security_group.eks_nodes.id
}

output "database_security_group_id" {
  description = "ID of the security group used by the RDS database"
  value       = aws_security_group.database.id
}
