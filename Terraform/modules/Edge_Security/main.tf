# ---------------------------------------------------------------------------
# EDGE-SECURITY MODULE - MAIN
#
# In simple words: this module builds the "front door" of Brew Minds -
# the path a real user's browser request takes before it ever reaches
# our backend. The order matches how traffic actually flows:
#
#   Internet -> CloudFront (speeds things up, gives HTTPS for free)
#            -> WAF        (blocks obviously malicious requests)
#            -> ALB        (splits/forwards traffic inside our VPC)
#            -> EKS        (where the actual Brew Minds services run)
#
# We deliberately do NOT set up a custom domain or SSL certificate here -
# CloudFront already gives us a free, working HTTPS endpoint on an
# *.cloudfront.net address, which is enough for this project.
#
# This module needs a SECOND AWS provider pointed at us-east-1, because
# AWS requires that any WAF Web ACL attached to a CloudFront distribution
# be created in us-east-1, no matter which region everything else runs
# in. The root module passes that provider in.
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# =========================================================================
# APPLICATION LOAD BALANCER
# The ALB is the traffic cop INSIDE our VPC. It sits in the public
# subnets (so it can receive traffic) and forwards requests to whichever
# backend pods are healthy and ready inside the private EKS nodes.
# =========================================================================
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false # This ALB can receive traffic from outside the VPC.
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id] #Use the security group that my Security Groups module already created
  subnets            = var.public_subnet_ids

  # Deletes any half-open connections quickly instead of letting them hang,
  # which makes deployments/rollouts feel snappier
  idle_timeout = 60

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-alb"
    }
  )
}

# -----------------------------------------------------------------------
# TARGET GROUP
# This is an empty "bucket" of backend targets. We create it here with
# target_type = "ip" because that is what's needed for EKS pods
# (each pod gets its own IP). We deliberately do NOT register any real
# targets from Terraform - that would mean hard-coding fake IPs before
# any pod exists. Instead, once the cluster is up, the AWS Load Balancer
# Controller running inside Kubernetes (using the IAM role created in the
# EKS module) automatically registers/deregisters real pod IPs into this
# target group as pods come and go. This keeps the dependency between
# Terraform and Kubernetes clean and honest.
# -----------------------------------------------------------------------
#The target group represents the destinations where the ALB can send traffic.
resource "aws_lb_target_group" "app" {
  name        = "${local.name_prefix}-tg"
  port        = var.target_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" #the ALB can send traffic directly toward the pod IPs.

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = merge(
    var.tags,
    {
      Name    = "${local.name_prefix}-tg"
      Cluster = var.eks_cluster_name
    }
  )
}

# -----------------------------------------------------------------------
# LISTENER
# Tells the ALB: "when a request arrives on port 80, send it to the
# target group above." A normal AWS endpoint (no custom domain/ACM) only
# needs plain HTTP here - CloudFront in front of it is what provides
# HTTPS to the end user.
# -----------------------------------------------------------------------
#Think of the listener as the ALB's reception desk.
# The ALB exists, but it needs instructions like:
# When someone arrives on port 80, what should I do?
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action { #When a request arrives, forward it to the application target group
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# =========================================================================
# WAF WEB ACL - Web Application Firewall.
# WAF acts like a bouncer checking every request before it's allowed
# through. We turn on two protections:
#   1. AWS's own "Common Rule Set" - blocks well-known attack patterns
#      (SQL injection, bad bots, etc.) without us having to write rules
#      ourselves.
#   2. A rate limit - if one visitor sends too many requests too fast,
#      they get temporarily blocked, protecting us from basic abuse.
# Scope = CLOUDFRONT because this Web ACL protects the CloudFront
# distribution, which is why it must live in the us-east-1 provider.
# =========================================================================
resource "aws_wafv2_web_acl" "main" {
  provider = aws.us_east_1 #this is because CloudFront WAF has to be created in:

  name        = "${local.name_prefix}-waf"
  description = "WAF Web ACL protecting the Brew Minds CloudFront distribution"
  scope       = "CLOUDFRONT" #This WAF is going to protect a CloudFront distribution

  default_action { #Normally allow requests unless one of my rules says to block them
    allow {}
  }
  #AWS already maintains a collection of common web attack patterns, 
  #so instead of you manually writing every rule, 
  #you tell AWS to use its maintained rule collection.
  rule {
    name     = "aws-common-rule-set"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit"
    priority = 2

    action {
      block {}
    }
    #Keep track of how many requests are coming from each IP address, 
    #and if an IP crosses the configured limit, block it.
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-waf"
    }
  )
}

# =========================================================================
# CLOUDFRONT DISTRIBUTION
# CloudFront is a global content delivery network (CDN). Every visitor,
# no matter where they are in the world, connects to a nearby CloudFront
# edge location, which then talks back to our single ALB. Benefits:
#   - Free HTTPS on a *.cloudfront.net address (no ACM/domain needed)
#   - Faster loading for static frontend assets
#   - One more layer between the public internet and our real servers
# =========================================================================
resource "aws_cloudfront_distribution" "main" {
  enabled      = true #Turn CloudFront on
  comment      = "${local.name_prefix} CloudFront distribution"
  price_class  = var.cloudfront_price_class
  web_acl_id   = aws_wafv2_web_acl.main.arn #So when a request reaches CloudFront, the WAF rules can inspect it.
  http_version = "http2"

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "${local.name_prefix}-alb-origin" #Where should CloudFront get the actual content from?

    custom_origin_config {
      # The ALB only listens on plain HTTP (no ACM certificate attached,
      # per this project's scope), so CloudFront must talk to it over
      # HTTP. CloudFront still serves HTTPS to the actual end users.
      origin_protocol_policy = "http-only"
      http_port              = 80
      https_port             = 443
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "${local.name_prefix}-alb-origin" #This tells CloudFront: "Send these requests to the ALB origin we defined above."
    viewer_protocol_policy = "redirect-to-https"

    # Our backend is a dynamic API + SPA frontend, not static files that
    # should be cached at the edge, so caching is kept minimal/disabled
    # and every request is forwarded straight through to the ALB.
    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }
    #Don't keep these application responses around as a normal cache."
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # No custom domain/ACM certificate for this project, so we use the
    # default certificate CloudFront provides for its own *.cloudfront.net
    # domain. This still gives every visitor a valid HTTPS connection.
    cloudfront_default_certificate = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-cloudfront"
    }
  )
}
