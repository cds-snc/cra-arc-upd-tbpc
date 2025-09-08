output "cra_upd_hosted_zone_id" {
  value = aws_route53_zone.cra_upd_hosted_zone.zone_id
}

output "loadbalancer_certificate_arn" {
  value = aws_acm_certificate.cra_upd_loadbalancer_acm.arn
}

output "cloudfront_certificate_arn" {
  value = aws_acm_certificate.cra_upd_cloudfront_acm.arn
}
