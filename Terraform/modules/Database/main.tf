# ---------------------------------------------------------------------------
# DATABASE MODULE - MAIN
#
# In simple words: this sets up a managed PostgreSQL database using
# Amazon RDS. "Managed" means AWS takes care of backups, patching and
# storage for us. The database is placed deep inside the private
# subnets, so it can never be reached directly from the internet - only
# our own backend services, running inside the same VPC, can connect.
# ---------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------
# DB SUBNET GROUP
# RDS needs to know WHICH subnets it is allowed to place the database
# (and its standby copy, if Multi-AZ is on) into. We give it only the
# private subnets, so the database is never placed somewhere public.
#An RDS DB subnet group tells Amazon RDS
#These are the subnets where you are allowed to place the database resources.
# -----------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-db-subnet-group"
    }
  )
}

# -----------------------------------------------------------------------
# PARAMETER GROUP
# This is a small set of database engine settings. We only override the
# ones that genuinely matter for this project (turning on slow-query
# style logging is common), everything else keeps the safe AWS default.
# -----------------------------------------------------------------------
resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-postgres-params"
  family = "postgres16"

  #If a SQL statement takes 1 second or longer, log information about that statement.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log any query that takes longer than 1 second, useful for debugging
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-postgres-params"
    }
  )
}

# -----------------------------------------------------------------------
# THE DATABASE INSTANCE
# -----------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"

  # --- Engine ---
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # --- Storage ---
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true # encrypts the data sitting on disk

  # --- Database identity ---
  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  port     = 5432

  # --- Networking: this is what keeps the database PRIVATE ---
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  # --- High availability ---
  multi_az = var.multi_az

  # --- Backups ---
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00" # low-traffic hours, backup happens automatically
  maintenance_window      = "mon:04:30-mon:05:30"

  # --- Safety switches ---
  deletion_protection       = var.environment == "prod" ? true : false
  skip_final_snapshot       = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-db-final-snapshot" : null

  parameter_group_name = aws_db_parameter_group.main.name

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-db"
    }
  )
}
