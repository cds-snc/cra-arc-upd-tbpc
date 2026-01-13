locals {
  cloudfront_web_origin_id       = "upd_web"
  cloudfront_api_origin_id       = "upd_api"
  cloudfront_documents_origin_id = "upd_documents"

  certificate_options = var.validate_domain ? {
    cloudfront_default_certificate = false
    acm_certificate_arn            = var.cloudfront_acm_cert
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
    } : {
    cloudfront_default_certificate = true
    acm_certificate_arn            = null
    ssl_support_method             = null
    minimum_protocol_version       = null
  }
}

resource "aws_cloudfront_origin_access_identity" "origin_access_identity" {
  comment = "Cloudfront origin access identity"
}

# Bucket policy to allow CloudFront to access the S3 web bucket
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

# Bucket policy to allow CloudFront to access the "documents" directory in the data bucket
# which contains "documents" such as powerpoint files, excel files, etc.
data "aws_iam_policy_document" "cra_upd_data_bucket_policy_doc" {
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
      "${var.data_bucket_arn}/documents/*"
    ]
  }
}

resource "aws_s3_bucket_policy" "cra_upd_data_bucket_policy" {
  bucket = var.data_bucket_id
  policy = data.aws_iam_policy_document.cra_upd_data_bucket_policy_doc.json
}

# VPC origin for the load balancer
resource "aws_cloudfront_vpc_origin" "load_balancer_vpc_origin" {
  vpc_origin_endpoint_config {
    name                   = "${local.cloudfront_api_origin_id}_vpc_origin"
    arn                    = var.loadbalancer_arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "https-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }
}

resource "aws_cloudfront_distribution" "cra_upd_cf_distribution" {
  enabled             = true
  aliases             = [var.domain]
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
    domain_name = var.data_bucket_domain
    origin_id   = local.cloudfront_documents_origin_id
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.origin_access_identity.cloudfront_access_identity_path
    }
  }

  origin {
    domain_name = var.loadbalancer_dns_name
    origin_id   = local.cloudfront_api_origin_id

    vpc_origin_config {
      vpc_origin_id            = aws_cloudfront_vpc_origin.load_balancer_vpc_origin.id
      origin_read_timeout      = 60
      origin_keepalive_timeout = 30
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.cloudfront_api_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.cra_upd_api_cache_policy.id

    # AllViewer managed policy ID:
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3"

    # Managed-CORS-With-Preflight
    response_headers_policy_id = "5cc3b908-e619-4b99-88e5-2cf7f45965bd"
  }

  ordered_cache_behavior {
    path_pattern           = "/documents/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.cloudfront_documents_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # CachingOptimized managed policy ID:
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # CORS-S3Origin managed policy ID:
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.cloudfront_web_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.cra_upd_s3_cache_policy.id

    # CORS-S3Origin managed policy ID:
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"


    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.cra_upd_cf_viewer_request_function.arn
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = local.certificate_options.acm_certificate_arn
    ssl_support_method             = local.certificate_options.ssl_support_method
    minimum_protocol_version       = local.certificate_options.minimum_protocol_version
  }
}

resource "aws_cloudfront_cache_policy" "cra_upd_s3_cache_policy" {
  name        = "cra_upd_s3_cache_policy"
  comment     = "The cache policy for the S3 web bucket origin"
  min_ttl     = 1
  default_ttl = 300
  max_ttl     = 1200

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }

    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_cache_policy" "cra_upd_api_cache_policy" {
  name        = "cra_upd_api_cache_policy"
  comment     = "The cache policy for the API Gateway origin"
  min_ttl     = 0
  default_ttl = 120
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "all"
    }

    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = false
  }
}

resource "aws_cloudfront_function" "cra_upd_cf_viewer_request_function" {
  name    = "url-rewrite-function"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrites URLs to enable SPA routing"
  publish = true
  code    = file("${path.module}/url-rewriter.js")
}
