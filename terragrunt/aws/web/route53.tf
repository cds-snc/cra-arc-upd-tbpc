resource "aws_route53_record" "cra_upd_cloudfront_alias" {
  zone_id = var.hosted_zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cra_upd_cf_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.cra_upd_cf_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}