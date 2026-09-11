locals {
  monitoring_namespace = "${var.project_name}/${var.environment}"
}

# ---------------------------------------------------------------------------
# SNS Topic
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-alerts"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Centralized Application Logs
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/${var.project_name}/${var.environment}/application"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name        = "/${var.project_name}/${var.environment}/application"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Application Log Metric Filters
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_metric_filter" "http_5xx" {
  name           = "${var.project_name}-${var.environment}-http-5xx"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "{ $.status >= 500 }"

  metric_transformation {
    name          = "HTTP5xxCount"
    namespace     = local.monitoring_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "http_4xx" {
  name           = "${var.project_name}-${var.environment}-http-4xx"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "{ $.status >= 400 && $.status < 500 }"

  metric_transformation {
    name          = "HTTP4xxCount"
    namespace     = local.monitoring_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "request_latency" {
  name           = "${var.project_name}-${var.environment}-request-latency"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "{ $.duration_ms = * }"

  metric_transformation {
    name          = "RequestDurationMs"
    namespace     = local.monitoring_namespace
    value         = "$.duration_ms"
    default_value = "0"
  }
}

# ---------------------------------------------------------------------------
# Dashboard 1 -- Infrastructure
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "infrastructure" {
  dashboard_name = "${var.project_name}-${var.environment}-infrastructure"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          title = "EKS Node CPU Utilization"

          metrics = [
            [
              "ContainerInsights",
              "node_cpu_utilization",
              "ClusterName",
              var.cluster_name
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          title = "EKS Node Memory Utilization"

          metrics = [
            [
              "ContainerInsights",
              "node_memory_utilization",
              "ClusterName",
              var.cluster_name
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6

        properties = {
          title = "Pod Count"

          metrics = [
            [
              "ContainerInsights",
              "cluster_number_of_running_pods",
              "ClusterName",
              var.cluster_name
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6

        properties = {
          title = "Pod Restarts"

          metrics = [
            [
              "ContainerInsights",
              "pod_number_of_container_restarts",
              "ClusterName",
              var.cluster_name
            ]
          ]

          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6

        properties = {
          title = "Node Network In/Out"

          metrics = [
            [
              "ContainerInsights",
              "node_network_total_bytes",
              "ClusterName",
              var.cluster_name
            ]
          ]

          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6

        properties = {
          title = "RDS CPU Utilization"

          metrics = [
            [
              "AWS/RDS",
              "CPUUtilization",
              "DBInstanceIdentifier",
              var.rds_instance_identifier
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6

        properties = {
          title = "RDS Connections"

          metrics = [
            [
              "AWS/RDS",
              "DatabaseConnections",
              "DBInstanceIdentifier",
              var.rds_instance_identifier
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6

        properties = {
          title = "RDS Free Storage Space"

          metrics = [
            [
              "AWS/RDS",
              "FreeStorageSpace",
              "DBInstanceIdentifier",
              var.rds_instance_identifier
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# Dashboard 2 -- Application
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = "${var.project_name}-${var.environment}-application"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          title = "HTTP 4xx Count"

          metrics = [
            [
              local.monitoring_namespace,
              "HTTP4xxCount"
            ]
          ]

          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          title = "HTTP 5xx Count"

          metrics = [
            [
              local.monitoring_namespace,
              "HTTP5xxCount"
            ]
          ]

          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          title = "Request Latency (p50 / p90 / p99)"

          metrics = [
            [
              local.monitoring_namespace,
              "RequestDurationMs",
              {
                stat  = "p50"
                label = "p50"
              }
            ],
            [
              local.monitoring_namespace,
              "RequestDurationMs",
              {
                stat  = "p90"
                label = "p90"
              }
            ],
            [
              local.monitoring_namespace,
              "RequestDurationMs",
              {
                stat  = "p99"
                label = "p99"
              }
            ]
          ]

          period = 300
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          title = "ALB Request Count"

          metrics = [
            [
              "AWS/ApplicationELB",
              "RequestCount",
              "LoadBalancer",
              var.alb_name
            ]
          ]

          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          title = "ALB Target Response Time"

          metrics = [
            [
              "AWS/ApplicationELB",
              "TargetResponseTime",
              "LoadBalancer",
              var.alb_name
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },

      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          title = "RDS Read/Write Latency"

          metrics = [
            [
              "AWS/RDS",
              "ReadLatency",
              "DBInstanceIdentifier",
              var.rds_instance_identifier
            ],
            [
              "AWS/RDS",
              "WriteLatency",
              "DBInstanceIdentifier",
              var.rds_instance_identifier
            ]
          ]

          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# CloudWatch Alarms
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name = "${var.project_name}-${var.environment}-rds-high-cpu"

  namespace   = "AWS/RDS"
  metric_name = "CPUUtilization"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"

  alarm_description = "RDS sustained CPU > 80% for 15 minutes."

  alarm_actions = [
    aws_sns_topic.alerts.arn
  ]

  ok_actions = [
    aws_sns_topic.alerts.arn
  ]
}

resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name = "${var.project_name}-${var.environment}-rds-low-storage"

  namespace   = "AWS/RDS"
  metric_name = "FreeStorageSpace"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2147483648
  comparison_operator = "LessThanThreshold"

  alarm_description = "RDS free storage below 2GB."

  alarm_actions = [
    aws_sns_topic.alerts.arn
  ]
}

resource "aws_cloudwatch_metric_alarm" "high_5xx_rate" {
  alarm_name = "${var.project_name}-${var.environment}-high-5xx-rate"

  namespace   = local.monitoring_namespace
  metric_name = "HTTP5xxCount"

  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 20
  comparison_operator = "GreaterThanThreshold"

  treat_missing_data = "notBreaching"

  alarm_description = "More than 20 HTTP 5xx errors in a 5-minute window for 10 minutes."

  alarm_actions = [
    aws_sns_topic.alerts.arn
  ]
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name = "${var.project_name}-${var.environment}-high-latency"

  namespace   = "AWS/ApplicationELB"
  metric_name = "TargetResponseTime"

  dimensions = {
    LoadBalancer = var.alb_name
  }

  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 2
  comparison_operator = "GreaterThanThreshold"

  alarm_description = "Average ALB target response time above 2 seconds for 15 minutes."

  alarm_actions = [
    aws_sns_topic.alerts.arn
  ]
}

resource "aws_cloudwatch_metric_alarm" "pod_restart_spike" {
  alarm_name = "${var.project_name}-${var.environment}-pod-restart-spike"

  namespace   = "ContainerInsights"
  metric_name = "pod_number_of_container_restarts"

  dimensions = {
    ClusterName = var.cluster_name
  }

  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"

  treat_missing_data = "notBreaching"

  alarm_description = "More than 5 container restarts across the cluster in 15 minutes."

  alarm_actions = [
    aws_sns_topic.alerts.arn
  ]
}