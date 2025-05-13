output "apigw_endpoint_url" {
  value       = aws_apigatewayv2_api.apigw_http_endpoint.api_endpoint
  description = "API Gateway Endpoint URL"
}