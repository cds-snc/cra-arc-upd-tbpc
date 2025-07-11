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
    domain_name = var.apigw_endpoint_domain
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
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.cloudfront_api_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.cra_upd_api_cache_policy.id

    # AllViewerExceptHostHeader managed policy ID:
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

    # Managed-CORS-With-Preflight
    response_headers_policy_id = "5cc3b908-e619-4b99-88e5-2cf7f45965bd"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.cloudfront_web_origin_id
    compress         = true

    cache_policy_id = aws_cloudfront_cache_policy.cra_upd_s3_cache_policy.id

    # CORS-S3Origin managed policy ID:
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"

    viewer_protocol_policy = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.cra_upd_cf_viewer_request_function.arn
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.cra_upd_cloudfront_acm.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
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
  min_ttl     = 1
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
      query_string_behavior = "none"
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