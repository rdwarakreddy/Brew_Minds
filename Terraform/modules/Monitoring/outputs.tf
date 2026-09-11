output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic used for CloudWatch alerts."
  value       = aws_sns_topic.alerts.arn
}

output "sns_alerts_topic_name" {
  description = "Name of the SNS alerts topic."
  value       = aws_sns_topic.alerts.name
}

output "application_log_group_name" {
  description = "CloudWatch Log Group used for centralized application logs."
  value       = aws_cloudwatch_log_group.app_logs.name
}

output "application_log_group_arn" {
  description = "ARN of the centralized application log group."
  value       = aws_cloudwatch_log_group.app_logs.arn
}

output "infrastructure_dashboard_name" {
  description = "CloudWatch infrastructure dashboard name."
  value       = aws_cloudwatch_dashboard.infrastructure.dashboard_name
}

output "application_dashboard_name" {
  description = "CloudWatch application dashboard name."
  value       = aws_cloudwatch_dashboard.application.dashboard_name
}

output "infrastructure_dashboard_arn" {
  description = "ARN of the infrastructure CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.infrastructure.dashboard_arn
}

output "application_dashboard_arn" {
  description = "ARN of the application CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.application.dashboard_arn
}

output "rds_high_cpu_alarm_arn" {
  description = "ARN of the RDS high CPU alarm."
  value       = aws_cloudwatch_metric_alarm.rds_high_cpu.arn
}

output "rds_low_storage_alarm_arn" {
  description = "ARN of the RDS low storage alarm."
  value       = aws_cloudwatch_metric_alarm.rds_low_storage.arn
}

output "high_5xx_alarm_arn" {
  description = "ARN of the HTTP 5xx alarm."
  value       = aws_cloudwatch_metric_alarm.high_5xx_rate.arn
}

output "high_latency_alarm_arn" {
  description = "ARN of the ALB high latency alarm."
  value       = aws_cloudwatch_metric_alarm.high_latency.arn
}

output "pod_restart_alarm_arn" {
  description = "ARN of the pod restart alarm."
  value       = aws_cloudwatch_metric_alarm.pod_restart_spike.arn
}