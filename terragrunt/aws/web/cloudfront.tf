locals {
  cloudfront_web_origin_id = "upd_web"
  cloudfront_api_origin_id = "upd_api"
}

resource "aws_cloudfront_origin_access_identity" "origin_access_identity" {
  comment = "Cloudfront origin access identity"
}

data "aws_iam_policy_document" "cra_upd_web_bucket_policy_doc" {
  statement {
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.origin_access_identity.iam_arn]
    }
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "${var.web_bucket_arn}/*"
    ]
  }
}

resource "aws_s3_bucket_policy" "cra_upd_web_bucket_policy" {
  bucket = var.web_bucket_id
  policy = data.aws_iam_policy_document.cra_upd_web_bucket_policy_doc.json
}

resource "aws_cloudfront_distribution" "cra_upd_cf_distribution" {
  enabled             = true
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  web_acl_id          = aws_wafv2_web_acl.cra_upd_waf_acl.arn

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  origin {
    domain_name = var.web_bucket_domain
    origin_id   = local.cloudfront_web_origin_id
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.origin_access_identity.cloudfront_access_identity_path
    }
  }

  origin {
    domain_name = var.apigw_endpoint_url
    origin_id   = local.cloudfront_api_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "POST"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.cloudfront_api_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    #* Will likely want to revisit caching for API calls
    # CachingDisabled managed policy ID:
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    # AllViewerExceptHostHeader managed policy ID:
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.cloudfront_web_origin_id
    compress         = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 300
    max_ttl                = 1200
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.cra_upd_cloudfront_acm.arn
    minimum_protocol_version       = "TLSv1.2_2021"
  }
}

#! Outputs the cloudfront domain name for testing- remove this after
output "cloudfront_distribution_domain_name" {
  value       = aws_cloudfront_distribution.cra_upd_cf_distribution.domain_name
  description = "Cloudfront distribution domain name"
}