# We need one certificate for CloudFront in us-east-1, and one for the load balancer in ca-central-1
# But note that these both share the same route53 records.

# CloudFront
resource "aws_acm_certificate" "cra_upd_cloudfront_acm" {
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  provider = aws.us-east-1

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cra_upd_cloudfront_cert_validation_record" {
  zone_id = aws_route53_zone.cra_upd_hosted_zone.zone_id

  for_each = {
    for dvo in aws_acm_certificate.cra_upd_cloudfront_acm.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  type            = each.value.type
  ttl             = 60
}

resource "aws_acm_certificate_validation" "cra_upd_cloudfront_cert_validation" {
  count = var.validate_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.cra_upd_cloudfront_acm.arn
  validation_record_fqdns = [for record in aws_route53_record.cra_upd_cloudfront_cert_validation_record : record.fqdn]

  provider = aws.us-east-1
}

# Load balancer - Doesn't appear to need validation, probably because it's the same domain
resource "aws_acm_certificate" "cra_upd_loadbalancer_acm" {
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  depends_on = [aws_acm_certificate_validation.cra_upd_cloudfront_cert_validation]

  lifecycle {
    create_before_destroy = true
  }
}
