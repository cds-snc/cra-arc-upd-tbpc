resource "aws_wafv2_ip_set" "cra_upd_waf_ip_set" {
  name               = "cra-upd-waf-ip-set"
  description        = "CRA UPD IP address allow list"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.cloudfront_waf_allowed_ips

  provider = aws.us-east-1
}

resource "aws_wafv2_web_acl" "cra_upd_waf_acl" {
  name        = "cra-upd-cloudfront-waf-acl"
  description = "Block access from IPs not on the allowlist"
  scope       = "CLOUDFRONT"

  default_action {
    block {}
  }

  rule {
    name     = "AllowIpsFromAllowlist"
    priority = 1

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.cra_upd_waf_ip_set.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "cra-upd-waf-cloudfront-allow-ips"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "cra-upd-waf-cloudfront-block-traffic"
    sampled_requests_enabled   = true
  }

  provider = aws.us-east-1
}