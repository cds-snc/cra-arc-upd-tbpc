resource "aws_route53_zone" "cra_upd_hosted_zone" {
  name = var.domain

  depends_on = [aws_acm_certificate.cra_upd_cloudfront_acm]
}
