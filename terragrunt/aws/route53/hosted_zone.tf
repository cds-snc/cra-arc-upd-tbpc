resource "aws_route53_zone" "cra_upd_hosted_zone" {
  name = var.domain

  name_servers = var.env == "production" ? [
    "ns1-06.azure-dns.com",
    "ns2-06.azure-dns.net",
    "ns3-06.azure-dns.org",
    "ns4-06.azure-dns.info",
  ] : null

  depends_on = [aws_acm_certificate.cra_upd_cloudfront_acm]
}
