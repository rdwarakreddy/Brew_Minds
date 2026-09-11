# =============================================================================
# VPC Module Outputs
# =============================================================================
# NOTE: This file was missing from the original module, which is one of the
# "dependency errors" — every downstream module (Security Groups, EKS, RDS)
# references module.vpc.* attributes, so without these declared outputs
# `terraform validate` fails with "Unsupported attribute" errors.
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}

# -----------------------------------------------------------------------------
# Public Subnets
# -----------------------------------------------------------------------------

output "public_subnet_ids" {
  description = "IDs of the public subnets (used for the ALB)."
  value       = aws_subnet.public[*].id
}

# -----------------------------------------------------------------------------
# Private Application Subnets
# -----------------------------------------------------------------------------

output "private_app_subnet_ids" {
  description = "IDs of the private application subnets (used for EKS worker nodes)."
  value       = aws_subnet.private_app[*].id
}

# -----------------------------------------------------------------------------
# Private Database Subnets
# -----------------------------------------------------------------------------

output "private_db_subnet_ids" {
  description = "IDs of the private database subnets (used for the RDS subnet group)."
  value       = aws_subnet.private_db[*].id
}

# -----------------------------------------------------------------------------
# Routing / NAT
# -----------------------------------------------------------------------------

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateway(s)."
  value       = aws_nat_gateway.this[*].id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway."
  value       = aws_internet_gateway.this.id
}

output "public_route_table_id" {
  description = "ID of the public route table."
  value       = aws_route_table.public.id
}

output "private_app_route_table_ids" {
  description = "IDs of the private application route table(s)."
  value       = aws_route_table.private_app[*].id
}

output "private_db_route_table_id" {
  description = "ID of the private database route table."
  value       = aws_route_table.private_db.id
}
