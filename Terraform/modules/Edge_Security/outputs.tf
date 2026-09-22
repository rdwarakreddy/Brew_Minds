# ---------------------------------------------------------------------------
# EDGE-SECURITY MODULE - OUTPUTS
# ---------------------------------------------------------------------------

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID of the ALB (used if a Route 53 alias record is ever added later)"
  value       = aws_lb.main.zone_id
}

output "alb_target_group_arn" {
  description = "ARN of the target group backend pods register into (via the AWS Load Balancer Controller)"
  value       = aws_lb_target_group.app.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "Public *.cloudfront.net domain name - this is the main URL used to access Brew Minds"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL protecting the CloudFront distribution"
  value       = aws_wafv2_web_acl.main.arn
}
