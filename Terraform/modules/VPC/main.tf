# ---------------------------------------------------------------------------
# VPC MODULE - MAIN
#
# In simple words: this module builds the "land" that everything else in
# Brew Minds will sit on. Think of the VPC as a private, fenced piece of
# network space inside AWS. Inside that fence we dig two kinds of plots:
#   - Public subnets  -> things that talk to the internet directly (ALB, NAT)
#   - Private subnets -> things that should stay hidden (EKS nodes, RDS)
# We repeat this pattern in 2 Availability Zones (basically 2 different
# physical data centers) so that if one goes down, the app keeps running.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------
# THE VPC ITSELF
# This is the big fenced network. Every other resource below lives inside it.
# -----------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true # lets resources inside the VPC resolve DNS names
  enable_dns_hostnames = true # gives instances inside the VPC friendly DNS names

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-vpc"
    }
  )
}

# -----------------------------------------------------------------------
# INTERNET GATEWAY
# This is the "front door" of the VPC. Without it, nothing inside the VPC,
# not even the public subnets, could reach the internet.
# -----------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-igw"
    }
  )
}

# -----------------------------------------------------------------------
# PUBLIC SUBNETS
# One public subnet per Availability Zone. Public-facing things like the
# Application Load Balancer and the NAT Gateway live here, because they
# need a direct path to the internet.
# -----------------------------------------------------------------------
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true # instances here automatically get a public IP

  tags = merge(
    var.tags,
    {
      Name                     = "${local.name_prefix}-public-${var.availability_zones[count.index]}"
      Tier                     = "public"
      "kubernetes.io/role/elb" = "1" # tells the AWS Load Balancer Controller this subnet can host a public ALB
    }
  )
}

# -----------------------------------------------------------------------
# PRIVATE SUBNETS
# One private subnet per Availability Zone. Nothing here gets a public IP.
# This is where EKS worker nodes and the RDS database live, kept away from
# direct internet access for security.
# -----------------------------------------------------------------------
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    var.tags,
    {
      Name                              = "${local.name_prefix}-private-${var.availability_zones[count.index]}"
      Tier                              = "private"
      "kubernetes.io/role/internal-elb" = "1" # tells the AWS Load Balancer Controller this subnet can host an internal ALB
    }
  )
}

# -----------------------------------------------------------------------
# ELASTIC IPs FOR NAT GATEWAYS
# A NAT Gateway needs a fixed public IP address to work. We create one
# Elastic IP per Availability Zone, one for each NAT Gateway.
# -----------------------------------------------------------------------
resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-nat-eip-${var.availability_zones[count.index]}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------
# NAT GATEWAYS
# A NAT Gateway lets resources in the PRIVATE subnets (like EKS nodes)
# reach out to the internet (for example, to pull a package or call an
# external API) WITHOUT allowing the internet to reach back in to them.
# One NAT Gateway per Availability Zone, placed in the public subnet.
# -----------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-nat-${var.availability_zones[count.index]}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------
# PUBLIC ROUTE TABLE
# A route table is basically a "signpost" telling traffic where to go.
# The public route table says: "any traffic going outside the VPC should
# leave through the Internet Gateway." One shared table for all public
# subnets is enough since they all behave the same way.
# -----------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-public-rt"
    }
  )
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------
# PRIVATE ROUTE TABLES
# Each private subnet gets its OWN route table, pointing to the NAT
# Gateway that lives in the SAME Availability Zone. This keeps traffic
# inside its own AZ as much as possible and avoids extra cross-AZ cost.
# -----------------------------------------------------------------------
resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-private-rt-${var.availability_zones[count.index]}"
    }
  )
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# -----------------------------------------------------------------------
# SECURITY GROUP: ALB
# A security group is like a mini firewall attached to a resource.
# This one is for the Application Load Balancer: it accepts normal web
# traffic (80/443) from anywhere, and is allowed to send traffic onward
# to anything (so it can forward requests to EKS).
# -----------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow HTTP from the internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow the ALB to reach anything it needs to (e.g. EKS nodes)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-alb-sg"
    }
  )
  #This tells terraform If you need to replace this resource, 
  #create the new one first, and only then destroy the old one
  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------
# SECURITY GROUP: EKS NODES
# This is the firewall for the backend servers (EKS worker nodes). They
# only accept traffic that is coming from the ALB, not from the open
# internet, and they can freely reach out (for pulling images, calling
# RDS, etc).
# -----------------------------------------------------------------------
resource "aws_security_group" "eks_nodes" {
  name        = "${local.name_prefix}-eks-nodes-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow traffic from the ALB only"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "Allow the worker nodes to talk to each other and to the EKS control plane"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    description = "Allow nodes to reach the internet (via NAT) and AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-eks-nodes-sg"
      # This tag lets the EKS control plane recognize and manage this security group
      "kubernetes.io/cluster/${local.name_prefix}-eks" = "owned"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------
# SECURITY GROUP: DATABASE
# The database should only ever be reachable from inside our own network,
# and only on the Postgres port (5432), and only from the EKS nodes that
# actually need it. Nothing from the internet can reach it.
# -----------------------------------------------------------------------
resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-database-sg"
  description = "Security group for the RDS PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow Postgres traffic only from the EKS worker nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    description = "Allow the database to respond back to whoever queried it"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-database-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------
# NETWORK ACLs (an extra layer of security, on top of security groups)
# A Security Group protects a single resource. A Network ACL protects an
# entire subnet. Think of it as a second, subnet-wide checkpoint. Here we
# keep it simple and open within the VPC, matching typical default
# behaviour, while still explicitly documenting it as required
# infrastructure.
# -----------------------------------------------------------------------
resource "aws_network_acl" "public" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.public[*].id

  # Allow all inbound traffic (the Security Groups above do the real filtering)
  ingress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  # Allow all outbound traffic
  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-public-nacl"
    }
  )
}

resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  # Allow all traffic that originates from inside our own VPC
  ingress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
  }

  # Allow return traffic coming back from the internet (e.g. NAT responses)
  ingress {
    protocol   = "-1"
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }

  # Allow all outbound traffic (nodes need to reach NAT, ECR, RDS, etc.)
  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-private-nacl"
    }
  )
}
