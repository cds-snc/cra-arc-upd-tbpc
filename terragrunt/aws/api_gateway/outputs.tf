output "apigw_endpoint_domain" {
  value       = trimprefix(aws_apigatewayv2_api.cra_upd_apigw_endpoint.api_endpoint, "https://")
  description = "API Gateway Endpoint Domain"
}