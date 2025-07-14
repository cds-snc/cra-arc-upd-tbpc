resource "aws_route53_zone" "cra_upd_hosted_zone" {
  name = var.domain
}

resource "aws_route53_record" "cra_upd_cloudfront_alias" {
  zone_id = aws_route53_zone.cra_upd_hosted_zone.zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cra_upd_cf_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.cra_upd_cf_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_acm_certificate" "cra_upd_cloudfront_acm" {
  domain_name               = var.domain
  subject_alternative_names = ["*.${var.domain}"]
  validation_method         = "DNS"

  provider = aws.us-east-1

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cra_upd_cert_validation_record" {
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

resource "aws_acm_certificate_validation" "cra_upd_cert_validation" {
  certificate_arn         = aws_acm_certificate.cra_upd_cloudfront_acm.arn
  validation_record_fqdns = [for record in aws_route53_record.cra_upd_cert_validation_record : record.fqdn]

  provider = aws.us-east-1
}