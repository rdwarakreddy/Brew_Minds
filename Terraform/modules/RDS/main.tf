# ---------------------------------------------------------------------------
# RDS Subnet Group
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.private_db_subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-subnet-group"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# RDS Master Password
# ---------------------------------------------------------------------------

resource "random_password" "db_master" {
  length  = 32
  special = true

  # Characters not accepted by RDS PostgreSQL passwords are excluded.
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL Instance
# ---------------------------------------------------------------------------

resource "aws_db_instance" "this" {
  identifier = "${var.project_name}-${var.environment}"

  engine         = "postgres"
  engine_version = var.db_engine_version

  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type         = "gp3"

  # Encryption at rest using the AWS-managed RDS KMS key.
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master.result
  port     = 5432

  db_subnet_group_name = aws_db_subnet_group.this.name

  vpc_security_group_ids = [
    var.rds_security_group_id
  ]

  publicly_accessible = false

  # -------------------------------------------------------------------------
  # Availability / Protection
  # -------------------------------------------------------------------------

  multi_az            = var.db_multi_az
  deletion_protection = var.db_deletion_protection

  # -------------------------------------------------------------------------
  # Backups
  # -------------------------------------------------------------------------

  backup_retention_period = var.db_backup_retention_period

  # UTC: approximately 22:30-23:00 IST
  backup_window = "17:00-17:30"

  maintenance_window = "sun:18:00-sun:19:00"

  copy_tags_to_snapshot = true

  skip_final_snapshot = false

  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-${formatdate(
    "YYYYMMDD-hhmmss",
    timestamp()
  )}"

  # -------------------------------------------------------------------------
  # Enhanced Monitoring
  # -------------------------------------------------------------------------

  monitoring_interval = 60
  monitoring_role_arn  = aws_iam_role.rds_monitoring.arn

  # -------------------------------------------------------------------------
  # Performance Insights
  # -------------------------------------------------------------------------

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Password is intentionally ignored after initial creation.
  # Secret management will be handled separately.
  lifecycle {
    ignore_changes = [
      password
    ]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# RDS Enhanced Monitoring IAM Role
# ---------------------------------------------------------------------------

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-monitoring-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}